import { Router } from "express";
import prisma from "../lib/prisma";
import { getInvoiceDetails } from "../services/invoiceService";

const router = Router();

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

        if (
            !organization_id ||
            !customer_id ||
            !invoice_number ||
            amount === undefined ||
            !issued_at ||
            !due_at
        ) {
            return res.status(400).json({
                error:
                    "organization_id, customer_id, invoice_number, amount, issued_at and due_at are required",
            });
        }

        // Make sure the customer belongs to this organization
        const customer = await prisma.customers.findFirst({
            where: {
                id: customer_id,
                organization_id,
            },
        });

        if (!customer) {
            return res.status(404).json({
                error: "Customer not found in this organization",
            });
        }

        const invoice = await prisma.invoices.create({
            data: {
                organization_id,
                customer_id,
                invoice_number,
                external_invoice_id,
                amount,
                currency: currency || "INR",
                issued_at: new Date(issued_at),
                due_at: new Date(due_at),
                status: status || "OPEN",
            },
        });

        res.status(201).json(invoice);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to create invoice",
        });
    }
});

// Get invoices
router.get("/", async (req, res) => {
    try {
        const { organization_id, status } = req.query;

        if (!organization_id) {
            return res.status(400).json({
                error: "organization_id is required",
            });
        }

        const invoices = await prisma.invoices.findMany({
            where: {
                organization_id: String(organization_id),
                ...(status ? { status: String(status) } : {}),
            },
            orderBy: {
                created_at: "desc",
            },
            include: {
                customers: true,
            },
        });

        res.json(invoices);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch invoices",
        });
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