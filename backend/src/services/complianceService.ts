import prisma from "../lib/prisma";
import { auditLogger } from "../lib/auditLogger";

export interface ComplianceAuthInput {
  organization_id: string;
  customer_id?: string | null;
  customer_email?: string | null;
  invoice_id?: string | null;
  channel?: string;
}

export interface ComplianceAuthResult {
  allowed: boolean;
  reason?: string;
  disclosure_footer: string;
}

// Deterministic opt-out keywords (CAN-SPAM, Reg F, GDPR Art. 21)
export const OPT_OUT_REGEX =
  /\b(unsubscribe|stop emailing|stop contacting|do not email|do not contact|remove me from your list|cease and desist)\b/i;

/**
 * Checks if a message body expresses an opt-out / cease-contact request.
 */
export function checkIsOptOut(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return OPT_OUT_REGEX.test(text);
}

/**
 * Enterprise Outbound Compliance Gate.
 * Evaluates whether an outbound collection reminder is legally and policy-wise authorized to send.
 *
 * Enforces:
 * 1. Recipient Suppression check (Opt-Out / Do Not Contact list)
 * 2. Active Dispute Dunning Freeze (FDCPA § 1692g, state commercial debt laws)
 * 3. 3-day Cadence Cooldown (Anti-harassment protection)
 * 4. GDPR / DPDP Processing Restriction (Legal hold / Erasure)
 * 5. Mandatory EU AI Act Art. 50 Disclosure Footer
 */
export async function authorizeOutboundSend(
  input: ComplianceAuthInput
): Promise<ComplianceAuthResult> {
  const { organization_id, customer_id, customer_email, invoice_id } = input;

  const defaultFooter =
    "This communication was prepared with the assistance of an automated system. Reply directly to this message to reach a human representative.";

  // 1. Check Recipient Suppression (Opt-Out / Unsubscribe)
  if (customer_email) {
    const normalizedEmail = customer_email.trim().toLowerCase();
    const suppressed = await prisma.suppressions.findFirst({
      where: { organization_id, address: normalizedEmail },
    });

    if (suppressed) {
      auditLogger.log({
        organization_id,
        actor: { type: "SYSTEM", id: "compliance_gate" },
        action: "OUTBOUND_SEND_BLOCKED",
        resource_type: "SUPPRESSION",
        resource_id: suppressed.id,
        outcome: "DENIED",
        metadata: { reason: "RECIPIENT_SUPPRESSED", email: normalizedEmail },
      });

      return {
        allowed: false,
        reason: "RECIPIENT_SUPPRESSED: Recipient is on the organization suppression list.",
        disclosure_footer: defaultFooter,
      };
    }
  }

  // 2. Check Customer Processing Restriction (GDPR / DPDP Erasure Hold)
  if (customer_id) {
    const customer = await prisma.customers.findFirst({
      where: { id: customer_id, organization_id },
    });

    if (customer?.processing_restricted) {
      return {
        allowed: false,
        reason: "PROCESSING_RESTRICTED: Customer record has legal processing restriction enabled.",
        disclosure_footer: defaultFooter,
      };
    }
  }

  // 3. Check Active Dispute Freeze
  if (invoice_id) {
    const activeDispute = await prisma.collection_actions.findFirst({
      where: {
        organization_id,
        invoice_id,
        action_type: "ESCALATE_DISPUTE",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (activeDispute) {
      auditLogger.log({
        organization_id,
        actor: { type: "SYSTEM", id: "compliance_gate" },
        action: "OUTBOUND_SEND_BLOCKED",
        resource_type: "INVOICE",
        resource_id: invoice_id,
        outcome: "DENIED",
        metadata: { reason: "INVOICE_IN_ACTIVE_DISPUTE", dispute_action_id: activeDispute.id },
      });

      return {
        allowed: false,
        reason: "INVOICE_IN_ACTIVE_DISPUTE: Automated dunning is frozen while an active dispute is under review.",
        disclosure_footer: defaultFooter,
      };
    }

    // 4. Cadence Cooldown Check (e.g. at least 3 calendar days between reminders for same invoice)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentSend = await prisma.collection_actions.findFirst({
      where: {
        organization_id,
        invoice_id,
        status: "COMPLETED",
        executed_at: { gte: threeDaysAgo },
      },
      orderBy: { executed_at: "desc" },
    });

    if (recentSend) {
      return {
        allowed: false,
        reason: "CADENCE_COOLDOWN_ACTIVE: An automated reminder was already sent for this invoice within the 3-day quiet period.",
        disclosure_footer: defaultFooter,
      };
    }
  }

  return {
    allowed: true,
    disclosure_footer: defaultFooter,
  };
}

/**
 * Records an opt-out suppression and cancels any pending collection actions for that address.
 */
export async function addSuppression(
  organization_id: string,
  address: string,
  reason: string = "USER_OPT_OUT"
) {
  const normalizedEmail = address.trim().toLowerCase();

  const suppression = await prisma.suppressions.upsert({
    where: {
      organization_id_address: {
        organization_id,
        address: normalizedEmail,
      },
    },
    update: { reason },
    create: {
      organization_id,
      address: normalizedEmail,
      reason,
      channel: "EMAIL",
    },
  });

  // Cancel any pending collection actions targeting this customer's open conversations
  const customer = await prisma.customers.findFirst({
    where: { organization_id, email: normalizedEmail },
  });

  if (customer) {
    await prisma.collection_actions.updateMany({
      where: {
        organization_id,
        customer_id: customer.id,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });
  }

  auditLogger.log({
    organization_id,
    actor: { type: "SYSTEM", id: "opt_out_engine" },
    action: "SUPPRESSION_RECORDED",
    resource_type: "SUPPRESSION",
    resource_id: suppression.id,
    outcome: "SUCCESS",
    metadata: { address: normalizedEmail, reason },
  });

  return suppression;
}
