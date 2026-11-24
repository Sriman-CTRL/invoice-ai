import prisma from "../lib/prisma";
import { getIntentClassifier } from "./ai/intentClassifier";
import { validateClassificationResult } from "./ai/types";
import { runCollectionActionEngine } from "./collectionActionEngine";
import { redactPaymentCardData } from "../lib/pciSanitizer";
import { checkIsOptOut, addSuppression } from "./complianceService";
import { tryBankAlert, type BankAlertOutcome } from "./bankAlertService";

export interface InboundEmail {
  to?: string;
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  organization_id?: string;
  invoice_number?: string;
  channel?: string;
  /**
   * Set ONLY by the inbound webhook, when the email's From domain passed DMARC (or SPF + DKIM). Bank-alert suggestions
   * need it; without it the email takes the normal pipeline.
   */
  authenticated_sender?: string;
}

export interface InboundResult {
  matched: boolean;
  organization_id: string | null;
  customer_id: string | null;
  invoice_id: string | null;
  conversation_id: string;
  message_id: string;
  classified: boolean;
  classification?: {
    intent: string;
    confidence: number;
    promised_date: string | null;
    promised_amount: number | null;
    reason: string | null;
  };
  collection_action?: unknown;
  /** Set when the email was a bank credit alert from the seller; a suggestion may have been queued. Never a payment. */
  bank_alert?: BankAlertOutcome;
  errors: string[];
}

export interface ResolveInput {
  organization_id?: string;
  from: string;
  to?: string;
  subject?: string;
  text?: string;
  invoice_number?: string;
  channel?: string;
}

export interface ResolvedThread {
  organization_id: string;
  customer: { id: string; name: string; email: string };
  invoice: { id: string; invoice_number: string; amount: unknown; currency: string; due_at: Date | null; status: string } | null;
  conversation: { id: string; channel: string; status: string };
  customer_created: boolean;
}

export function parseAddress(raw: string): { email: string; name: string } | null {
  const match = raw.trim().match(/^(?:([^<]*)<)?\s*([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)\s*>?$/);
  if (!match) return null;
  const email = match[2].trim().toLowerCase();
  const name = (match[1] || "").trim().replace(/^"|"$/g, "");
  return { email, name };
}

function plainText(body: string | undefined, html: string | undefined): string {
  if (body && body.trim()) return body.trim();
  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function findInvoiceNumber(text: string): string | null {
  const m = text.match(/\b(?:INV|INVOICE)[-:#\s]?([A-Za-z0-9][A-Za-z0-9\-\/]{2,20})\b/i);
  return m ? m[1] : null;
}

/**
 * Resolve the tenant, customer, invoice and open conversation for an inbound
 * email WITHOUT persisting a message. This is the "Resolve Conversation" step
 * that an external orchestrator (n8n) needs before it stores/classifies.
 */
export async function resolveThread(input: ResolveInput): Promise<ResolvedThread> {
  const to = input.to || "";
  const from = parseAddress(input.from || "");
  if (!from) throw new Error("Missing or invalid `from` address");

  // Tenant: explicit id, or the local part of the `to` address -> org slug.
  let organization_id: string | null = input.organization_id || null;
  if (!organization_id && to) {
    const local = to.split("@")[0]?.trim().toLowerCase();
    if (local) {
      const org = await prisma.organizations.findUnique({ where: { slug: local } });
      if (org) organization_id = org.id;
    }
  }
  if (!organization_id) {
    throw new Error(`No tenant matched for address "${to || "(none)"}". Use a per-organization inbound address.`);
  }

  // Customer: find by email, else create.
  let customer = await prisma.customers.findFirst({
    where: { organization_id, email: from.email },
  });
  let customer_created = false;
  if (!customer) {
    customer = await prisma.customers.create({
      data: {
        organization_id,
        email: from.email,
        name: from.name || from.email.split("@")[0],
      },
    });
    customer_created = true;
  }

  // Invoice: explicit number / number in subject+body, else most recent unpaid.
  const haystack = `${input.subject || ""}\n${input.text || ""}`;
  let invoice = null;
  const explicitNumber = input.invoice_number || findInvoiceNumber(haystack);
  if (explicitNumber) {
    invoice = await prisma.invoices.findFirst({
      where: {
        organization_id,
        customer_id: customer.id,
        invoice_number: { contains: explicitNumber, mode: "insensitive" },
      },
    });
  }
  if (!invoice) {
    invoice = await prisma.invoices.findFirst({
      where: {
        organization_id,
        customer_id: customer.id,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      orderBy: { due_at: "asc" },
    });
  }
  const invoice_id = invoice?.id ?? null;

  // Conversation: reuse the open thread for this customer+invoice, else create.
  let conversation = await prisma.conversations.findFirst({
    where: { organization_id, customer_id: customer.id, invoice_id, status: "OPEN" },
    orderBy: { created_at: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversations.create({
      data: {
        organization_id,
        customer_id: customer.id,
        invoice_id,
        channel: input.channel || "EMAIL",
        external_thread_id: null,
      },
    });
  }

  return {
    organization_id,
    customer: { id: customer.id, name: customer.name, email: customer.email },
    invoice: invoice
      ? {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency,
          due_at: invoice.due_at,
          status: invoice.status,
        }
      : null,
    conversation: { id: conversation.id, channel: conversation.channel, status: conversation.status },
    customer_created,
  };
}

/**
 * Process an inbound customer email: resolve tenant/customer/invoice, store the
 * message, classify it, and run the deterministic collection action engine.
 *
 * Never throws for classification problems — they are captured so the message is
 * still persisted and surfaced for human review.
 */
export async function processInboundEmail(input: InboundEmail): Promise<InboundResult> {
  const to = input.to || "";
  const from = parseAddress(input.from || "");
  const rawText = plainText(input.text, input.html);

  if (!rawText) throw new Error("Message has no text content");
  if (!from) throw new Error("Missing or invalid `from` address");

  // PCI-DSS SAQ A: Sanitize any credit/debit card numbers before persistence or AI ingestion
  const text = redactPaymentCardData(rawText);

  // A bank "amount credited" alert forwarded by the seller becomes a payment SUGGESTION in the Action Queue (never a payment).
  const alert = await tryBankAlert({ organization_id: input.organization_id, to, authenticated_sender: input.authenticated_sender, subject: input.subject, text });
  if (alert) {
    return {
      matched: true,
      organization_id: alert.organization_id,
      customer_id: null,
      invoice_id: alert.invoice_id ?? null,
      conversation_id: "",
      message_id: "",
      classified: false,
      bank_alert: alert,
      errors: [],
    };
  }

  const resolved = await resolveThread({
    organization_id: input.organization_id,
    from: input.from || "",
    to,
    subject: input.subject,
    text,
    invoice_number: input.invoice_number,
    channel: input.channel,
  });

  const { organization_id, customer, invoice, conversation } = resolved;
  const invoice_id = invoice?.id ?? null;

  // Regulatory: Check deterministic opt-out keywords (CAN-SPAM / Reg F / GDPR Art. 21)
  const isOptOut = checkIsOptOut(text);
  if (isOptOut) {
    await addSuppression(organization_id, from.email, "INBOUND_KEYWORD_OPT_OUT");
  }

  const message = await prisma.messages.create({
    data: {
      organization_id,
      conversation_id: conversation.id,
      direction: "INBOUND",
      channel: input.channel || "EMAIL",
      sender: from.email,
      recipient: to || null,
      subject: input.subject || null,
      body: text,
    },
  });

  const result: InboundResult = {
    matched: true,
    organization_id,
    customer_id: customer.id,
    invoice_id,
    conversation_id: conversation.id,
    message_id: message.id,
    classified: false,
    errors: [],
  };

  try {
    const contextMessages = await prisma.messages.findMany({
      where: { conversation_id: conversation.id, id: { not: message.id } },
      orderBy: { created_at: "desc" },
      take: 10,
    });
    const context = contextMessages.reverse().map((m) => ({
      direction: m.direction as "INBOUND" | "OUTBOUND",
      body: m.body ?? "",
      created_at: m.created_at.toISOString(),
    }));

    const classifier = getIntentClassifier();
    const classification = validateClassificationResult(
      await classifier.classifyMessage({ message: text, context }),
    );

    await prisma.messages.update({
      where: { id: message.id },
      data: { ai_intent: classification.intent, ai_confidence: classification.confidence },
    });

    const action = await runCollectionActionEngine({
      organization_id,
      customer_id: customer.id,
      invoice_id,
      conversation_id: conversation.id,
      message_id: message.id,
      classification,
    });

    result.classified = true;
    result.classification = classification;
    result.collection_action = action;
  } catch (error) {
    result.errors.push(
      `Classification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}
