import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { settledTotals } from "../lib/invoiceBalance";
import { auditLogger } from "../lib/auditLogger";
import { serverError } from "../lib/monitoring";

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/credit-notes
 * Issue an immutable, tax-compliant Credit Note against an issued invoice
 * (Under GST Section 34 / EU VAT Art. 226 / MCA Rules).
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    const { invoice_id, amount, reason } = req.body ?? {};

    if (!organization_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!invoice_id || !UUID_REGEX.test(invoice_id)) {
      return res.status(400).json({ error: "A valid invoice_id is required" });
    }

    const creditAmount = Number(amount);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!reason || typeof reason !== "string") {
      return res.status(400).json({ error: "A valid statutory reason is required for issuing a credit note" });
    }

    const result = await prisma.$tenantTransaction(async (tx) => {
      // 1. Lock the invoice row so two concurrent credit notes cannot both pass the balance check
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM invoices WHERE id = ${invoice_id}::uuid AND organization_id = ${organization_id}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new Error("INVOICE_NOT_FOUND");
      }
      const invoice = await tx.invoices.findFirst({
        where: { id: invoice_id, organization_id },
      });

      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }
      if (invoice.status === "CANCELLED") {
        throw new Error("INVOICE_CANCELLED");
      }

      // 2. Compute settled payments and existing credit notes
      // Cash + TDS deducted by the client: both settle part of the invoice.
      const totalPaid = (await settledTotals(tx, organization_id, invoice_id)).settled;

      const existingCredits = await tx.credit_notes.aggregate({
        where: { invoice_id, organization_id },
        _sum: { amount: true },
      });
      const totalCredited = Number(existingCredits._sum.amount ?? 0);

      const invoiceAmount = Number(invoice.amount);
      const remainingBalance = invoiceAmount - totalPaid - totalCredited;

      if (creditAmount > remainingBalance) {
        throw new Error("CREDIT_EXCEEDS_OUTSTANDING");
      }

      // Count existing credit notes for sequential numbering
      const count = await tx.credit_notes.count({
        where: { organization_id, invoice_id },
      });
      const creditNoteNumber = `CN-${invoice.invoice_number}-${String(count + 1).padStart(2, "0")}`;

      const creditNote = await tx.credit_notes.create({
        data: {
          organization_id,
          invoice_id,
          customer_id: invoice.customer_id,
          credit_note_number: creditNoteNumber,
          amount: creditAmount,
          currency: invoice.currency,
          reason: reason.trim().slice(0, 255),
        },
      });

      // If the remaining balance reaches zero, mark invoice resolved
      const newRemaining = remainingBalance - creditAmount;
      if (newRemaining <= 0) {
        await tx.invoices.update({
          where: { id: invoice_id },
          data: { status: "PAID" },
        });

        // Cancel any pending collection actions since balance is settled
        await tx.collection_actions.updateMany({
          where: { invoice_id, organization_id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }

      return {
        creditNote,
        remainingBalance: Math.max(0, newRemaining),
      };
    });

    auditLogger.log({
      organization_id,
      actor: { type: "USER", id: req.user?.id || "system" },
      action: "CREDIT_NOTE_ISSUED",
      resource_type: "INVOICE",
      resource_id: invoice_id,
      outcome: "SUCCESS",
      metadata: {
        credit_note_number: result.creditNote.credit_note_number,
        amount: creditAmount,
        reason,
        remainingBalance: result.remainingBalance,
      },
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVOICE_NOT_FOUND") {
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (error.message === "INVOICE_CANCELLED") {
        return res.status(409).json({ error: "Cannot issue credit note against a cancelled invoice" });
      }
      if (error.message === "CREDIT_EXCEEDS_OUTSTANDING") {
        return res.status(409).json({ error: "Credit note amount exceeds remaining invoice balance" });
      }
    }
    console.error("Credit note issue error:", error);
    return serverError(res, error, "Failed to issue credit note");
  }
});

/**
 * GET /api/credit-notes
 * List credit notes for organization, optionally filtered by invoice_id
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { invoice_id } = req.query;
    const where: Record<string, unknown> = { organization_id };
    if (invoice_id && typeof invoice_id === "string") {
      where.invoice_id = invoice_id;
    }

    const creditNotes = await prisma.credit_notes.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        invoices: { select: { invoice_number: true, amount: true, currency: true } },
        customers: { select: { name: true, email: true } },
      },
    });

    res.json(creditNotes);
  } catch (error) {
    console.error("Fetch credit notes error:", error);
    return serverError(res, error, "Failed to fetch credit notes");
  }
});

export default router;
