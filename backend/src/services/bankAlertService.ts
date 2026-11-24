import prisma from "../lib/prisma";
import { parseBankAlert, type BankAlert } from "../lib/bankAlert";

/**
 * Bank credit-alert emails -> payment SUGGESTIONS. This file never creates a payment and never changes an invoice's
 * status (AGENTS.md rule 1). It only adds a PAYMENT_MATCH_SUGGESTED action to the Action Queue with the evidence; the
 * seller settles it with the existing one-click confirmation.
 */

export interface BankAlertOutcome {
  kind: "SUGGESTED" | "DUPLICATE" | "NO_MATCH";
  match?: "STRONG" | "WEAK";
  invoice_id?: string;
  action_id?: string;
  alert: BankAlert;
}

const OPEN_STATUSES = ["OPEN", "PARTIALLY_PAID"];
const paise = (n: number) => Math.round(n * 100);

/**
 * Strong match: an open invoice of this business has a pending client proof with the same UTR as the alert.
 * Weak match: exactly one open invoice of this business has an outstanding balance equal to the credited amount.
 * Anything else: no suggestion.
 */
export async function suggestForAlert(organizationId: string, alert: BankAlert, source = "bank_alert_email"): Promise<BankAlertOutcome> {
  let invoiceId: string | null = null;
  let customerId: string | null = null;
  let paymentId: string | null = null;
  let match: "STRONG" | "WEAK" | null = null;
  let evidence = "";

  const pending = await prisma.payments.findMany({
    where: { organization_id: organizationId, status: "PENDING" },
    include: { invoices: { select: { id: true, invoice_number: true, customer_id: true, status: true } } },
  });
  const proof = pending.find((p) => (p.external_payment_id || "").toUpperCase() === alert.reference && OPEN_STATUSES.includes(p.invoices.status));
  if (proof) {
    match = "STRONG";
    invoiceId = proof.invoices.id;
    customerId = proof.invoices.customer_id;
    paymentId = proof.id;
    evidence = `The bank alert's reference ${alert.reference} is the same UTR the client submitted for invoice ${proof.invoices.invoice_number}. ${CHECK_BANK_WARNING}`;
  } else {
    const open = await prisma.invoices.findMany({
      where: { organization_id: organizationId, status: { in: OPEN_STATUSES } },
      include: { payments: { where: { status: "SUCCEEDED" }, select: { amount: true, tds_amount: true } } },
      take: 1000,
    });
    const equal = open.filter((i) => paise(Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount) + Number(p.tds_amount), 0)) === paise(alert.amount));
    if (equal.length === 1) {
      match = "WEAK";
      invoiceId = equal[0].id;
      customerId = equal[0].customer_id;
      evidence = `Invoice ${equal[0].invoice_number} is the only open invoice with exactly this balance (INR ${alert.amount.toFixed(2)}). The client has not submitted this reference, so check it is really theirs. ${CHECK_BANK_WARNING}`;
    }
  }
  if (!match || !invoiceId) return { kind: "NO_MATCH", alert };

  // Do not suggest the same credit twice.
  const existing = await prisma.collection_actions.findMany({
    where: { organization_id: organizationId, invoice_id: invoiceId, action_type: "PAYMENT_MATCH_SUGGESTED", status: "PENDING" },
    select: { id: true, metadata: true },
  });
  const dup = existing.find((a) => String((a.metadata as { utr?: string } | null)?.utr || "").toUpperCase() === alert.reference);
  if (dup) return { kind: "DUPLICATE", match, invoice_id: invoiceId, action_id: dup.id, alert };

  const action = await prisma.collection_actions.create({
    data: {
      organization_id: organizationId,
      customer_id: customerId,
      invoice_id: invoiceId,
      action_type: "PAYMENT_MATCH_SUGGESTED",
      status: "PENDING",
      scheduled_at: new Date(),
      // Same keys as a client proof (utr, amount, payment_id) so the existing one-click settlement works unchanged.
      metadata: { match, utr: alert.reference, amount: alert.amount, ...(paymentId ? { payment_id: paymentId } : {}), evidence, source },
    },
  });
  return { kind: "SUGGESTED", match, invoice_id: invoiceId, action_id: action.id, alert };
}

export const CHECK_BANK_WARNING = "Check your bank app or statement before confirming. Emails can be faked.";

export interface BankAlertEmail {
  organization_id?: string;
  to?: string;
  /** The From address, but only when its domain passed email authentication (see lib/emailAuth.ts). */
  authenticated_sender?: string;
  subject?: string;
  text: string;
}

/**
 * Called by the inbound pipeline before normal reply handling. Returns null when the email is not a bank credit alert
 * from one of this business's own users (then the normal pipeline runs), so a client's reply is never mistaken for one.
 */
export async function tryBankAlert(input: BankAlertEmail): Promise<(BankAlertOutcome & { organization_id: string }) | null> {
  const alert = parseBankAlert(input.text, input.subject);
  if (!alert) return null;
  // A forgeable From header proves nothing, so an unauthenticated sender never reaches the alert path.
  const fromEmail = input.authenticated_sender?.trim().toLowerCase();
  if (!fromEmail) return null;

  let organizationId: string | null = input.organization_id || null;
  if (!organizationId && input.to) {
    const local = input.to.split("@")[0]?.trim().toLowerCase();
    if (local) organizationId = (await prisma.organizations.findUnique({ where: { slug: local } }))?.id ?? null;
  }
  if (!organizationId) return null;

  // Only the seller (or someone in their business) forwards bank alerts; a stranger's email is handled as a normal message.
  const member = await prisma.users.findFirst({ where: { organization_id: organizationId, email: fromEmail }, select: { id: true } });
  if (!member) return null;

  return { ...(await suggestForAlert(organizationId, alert)), organization_id: organizationId };
}
