import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// Create a payment
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

    if (
      !organization_id ||
      !invoice_id ||
      amount === undefined ||
      amount <= 0
    ) {
      return res.status(400).json({
        error:
          "organization_id, invoice_id and a positive amount are required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Make sure invoice belongs to organization
      const invoice = await tx.invoices.findFirst({
        where: {
          id: invoice_id,
          organization_id,
        },
      });

      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      if (invoice.status === "CANCELLED") {
        throw new Error("INVOICE_CANCELLED");
      }

      if (invoice.status === "PAID") {
        throw new Error("INVOICE_ALREADY_PAID");
      }

      // Calculate already successful payments
      const existingPayments = await tx.payments.aggregate({
        where: {
          invoice_id,
          organization_id,
          status: "SUCCEEDED",
        },
        _sum: {
          amount: true,
        },
      });

      const alreadyPaid = Number(existingPayments._sum.amount ?? 0);
      const paymentAmount = Number(amount);
      const invoiceAmount = Number(invoice.amount);

      if (alreadyPaid + paymentAmount > invoiceAmount) {
        throw new Error("PAYMENT_EXCEEDS_INVOICE");
      }

      const payment = await tx.payments.create({
        data: {
          organization_id,
          invoice_id,
          external_payment_id,
          amount: paymentAmount,
          currency: currency || invoice.currency,
          status: status || "SUCCEEDED",
          paid_at: paid_at ? new Date(paid_at) : new Date(),
        },
      });

      const newPaidAmount = alreadyPaid + paymentAmount;

      let newInvoiceStatus = invoice.status;

      if (newPaidAmount >= invoiceAmount) {
        newInvoiceStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newInvoiceStatus = "PARTIALLY_PAID";
      }

      const updatedInvoice = await tx.invoices.update({
        where: {
          id: invoice_id,
        },
        data: {
          status: newInvoiceStatus,
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
        totalPaid: newPaidAmount,
      };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      if (error.message === "INVOICE_NOT_FOUND") {
        return res.status(404).json({
          error: "Invoice not found",
        });
      }

      if (error.message === "INVOICE_CANCELLED") {
        return res.status(409).json({
          error: "Cannot pay a cancelled invoice",
        });
      }

      if (error.message === "INVOICE_ALREADY_PAID") {
        return res.status(409).json({
          error: "Invoice is already paid",
        });
      }

      if (error.message === "PAYMENT_EXCEEDS_INVOICE") {
        return res.status(409).json({
          error: "Payment exceeds remaining invoice balance",
        });
      }
    }

    res.status(500).json({
      error: "Failed to create payment",
    });
  }
});

// Get payments for an organization
router.get("/", async (req, res) => {
  try {
    const { organization_id, invoice_id } = req.query;

    if (!organization_id) {
      return res.status(400).json({
        error: "organization_id is required",
      });
    }

    const payments = await prisma.payments.findMany({
      where: {
        organization_id: String(organization_id),
        ...(invoice_id
          ? {
              invoice_id: String(invoice_id),
            }
          : {}),
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.json(payments);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch payments",
    });
  }
});

export default router;