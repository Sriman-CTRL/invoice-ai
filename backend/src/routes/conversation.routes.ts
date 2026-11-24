import { Router } from "express";
import prisma from "../lib/prisma";
import { getConversationDetails } from "../services/conversationService";
import { serverError } from "../lib/monitoring";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractEmail(input: string): string {
  const match = input.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return input.trim().toLowerCase();
}

// ─── POST /api/conversations/resolve ────────────────────────────────────────
// Contract used by the n8n "Resolve Conversation" node:
//   body:      { thread_id, customer_email }
//   200 / 201  -> { conversation_id, customer_id, customer_email, invoice_id, channel }
//   404        -> unknown sender (n8n routes to its "unknown sender" branch)
//
// Deliberately does NOT auto-create customers — unknown senders are handled by
// n8n, not silently onboarded here.
router.post("/resolve", async (req, res) => {
  try {
    const organization_id = req.body?.organization_id || req.user?.organization_id;
    const thread_id = req.body?.thread_id;
    const customer_email = extractEmail(String(req.body?.customer_email || ""));

    if (!organization_id) {
      return res.status(400).json({ error: "organization_id is required" });
    }
    if (!customer_email) {
      return res.status(400).json({ error: "customer_email is required" });
    }

    const customer = await prisma.customers.findFirst({
      where: {
        organization_id,
        email: { equals: customer_email, mode: "insensitive" },
      },
    });
    if (!customer) {
      return res.status(404).json({ error: "Unknown sender" });
    }

    // Reuse the Gmail thread if we've seen it before, else the customer's
    // latest open conversation, else create one (linking their open invoice).
    let conversation = thread_id
      ? await prisma.conversations.findFirst({
          where: { organization_id, external_thread_id: String(thread_id) },
        })
      : null;
    if (!conversation) {
      conversation = await prisma.conversations.findFirst({
        where: { organization_id, customer_id: customer.id, status: "OPEN" },
        orderBy: { created_at: "desc" },
      });
    }

    let created = false;
    if (!conversation) {
      const invoice = await prisma.invoices.findFirst({
        where: {
          organization_id,
          customer_id: customer.id,
          status: { in: ["OPEN", "PARTIALLY_PAID"] },
        },
        orderBy: { due_at: "asc" },
      });
      conversation = await prisma.conversations.create({
        data: {
          organization_id,
          customer_id: customer.id,
          invoice_id: invoice?.id ?? null,
          channel: "EMAIL",
          external_thread_id: thread_id ? String(thread_id) : null,
        },
      });
      created = true;
    } else if (thread_id && !conversation.external_thread_id) {
      conversation = await prisma.conversations.update({
        where: { id: conversation.id },
        data: { external_thread_id: String(thread_id) },
      });
    }

    return res.status(created ? 201 : 200).json({
      conversation_id: conversation.id,
      customer_id: customer.id,
      customer_email: customer.email,
      invoice_id: conversation.invoice_id,
      channel: conversation.channel,
    });
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to resolve conversation");
  }
});

// Create a conversation
router.post("/", async (req, res) => {
  try {
    const { organization_id, customer_id, invoice_id, channel, external_thread_id } = req.body;

    if (!organization_id || !customer_id || !channel) {
      return res.status(400).json({
        error: "organization_id, customer_id, and channel are required",
      });
    }

    // If an invoice is attached, it must belong to the same tenant and customer.
    if (invoice_id) {
      const invoice = await prisma.invoices.findFirst({
        where: { id: invoice_id, organization_id, customer_id },
      });
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found for this customer" });
      }
    }

    const conversation = await prisma.conversations.create({
      data: {
        organization_id,
        customer_id,
        invoice_id: invoice_id || null,
        channel,
        external_thread_id: external_thread_id || null,
      },
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to create conversation");
  }
});

// Get all conversations for an organization
router.get("/", async (req, res) => {
  try {
    const organization_id = req.query.organization_id as string;

    if (!organization_id) {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = { organization_id };
    if (status) where.status = status;

    const conversations = await prisma.conversations.findMany({
      where,
      orderBy: { updated_at: "desc" },
      skip: offset,
      take: limit,
    });

    res.setHeader("X-Total-Count", String(await prisma.conversations.count({ where })));
    return res.json(conversations);
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to fetch conversations");
  }
});

// Get one conversation (tenant-scoped)
router.get("/:id", async (req, res) => {
  try {
    const { organization_id } = req.query;
    const { id } = req.params;

    if (!organization_id || typeof organization_id !== "string") {
      return res.status(400).json({ error: "organization_id is required" });
    }
    if (!UUID_REGEX.test(organization_id)) {
      return res.status(400).json({ error: "organization_id must be a valid UUID" });
    }
    if (!UUID_REGEX.test(id)) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const details = await getConversationDetails(organization_id, id);

    if (!details) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json(details);
  } catch (error) {
    console.error(error);
    return serverError(res, error, "Failed to fetch conversation");
  }
});

export default router;
