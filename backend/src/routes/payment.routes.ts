import { Router } from "express";
import prisma from "../lib/prisma";
import { auditLogger } from "../lib/auditLogger";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = ["SUCCEEDED", "PENDING", "FAILED"] as const;

/**
 * Create a payment.
 *
 * Financial-correctness rules:
 *  - invoice status is derived ONLY from SUCCEEDED payments (a PENDING/FAILED
 *    payment must never mark an invoice PAID).
 *  - the invoice row is locked (SELECT ... FOR UPDATE) so two concurrent
 *    payments cannot both pass the over-payment check.
 *  - amount is validated as a positive number, currency is normalized.
 */
router.post("/", async (req, res) => {
  try {
    const {
      organization_id,
      invoice_id,
      external_payment_id,
      amount,
      currency,
      status,
      paid_at,
    } = req.body;

    if (!organization_id || !invoice_id) {
      return res.status(400).json({ error: "organization_id and invoice_id are required" });
    }

    if (!UUID_REGEX.test(organization_id)) {
      return res.status(400).json({ error: "organization_id must be a valid UUID" });
    }
    if (!UUID_REGEX.test(invoice_id)) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const paymentStatus = status ? String(status).toUpperCase() : "SUCCEEDED";
    if (!ALLOWED_STATUSES.includes(paymentStatus as (typeof ALLOWED_STATUSES)[number])) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` });
    }

    const result = await prisma.$tenantTransaction(async (tx) => {
      // Row-level lock: serializes payments against the same invoice.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM invoices WHERE id = ${invoice_id}::uuid AND organization_id = ${organization_id}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      const invoice = await tx.invoices.findFirst({
        where: { id: invoice_id, organization_id },
      });
      if (!invoice) throw new Error("INVOICE_NOT_FOUND");
      if (invoice.status === "CANCELLED") throw new Error("INVOICE_CANCELLED");
      if (invoice.status === "PAID") throw new Error("INVOICE_ALREADY_PAID");

      // Only SUCCEEDED payments count toward the balance.
      const settled = await tx.payments.aggregate({
        where: { invoice_id, organization_id, status: "SUCCEEDED" },
        _sum: { amount: true },
      });
      const alreadyPaid = Number(settled._sum.amount ?? 0);
      const invoiceAmount = Number(invoice.amount);

      if (alreadyPaid + paymentAmount > invoiceAmount) {
        throw new Error("PAYMENT_EXCEEDS_INVOICE");
      }

      const payment = await tx.payments.create({
        data: {
          organization_id,
          invoice_id,
          external_payment_id: external_payment_id || null,
          amount: paymentAmount,
          currency: currency || invoice.currency,
          status: paymentStatus,
          paid_at: paid_at ? new Date(paid_at) : new Date(),
        },
      });

      // Invoice status only moves for money that actually settled.
      let newInvoiceStatus = invoice.status;
      if (paymentStatus === "SUCCEEDED") {
        const newPaidAmount = alreadyPaid + paymentAmount;
        if (newPaidAmount >= invoiceAmount) {
          newInvoiceStatus = "PAID";
        } else if (newPaidAmount > 0) {
          newInvoiceStatus = "PARTIALLY_PAID";
        }
      }

      const updatedInvoice = await tx.invoices.update({
        where: { id: invoice_id },
        data: { status: newInvoiceStatus },
      });

      return {
        payment,
        invoice: updatedInvoice,
        totalPaid: alreadyPaid + (paymentStatus === "SUCCEEDED" ? paymentAmount : 0),
      };
    });

    auditLogger.log({
      organization_id,
      actor: { type: "USER", id: req.user?.id || "system" },
      action: "PAYMENT_SETTLED",
      resource_type: "INVOICE",
      resource_id: invoice_id,
      outcome: "SUCCESS",
      ip_address: req.ip,
      metadata: {
        payment_id: result.payment.id,
        amount: paymentAmount,
        currency: result.payment.currency,
        new_invoice_status: result.invoice.status,
      },
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      const map: Record<string, [number, string]> = {
        INVOICE_NOT_FOUND: [404, "Invoice not found"],
        INVOICE_CANCELLED: [409, "Cannot pay a cancelled invoice"],
        INVOICE_ALREADY_PAID: [409, "Invoice is already paid"],
        PAYMENT_EXCEEDS_INVOICE: [409, "Payment exceeds remaining invoice balance"],
      };
      const entry = map[error.message];
      if (entry) return res.status(entry[0]).json({ error: entry[1] });
    }

    res.status(500).json({ error: "Failed to create payment" });
  }
});

// Get payments for an organization
router.get("/", async (req, res) => {
  try {
    const { organization_id, invoice_id } = req.query;

    if (!organization_id) {
      return res.status(400).json({ error: "organization_id is required" });
    }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const where: Record<string, unknown> = { organization_id: String(organization_id) };
    if (invoice_id) where.invoice_id = String(invoice_id);

    const payments = await prisma.payments.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
    });

    res.setHeader("X-Total-Count", String(await prisma.payments.count({ where })));
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

export default router;
