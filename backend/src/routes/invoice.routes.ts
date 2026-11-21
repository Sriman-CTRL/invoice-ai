import { Router } from "express";
import prisma from "../lib/prisma";
import { getInvoiceDetails } from "../services/invoiceService";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICE_STATUSES = ["OPEN", "PAID", "PARTIALLY_PAID", "CANCELLED", "DRAFT"];

// Create invoice
router.post("/", async (req, res) => {
    try {
        const {
            organization_id,
            customer_id,
            invoice_number,
            external_invoice_id,
            amount,
            currency,
            issued_at,
            due_at,
            status,
        } = req.body;

        if (!organization_id || !customer_id || !invoice_number || amount === undefined || !issued_at || !due_at) {
            return res.status(400).json({
                error: "organization_id, customer_id, invoice_number, amount, issued_at and due_at are required",
            });
        }

        if (!UUID_REGEX.test(organization_id) || !UUID_REGEX.test(customer_id)) {
            return res.status(400).json({ error: "Invalid organization_id or customer_id" });
        }

        const invoiceAmount = Number(amount);
        if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
            return res.status(400).json({ error: "amount must be a positive number" });
        }

        const issuedDate = new Date(issued_at);
        const dueDate = new Date(due_at);
        if (isNaN(issuedDate.getTime()) || isNaN(dueDate.getTime())) {
            return res.status(400).json({ error: "issued_at and due_at must be valid dates" });
        }

        const normalizedStatus = status ? String(status).toUpperCase() : "OPEN";
        if (!INVOICE_STATUSES.includes(normalizedStatus)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${INVOICE_STATUSES.join(", ")}` });
        }

        // Make sure the customer belongs to this organization
        const customer = await prisma.customers.findFirst({
            where: { id: customer_id, organization_id },
        });

        if (!customer) {
            return res.status(404).json({ error: "Customer not found in this organization" });
        }

        const invoice = await prisma.invoices.create({
            data: {
                organization_id,
                customer_id,
                invoice_number,
                external_invoice_id,
                amount: invoiceAmount,
                currency: currency || "INR",
                issued_at: issuedDate,
                due_at: dueDate,
                status: normalizedStatus,
            },
        });

        res.status(201).json(invoice);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create invoice" });
    }
});

// Get invoices
router.get("/", async (req, res) => {
    try {
        const { organization_id, status } = req.query;

        if (!organization_id) {
            return res.status(400).json({ error: "organization_id is required" });
        }

        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
        const offset = Math.max(0, Number(req.query.offset) || 0);

        const where: Record<string, unknown> = { organization_id: String(organization_id) };
        if (status) where.status = String(status);

        const invoices = await prisma.invoices.findMany({
            where,
            orderBy: { created_at: "desc" },
            skip: offset,
            take: limit,
            include: { customers: true },
        });

        res.setHeader("X-Total-Count", String(await prisma.invoices.count({ where })));
        res.json(invoices);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
});

// Get single invoice
router.get("/:id", async (req, res) => {
    try {
        const { organization_id } = req.query;
        const { id } = req.params;

        if (!organization_id || typeof organization_id !== "string") {
            return res.status(400).json({
                error: "organization_id is required",
            });
        }

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(organization_id)) {
            return res.status(400).json({ error: "organization_id must be a valid UUID" });
        }
        if (!UUID_REGEX.test(id)) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        const details = await getInvoiceDetails(organization_id, id);

        if (!details) {
            return res.status(404).json({
                error: "Invoice not found",
            });
        }

        res.json(details);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch invoice",
        });
    }
});

export default router;