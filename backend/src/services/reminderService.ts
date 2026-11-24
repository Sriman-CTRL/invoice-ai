import prisma from "../lib/prisma";
import { emailEnabled, sendMail, type MailInput } from "../lib/mailer";
import { getOrgSettings, type OrgSettings } from "../lib/orgSettings";
import { unsubscribeUrl } from "../lib/unsubscribe";

/**
 * Shared reminder logic: the guards and the sending used by the manual "send reminder" button and by the
 * scheduled automatic reminders. AI never writes these emails; the wording is fixed templates below.
 */

export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Automatic reminders go out this many days after the due date. */
export const AUTO_REMINDER_STEPS = [1, 7, 14] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export const reminderDailyCap = (): number => Number(process.env.REMINDER_DAILY_CAP || 30);
const publicAppUrl = (): string => (process.env.PUBLIC_APP_URL || "https://paivo.in").replace(/\/$/, "");

export type Mailer = (input: MailInput) => Promise<{ id: string }>;

export interface GuardFailure {
  code: "EMAIL_OFF" | "NO_PAYMENT_DETAILS" | "NOT_NEEDED" | "COOLDOWN" | "DAILY_CAP" | "RESTRICTED" | "DISPUTED";
  status: number;
  error: string;
}

/** Opt-out check (CAN-SPAM / Reg F). Applies to every channel, so the manual route runs it before anything else. */
export async function findSuppression(organizationId: string, email: string) {
  return prisma.suppressions.findFirst({ where: { organization_id: organizationId, address: email.toLowerCase() } });
}

export const hasPaymentDetails = (s: Pick<OrgSettings, "upi_id" | "bank_account_number" | "bank_ifsc">): boolean =>
  Boolean(s.upi_id || (s.bank_account_number && s.bank_ifsc));

interface GuardInput {
  organizationId: string;
  invoice: { id: string; status: string; customers: { processing_restricted?: boolean | null } };
  settings: Pick<OrgSettings, "upi_id" | "bank_account_number" | "bank_ifsc">;
  /** Extra checks used only for automatic sending (restricted processing, disputes). */
  strict?: boolean;
  /** Skip the email-configured check (the scheduled job has already checked it once). */
  emailChecked?: boolean;
}

/**
 * Guards before an email goes out, in the same order as the manual route always had them. Returns the first problem,
 * or null when it is fine to send.
 */
export async function deliveryGuard({ organizationId, invoice, settings, strict = false, emailChecked = false }: GuardInput): Promise<GuardFailure | null> {
  if (!emailChecked && !emailEnabled()) {
    return { code: "EMAIL_OFF", status: 503, error: "Email sending isn't switched on yet. Use Email Client or WhatsApp, then Mark as sent." };
  }
  if (!hasPaymentDetails(settings)) {
    return { code: "NO_PAYMENT_DETAILS", status: 400, error: "Add your UPI ID or bank details in Settings first, so the client can pay when they read this." };
  }
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return { code: "NOT_NEEDED", status: 400, error: "This invoice doesn't need a reminder." };
  }
  if (strict) {
    if (invoice.customers.processing_restricted) {
      return { code: "RESTRICTED", status: 403, error: "This customer asked to restrict processing of their data." };
    }
    if (invoice.status === "DISPUTED") {
      return { code: "DISPUTED", status: 409, error: "This invoice is disputed." };
    }
    const dispute = await prisma.collection_actions.findFirst({
      where: { organization_id: organizationId, invoice_id: invoice.id, action_type: "ESCALATE_DISPUTE", status: "PENDING" },
      select: { id: true },
    });
    if (dispute) return { code: "DISPUTED", status: 409, error: "This invoice has an open dispute." };
  }
  const since = new Date(Date.now() - REMINDER_COOLDOWN_MS);
  const recent = await prisma.collection_actions.findMany({
    where: { organization_id: organizationId, action_type: "PAYMENT_REMINDER", status: "COMPLETED", executed_at: { gte: since } },
    select: { invoice_id: true, metadata: true },
  });
  const delivered = recent.filter((a) => (a.metadata as { delivered?: boolean } | null)?.delivered === true);
  if (delivered.some((a) => a.invoice_id === invoice.id)) {
    return { code: "COOLDOWN", status: 429, error: "A reminder for this invoice was already emailed in the last 24 hours." };
  }
  // An automatic reminder that went out (or is being sent) counts even if its history record could not be written.
  const claimed = await prisma.auto_reminder_claims.findFirst({
    where: { organization_id: organizationId, invoice_id: invoice.id, status: { in: ["CLAIMED", "SENT"] }, claimed_at: { gte: since } },
    select: { id: true },
  });
  if (claimed) {
    return { code: "COOLDOWN", status: 429, error: "A reminder for this invoice was already emailed in the last 24 hours." };
  }
  if (delivered.length >= reminderDailyCap()) {
    return { code: "DAILY_CAP", status: 429, error: `Daily limit of ${reminderDailyCap()} emailed reminders reached. Try again tomorrow.` };
  }
  return null;
}

interface SendInput {
  organizationId: string;
  invoice: { id: string; invoice_number: string; customers: { name: string; email: string }; organizations: { name: string } };
  settings: Pick<OrgSettings, "brand_color">;
  replyTo?: string | null;
  subject: string;
  text: string;
  mailer?: Mailer;
}

/** Sends one reminder email with the pay link, an unsubscribe link and Reply-To set to the seller. */
export async function sendReminderEmail({ organizationId, invoice, settings, replyTo, subject, text, mailer = sendMail }: SendInput): Promise<{ id: string }> {
  return mailer({
    to: invoice.customers.email,
    fromName: invoice.organizations.name,
    replyTo: replyTo ?? undefined,
    subject,
    text,
    payUrl: `${publicAppUrl()}/pay/${invoice.id}`,
    brandColor: settings.brand_color,
    unsubscribeUrl: unsubscribeUrl(publicAppUrl(), organizationId, invoice.customers.email),
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Automatic reminders
// ---------------------------------------------------------------------------------------------------------------

/**
 * Which step (if any) should go out now. Only the highest step already due is considered, so an invoice that is
 * 8 days late gets the day-7 email, not the day-1 and day-7 emails together. A step already sent is never repeated.
 */
export function selectDueStep(dueAt: Date, now: Date, sentSteps: readonly number[], steps: readonly number[] = AUTO_REMINDER_STEPS): number | null {
  const daysLate = Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS);
  const eligible = steps.filter((s) => s <= daysLate);
  if (eligible.length === 0) return null;
  const highest = Math.max(...eligible);
  return sentSteps.includes(highest) ? null : highest;
}

const money = (amount: number, currency: string): string => {
  const n = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return currency === "INR" ? `₹${n}` : `${currency} ${n}`;
};
const dateIn = (d: Date): string => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);

export interface ReminderTemplateInput {
  step: number;
  sellerName: string;
  customerName: string;
  invoiceNumber: string;
  outstanding: number;
  currency: string;
  dueAt: Date;
}

/** Fixed, polite wording per step: gentle at day 1, a little firmer by day 14, never threatening. */
export function buildAutoReminder(i: ReminderTemplateInput): { subject: string; text: string } {
  const amount = money(i.outstanding, i.currency);
  const due = dateIn(i.dueAt);
  const paidAlready = "If you have already paid, thank you. Please enter the transaction reference (UTR) on the payment page so that we can match it.";
  if (i.step <= 1) {
    return {
      subject: `Gentle reminder: invoice ${i.invoiceNumber} was due on ${due}`,
      text: `Hello ${i.customerName},\n\nA quick note that invoice ${i.invoiceNumber} for ${amount} was due on ${due} and still shows as unpaid.\n\n${paidAlready}\n\nThank you,\n${i.sellerName}`,
    };
  }
  if (i.step <= 7) {
    return {
      subject: `Reminder: invoice ${i.invoiceNumber} is a week overdue`,
      text: `Hello ${i.customerName},\n\nFollowing up on invoice ${i.invoiceNumber} for ${amount}, which was due on ${due} and is now about a week overdue.\n\n${paidAlready}\n\nIf something is holding it up, just reply to this email and let me know.\n\nThank you,\n${i.sellerName}`,
    };
  }
  return {
    subject: `Second follow-up: invoice ${i.invoiceNumber} is two weeks overdue`,
    text: `Hello ${i.customerName},\n\nInvoice ${i.invoiceNumber} for ${amount} was due on ${due} and is now about two weeks overdue. I would be grateful if you could settle it, or tell me when I can expect payment.\n\n${paidAlready}\n\nIf there is a problem with the invoice or the work, please reply to this email so we can sort it out.\n\nThank you,\n${i.sellerName}`,
  };
}

export interface AutoReminderOptions {
  now?: Date;
  mailer?: Mailer;
  /** Log what would be sent instead of sending (also from AUTO_REMINDERS_DRY_RUN=1). Nothing is recorded in dry-run. */
  dryRun?: boolean;
  timeBudgetMs?: number;
  runCap?: number;
}

export interface AutoReminderResult {
  dry_run: boolean;
  organizations: number;
  considered: number;
  sent: number;
  skipped: Record<string, number>;
  failed: number;
  stopped_early: "time_budget" | "run_cap" | null;
}

/** A FAILED claim may be retried once it is at least this old ("next day"; the cron runs daily). */
const FAILED_RETRY_AFTER_MS = 20 * 60 * 60 * 1000;

/**
 * Claims (invoice, step) before anything is sent. The unique key means exactly one run wins, even when two cron runs
 * overlap. A claim left in CLAIMED (a run that died mid-send) is never retried automatically: at most once beats twice.
 */
async function claimStep(organizationId: string, invoiceId: string, step: number): Promise<boolean> {
  const created = await prisma.auto_reminder_claims.createMany({
    data: [{ organization_id: organizationId, invoice_id: invoiceId, step }],
    skipDuplicates: true,
  });
  if (created.count === 1) return true;
  const retried = await prisma.auto_reminder_claims.updateMany({
    where: { organization_id: organizationId, invoice_id: invoiceId, step, status: "FAILED", finished_at: { lt: new Date(Date.now() - FAILED_RETRY_AFTER_MS) } },
    data: { status: "CLAIMED", claimed_at: new Date(), finished_at: null },
  });
  return retried.count === 1;
}

async function finishClaim(organizationId: string, invoiceId: string, step: number, status: "SENT" | "FAILED"): Promise<void> {
  await prisma.auto_reminder_claims
    .updateMany({ where: { organization_id: organizationId, invoice_id: invoiceId, step }, data: { status, finished_at: new Date() } })
    .catch((e) => console.error("could not update reminder claim:", (e as Error).message));
}

/**
 * Sends the scheduled reminders. Runs from the daily cron in system context, so every query below filters by
 * organization_id explicitly. Idempotent: each (invoice, step) is claimed in auto_reminder_claims BEFORE sending, so
 * overlapping runs or a failed history write can never send the same step twice. After a send a PAYMENT_REMINDER action
 * with metadata {auto, step, delivered} is recorded for the history and the daily cap.
 */
export async function runAutoReminders(opts: AutoReminderOptions = {}): Promise<AutoReminderResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const mailer = opts.mailer ?? sendMail;
  const dryRun = opts.dryRun ?? process.env.AUTO_REMINDERS_DRY_RUN === "1";
  const timeBudgetMs = opts.timeBudgetMs ?? Number(process.env.CRON_TIME_BUDGET_MS || 8000);
  const runCap = opts.runCap ?? Number(process.env.AUTO_REMINDER_RUN_CAP || 200);
  const result: AutoReminderResult = { dry_run: dryRun, organizations: 0, considered: 0, sent: 0, skipped: {}, failed: 0, stopped_early: null };
  const skip = (why: string) => { result.skipped[why] = (result.skipped[why] ?? 0) + 1; };

  // Real sending needs email configured; a dry run is allowed without it so the schedule can be checked.
  if (!dryRun && !opts.mailer && !emailEnabled()) return result;

  let orgs: { id: string }[] = [];
  try {
    orgs = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM organizations WHERE auto_reminders = true ORDER BY id`);
  } catch (e) {
    console.warn("auto reminders: could not list organizations (column not created yet?):", (e as Error).message);
    return result;
  }
  result.organizations = orgs.length;

  for (const { id: organizationId } of orgs) {
    const settings = await getOrgSettings(organizationId);
    if (!settings.auto_reminders) continue;
    const owner = await prisma.users.findFirst({ where: { organization_id: organizationId }, orderBy: { created_at: "asc" }, select: { email: true } });
    const invoices = await prisma.invoices.findMany({
      where: { organization_id: organizationId, status: { in: ["OPEN", "PARTIALLY_PAID"] }, due_at: { lt: new Date(now.getTime() - AUTO_REMINDER_STEPS[0] * DAY_MS + 1) } },
      include: { customers: true, organizations: true, payments: { where: { status: "SUCCEEDED" }, select: { amount: true } } },
      orderBy: { due_at: "asc" },
      take: 500,
    });
    if (invoices.length === 0) continue;
    const earlier = await prisma.collection_actions.findMany({
      where: { organization_id: organizationId, invoice_id: { in: invoices.map((i) => i.id) }, action_type: "PAYMENT_REMINDER", status: "COMPLETED" },
      select: { invoice_id: true, metadata: true },
    });
    const claims = await prisma.auto_reminder_claims.findMany({
      where: { organization_id: organizationId, invoice_id: { in: invoices.map((i) => i.id) }, status: { in: ["CLAIMED", "SENT"] } },
      select: { invoice_id: true, step: true },
    });
    const sentSteps = new Map<string, number[]>();
    for (const c of claims) sentSteps.set(c.invoice_id, [...(sentSteps.get(c.invoice_id) ?? []), c.step]);
    for (const a of earlier) {
      const m = (a.metadata ?? {}) as { auto?: boolean; step?: number; delivered?: boolean };
      if (m.auto === true && m.delivered === true && typeof m.step === "number" && a.invoice_id) {
        sentSteps.set(a.invoice_id, [...(sentSteps.get(a.invoice_id) ?? []), m.step]);
      }
    }

    for (const invoice of invoices) {
      if (Date.now() - started > timeBudgetMs) { result.stopped_early = "time_budget"; return result; }
      if (result.sent >= runCap) { result.stopped_early = "run_cap"; return result; }
      result.considered++;

      if (!invoice.due_at) { skip("no_due_date"); continue; }
      const dueAt = invoice.due_at;
      const step = selectDueStep(dueAt, now, sentSteps.get(invoice.id) ?? []);
      if (step === null) { skip("no_step_due"); continue; }
      if (await findSuppression(organizationId, invoice.customers.email)) { skip("suppressed"); continue; }
      const blocked = await deliveryGuard({ organizationId, invoice, settings, strict: true, emailChecked: true });
      if (blocked) { skip(blocked.code.toLowerCase()); continue; }

      const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = Math.max(0, Number(invoice.amount) - paid);
      if (outstanding <= 0) { skip("nothing_outstanding"); continue; }
      const mail = buildAutoReminder({
        step, sellerName: invoice.organizations.name, customerName: invoice.customers.name, invoiceNumber: invoice.invoice_number,
        outstanding, currency: invoice.currency, dueAt,
      });

      if (dryRun) {
        console.log(`[auto-reminders dry run] org=${organizationId} invoice=${invoice.invoice_number} step=${step} to=${invoice.customers.email.replace(/^(.).*(@.*)$/, "$1***$2")}`);
        result.sent++;
        continue;
      }

      if (!(await claimStep(organizationId, invoice.id, step))) { skip("already_claimed"); continue; }

      let providerId = "";
      try {
        providerId = (await sendReminderEmail({ organizationId, invoice, settings, replyTo: owner?.email, subject: mail.subject, text: mail.text, mailer })).id;
      } catch (e) {
        result.failed++;
        console.error("auto reminder email failed:", (e as Error).message);
        await finishClaim(organizationId, invoice.id, step, "FAILED");
        continue;
      }
      result.sent++;
      await finishClaim(organizationId, invoice.id, step, "SENT");
      try {
        let conversation = await prisma.conversations.findFirst({
          where: { organization_id: organizationId, customer_id: invoice.customer_id, invoice_id: invoice.id },
          orderBy: { created_at: "desc" },
        });
        if (!conversation) {
          conversation = await prisma.conversations.create({
            data: { organization_id: organizationId, customer_id: invoice.customer_id, invoice_id: invoice.id, channel: "EMAIL", status: "OPEN" },
          });
        }
        const message = await prisma.messages.create({
          data: {
            organization_id: organizationId, conversation_id: conversation.id, direction: "OUTBOUND", channel: "EMAIL",
            sender: process.env.MAIL_FROM_ADDRESS || "reminders@paivo.in", recipient: invoice.customers.email, subject: mail.subject, body: mail.text,
          },
        });
        await prisma.collection_actions.create({
          data: {
            organization_id: organizationId, customer_id: invoice.customer_id, invoice_id: invoice.id, conversation_id: conversation.id,
            action_type: "PAYMENT_REMINDER", status: "COMPLETED", scheduled_at: now, executed_at: new Date(),
            metadata: { auto: true, step, delivered: true, provider_id: providerId, sent_message_id: message.id, channel: "EMAIL", recipient: invoice.customers.email },
          },
        });
        sentSteps.set(invoice.id, [...(sentSteps.get(invoice.id) ?? []), step]);
      } catch (e) {
        // The email went out but its history could not be written. The claim is already SENT, so it is never re-sent.
        console.error("auto reminder sent but not recorded:", (e as Error).message);
      }
    }
  }
  return result;
}
