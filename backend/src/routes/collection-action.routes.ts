import { creditedTotal, outstandingOf, settledTotals } from "../lib/invoiceBalance";
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { serverError } from "../lib/monitoring";

const router = Router();

const VALID_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];

/**
 * POST /api/collection-actions/claim-due  (alias: /claim)
 *
 * Contract used by the n8n "Claim Due Follow-ups" node:
 *   body:     { action_type?: "FOLLOW_UP_SCHEDULED", limit?: 20 }
 *   response: { claimed: [ { action_id, action_type, status, scheduled_at,
 *                            customer_name, customer_email,
 *                            invoice_number, invoice_amount,
 *                            promised_date, reply_to_message_id } ], Count }
 *
 * Atomically moves due PENDING actions to PROCESSING (SELECT ... FOR UPDATE
 * SKIP LOCKED) so two workers can never claim the same action. Returns flat
 * fields so n8n's "Build Reminder" / Gmail nodes can use them directly.
 */
router.post(["/claim", "/claim-due"], async (req: Request, res: Response): Promise<void> => {
  try {
    const organization_id = req.body?.organization_id || req.user?.organization_id;
    if (!organization_id || typeof organization_id !== "string") {
      res.status(400).json({ error: "organization_id is required" });
      return;
    }

    const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 20));
    const action_type =
      typeof req.body?.action_type === "string" && req.body.action_type
        ? req.body.action_type
        : null;
    const include_future = Boolean(req.body?.include_future);

    const claimed = await prisma.$tenantTransaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE collection_actions AS ca
        SET status = 'PROCESSING'
        FROM (
          SELECT id FROM collection_actions ca_sub
          WHERE ca_sub.organization_id = ${organization_id}::uuid
            AND ca_sub.status = 'PENDING'
            AND (${include_future}::boolean = true OR ca_sub.scheduled_at IS NULL OR ca_sub.scheduled_at <= now())
            AND (${action_type}::text IS NULL OR ca_sub.action_type = ${action_type})
            AND NOT EXISTS (
              SELECT 1 FROM suppressions s
              JOIN customers c ON c.email = s.address AND c.organization_id = s.organization_id
              WHERE c.id = ca_sub.customer_id AND s.organization_id = ca_sub.organization_id
            )
            AND NOT EXISTS (
              SELECT 1 FROM collection_actions ca_disp
              WHERE ca_disp.invoice_id = ca_sub.invoice_id
                AND ca_disp.organization_id = ca_sub.organization_id
                AND ca_disp.action_type = 'ESCALATE_DISPUTE'
                AND ca_disp.status IN ('PENDING', 'PROCESSING')
            )
          ORDER BY ca_sub.scheduled_at ASC NULLS LAST, ca_sub.created_at ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        ) AS sub
        WHERE ca.id = sub.id
        RETURNING ca.id
      `;

      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return [];

      return tx.collection_actions.findMany({
        where: { id: { in: ids } },
        include: { customers: true, invoices: true },
      });
    });

    // Resolve each action's source message -> Gmail message id, so n8n can
    // "reply" to the customer's original email.
    const sourceMessageIds = claimed
      .map((a) => (a.metadata as Record<string, unknown> | null)?.message_id)
      .filter((x): x is string => typeof x === "string");
    const sourceMessages = sourceMessageIds.length
      ? await prisma.messages.findMany({
          where: { id: { in: sourceMessageIds }, organization_id },
          select: { id: true, external_message_id: true },
        })
      : [];
    const externalById = new Map(sourceMessages.map((m) => [m.id, m.external_message_id]));

    // Fallback: If message_id wasn't in metadata or didn't have external_message_id,
    // find the latest inbound message for the conversation.
    const missingConvIds = claimed
      .filter((a) => {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        const msgId = typeof meta.message_id === "string" ? meta.message_id : null;
        return (!msgId || !externalById.get(msgId)) && a.conversation_id;
      })
      .map((a) => a.conversation_id as string);

    const convMessages = missingConvIds.length
      ? await prisma.messages.findMany({
          where: {
            conversation_id: { in: missingConvIds },
            organization_id,
            direction: "INBOUND",
            external_message_id: { not: null },
          },
          orderBy: { created_at: "desc" },
          select: { conversation_id: true, external_message_id: true },
        })
      : [];
    const externalByConv = new Map(convMessages.map((m) => [m.conversation_id, m.external_message_id]));

    const value = claimed.map((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      const directMsgId = typeof meta.message_id === "string" ? externalById.get(meta.message_id) : null;
      const convMsgId = a.conversation_id ? externalByConv.get(a.conversation_id) : null;
      const reply_to_message_id = directMsgId || convMsgId || null;

      return {
        action_id: a.id,
        action_type: a.action_type,
        status: a.status,
        scheduled_at: a.scheduled_at,
        customer_name: a.customers?.name ?? null,
        customer_email: a.customers?.email ?? null,
        invoice_number: a.invoices?.invoice_number ?? null,
        invoice_amount: a.invoices?.amount ?? null,
        promised_date: typeof meta.promised_date === "string" ? meta.promised_date : null,
        reply_to_message_id,
        ai_disclosure_footer: "This reminder was drafted by an automated assistant on behalf of the creditor. Reply directly to this message to reach a representative.",
        compliance_authorized: true,
      };
    });

    res.json({ claimed: value, count: value.length, Count: value.length });
  } catch (error) {
    console.error("Error claiming collection actions:", error);
    return serverError(res, error, "Failed to claim collection actions");
  }
});

/**
 * GET /api/collection-actions
 * List collection actions with optional filtering
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { organization_id, status, action_type, customer_id, invoice_id } = req.query;

    if (!organization_id || typeof organization_id !== "string") {
      res.status(400).json({ error: "organization_id is required" });
      return;
    }

    const filters: any = { organization_id };

    if (status && typeof status === "string") {
      filters.status = status;
    }
    if (action_type && typeof action_type === "string") {
      filters.action_type = action_type;
    }
    if (customer_id && typeof customer_id === "string") {
      filters.customer_id = customer_id;
    }
    if (invoice_id && typeof invoice_id === "string") {
      filters.invoice_id = invoice_id;
    }

    const actions = await prisma.collection_actions.findMany({
      where: filters,
      include: {
        customers: true,
        invoices: true,
      },
      orderBy: [
        { scheduled_at: "asc" },
        { created_at: "desc" },
      ],
    });

    res.json({
      value: actions,
      Count: actions.length,
    });
  } catch (error) {
    console.error("Error fetching collection actions:", error);
    return serverError(res, error, "Internal server error");
  }
});

/**
 * GET /api/collection-actions/:id
 * Retrieve a specific collection action by ID
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { organization_id } = req.query;

    if (!organization_id || typeof organization_id !== "string") {
      res.status(400).json({ error: "organization_id is required" });
      return;
    }

    const action = await prisma.collection_actions.findFirst({
      where: {
        id: id as string,
        organization_id: organization_id as string,
      },
      include: {
        customers: true,
        invoices: true,
        conversations: true,
      },
    });

    if (!action) {
      res.status(404).json({ error: "Collection action not found" });
      return;
    }

    res.json(action);
  } catch (error) {
    console.error("Error fetching collection action:", error);
    return serverError(res, error, "Internal server error");
  }
});

/**
 * PATCH /api/collection-actions/:id/status
 * Update the status of a collection action
 */
router.patch("/:id/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organization_id = req.body?.organization_id || req.user?.organization_id;
    const { status } = req.body ?? {};

    if (!organization_id || typeof organization_id !== "string") {
      res.status(400).json({ error: "organization_id is required in body" });
      return;
    }

    if (!status || typeof status !== "string" || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      return;
    }

    const action = await prisma.collection_actions.findFirst({
      where: {
        id: id as string,
        organization_id: organization_id as string,
      },
    });

    if (!action) {
      res.status(404).json({ error: "Collection action not found" });
      return;
    }

    const currentStatus = action.status;

    const validTransitions: Record<string, string[]> = {
      "PENDING": ["PROCESSING", "CANCELLED"],
      "PROCESSING": ["COMPLETED", "FAILED"],
      "COMPLETED": [],
      "FAILED": [],
      "CANCELLED": []
    };

    if (!validTransitions[currentStatus]?.includes(status as string)) {
      res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${status}` });
      return;
    }

    let executed_at = action.executed_at;

    if (status === "COMPLETED" && !executed_at) {
      executed_at = new Date();
    }

    const currentMeta = (action.metadata && typeof action.metadata === "object") ? (action.metadata as Record<string, unknown>) : {};
    const updatedMeta: Record<string, unknown> = {
      ...currentMeta,
      ...(req.body.sent_message_id ? { sent_message_id: req.body.sent_message_id } : {}),
      ...(req.body.error ? { error: req.body.error } : {}),
    };

    const updatedAction = await prisma.collection_actions.update({
      where: {
        id: id as string,
      },
      data: {
        status: status as string,
        executed_at,
        metadata: updatedMeta as object,
      },
    });

    res.json(updatedAction);
  } catch (error) {
    console.error("Error updating collection action status:", error);
    return serverError(res, error, "Internal server error");
  }
});

/**
 * POST /api/collection-actions/:id/verify-proof
 * 1-Click settlement of client payment proof (UTR / Reference).
 * Converts pending payment to SUCCEEDED, marks invoice as PAID, unlocks deliverable vault,
 * and sets action status to COMPLETED.
 */
/**
 * GET /api/collection-actions/:id/proof-image
 * Returns the payment screenshot a client attached to their proof (tenant-scoped, never cached).
 */
router.get("/:id/proof-image", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const organization_id = req.user?.organization_id;
    if (!organization_id || !/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const action = await prisma.collection_actions.findFirst({ where: { id, organization_id } });
    const meta = (action?.metadata && typeof action.metadata === "object" ? action.metadata : {}) as Record<string, unknown>;
    const paymentId = typeof meta.payment_id === "string" && /^[0-9a-f-]{36}$/i.test(meta.payment_id) ? meta.payment_id : null;
    if (!action || !paymentId) {
      res.status(404).json({ error: "No screenshot attached" });
      return;
    }
    const rows = await prisma.$queryRawUnsafe<{ mime: string; data: string }[]>(
      "SELECT mime, data FROM payment_proof_images WHERE payment_id = $1::uuid AND organization_id = $2::uuid ORDER BY created_at DESC LIMIT 1",
      paymentId, organization_id,
    );
    if (!rows.length) {
      res.status(404).json({ error: "No screenshot attached" });
      return;
    }
    res.setHeader("Content-Type", rows[0].mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.send(Buffer.from(rows[0].data, "base64"));
  } catch (error) {
    console.error("proof-image error:", error);
    return serverError(res, error, "Failed to load screenshot");
  }
});

router.post("/:id/verify-proof", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const organization_id = req.body?.organization_id || req.user?.organization_id;

    if (!organization_id || typeof organization_id !== "string") {
      res.status(400).json({ error: "organization_id is required" });
      return;
    }

    const action = await prisma.collection_actions.findFirst({
      where: {
        id,
        organization_id,
      },
      include: {
        invoices: true,
        customers: true,
      },
    });

    if (!action) {
      res.status(404).json({ error: "Collection action not found" });
      return;
    }

    if (!action.invoice_id) {
      res.status(400).json({ error: "Action is not linked to an invoice" });
      return;
    }
    const invoiceId: string = action.invoice_id;

    const meta = (action.metadata && typeof action.metadata === "object") ? (action.metadata as Record<string, unknown>) : {};
    const utr = String(meta.utr || "DIRECT_VERIFIED");
    const paymentId = meta.payment_id ? String(meta.payment_id) : null;

    const result = await prisma.$tenantTransaction(async (tx) => {
      // Row lock on invoice
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM invoices WHERE id = ${invoiceId}::uuid AND organization_id = ${organization_id}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      const inv = await tx.invoices.findFirst({
        where: { id: invoiceId, organization_id },
      });
      if (!inv) throw new Error("INVOICE_NOT_FOUND");

      // Idempotency: with the invoice locked, re-read the action. A second click (or a double submit) must not
      // record another payment.
      const current = await tx.collection_actions.findFirst({ where: { id: action.id, organization_id } });
      if (current?.status === "COMPLETED") {
        return { invoice: inv, payment: null, action: current, alreadySettled: true };
      }

      // Check for pending payment to promote to SUCCEEDED
      let payment = paymentId
        ? await tx.payments.findFirst({
            where: { id: paymentId, organization_id, status: "PENDING" },
          })
        : await tx.payments.findFirst({
            where: { invoice_id: invoiceId, organization_id, status: "PENDING" },
            orderBy: { created_at: "desc" },
          });

      if (payment) {
        payment = await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: "SUCCEEDED",
            paid_at: new Date(),
          },
        });
      } else {
        // Calculate remaining due
        const alreadyPaid = (await settledTotals(tx, organization_id, invoiceId)).settled;
        const credited = await creditedTotal(tx, organization_id, invoiceId);
        const outstanding = outstandingOf(Number(inv.amount), alreadyPaid, credited);
        // Nothing left to pay: never invent a payment for an invoice that is already settled.
        if (outstanding <= 0) {
          const closed = await tx.collection_actions.update({ where: { id: action.id }, data: { status: "COMPLETED", executed_at: new Date() } });
          return { invoice: inv, payment: null, action: closed, alreadySettled: true };
        }

        payment = await tx.payments.create({
          data: {
            organization_id,
            invoice_id: invoiceId,
            external_payment_id: utr,
            amount: outstanding,
            currency: inv.currency,
            status: "SUCCEEDED",
            paid_at: new Date(),
          },
        });
      }

      // Mark PAID only when the invoice is fully settled; a partial proof must not unlock deliverables.
      // Cash received plus any TDS the client deducted (both settle the invoice).
      const totalPaid = (await settledTotals(tx, organization_id, invoiceId)).settled;
      const creditedNow = await creditedTotal(tx, organization_id, invoiceId);
      const fullyPaid = totalPaid + creditedNow + 0.01 >= Number(inv.amount);
      const updatedInvoice = await tx.invoices.update({
        where: { id: invoiceId },
        data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID" },
      });

      // Mark action as COMPLETED
      const updatedAction = await tx.collection_actions.update({
        where: { id: action.id },
        data: {
          status: "COMPLETED",
          executed_at: new Date(),
          metadata: {
            ...meta,
            verified_at: new Date().toISOString(),
            settled_payment_id: payment.id,
          },
        },
      });

      return { invoice: updatedInvoice, payment, action: updatedAction };
    });

    if ("alreadySettled" in result && result.alreadySettled) {
      res.json({
        success: true,
        message: `This payment was already confirmed. Invoice #${result.invoice.invoice_number} is ${result.invoice.status === "PAID" ? "fully paid" : "partly paid"}; nothing was changed.`,
        ...result,
      });
      return;
    }

    res.json({
      success: true,
      message: result.invoice.status === "PAID"
        ? `Payment verified. Invoice #${result.invoice.invoice_number} is fully paid and deliverables are unlocked.`
        : `Partial payment verified for #${result.invoice.invoice_number}. Deliverables stay locked until the balance is paid.`,
      ...result,
    });
  } catch (error) {
    // The action points at an invoice this business cannot see or that is gone: an expected not-found, not a server fault.
    if (error instanceof Error && error.message === "INVOICE_NOT_FOUND") {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    console.error("Error verifying payment proof:", error);
    return serverError(res, error, "Failed to verify payment proof");
  }
});

export default router;
