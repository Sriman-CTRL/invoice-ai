import { Router } from "express";
import prisma from "../lib/prisma";
import { getInvoiceDetails } from "../services/invoiceService";
import { checkPlanLimit } from "../lib/orgSettings";
import { safeDeliverableUrl } from "./public-invoice.routes";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICE_STATUSES = ["OPEN", "PAID", "PARTIALLY_PAID", "CANCELLED", "DRAFT"];

function parseFlexibleDate(dateStr: unknown): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (!s) return null;

    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct;

    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        const [, day, month, year] = dmy;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

// Bulk Import Invoices from CSV / JSON
router.post("/bulk-import", async (req, res) => {
    try {
        const organization_id = String(req.body?.organization_id || req.user?.organization_id || "");
        if (!organization_id || !UUID_REGEX.test(organization_id)) {
            return res.status(400).json({ error: "Valid organization_id is required" });
        }

        const rawInvoices = req.body?.invoices;
        if (!Array.isArray(rawInvoices) || rawInvoices.length === 0) {
            return res.status(400).json({ error: "invoices must be a non-empty array" });
        }

        if (rawInvoices.length > 500) {
            return res.status(400).json({ error: "Batch limit is 500 invoices per import" });
        }

        const limitError = await checkPlanLimit(organization_id, rawInvoices.length);
        if (limitError) return res.status(402).json({ error: limitError });

        let imported_count = 0;
        let customers_created = 0;
        let skipped_count = 0;
        const errors: string[] = [];

        // Preload existing customers for this org
        const existingCustomers = await prisma.customers.findMany({
            where: { organization_id },
        });
        const customerMap = new Map<string, string>();
        for (const c of existingCustomers) {
            customerMap.set(c.email.toLowerCase().trim(), c.id);
        }

        // Preload existing invoice numbers for this org to avoid duplicate key conflicts
        const existingInvoices = await prisma.invoices.findMany({
            where: { organization_id },
            select: { invoice_number: true },
        });
        const existingInvoiceNumbers = new Set(existingInvoices.map((i) => i.invoice_number.toLowerCase().trim()));

        for (let i = 0; i < rawInvoices.length; i++) {
            const row = rawInvoices[i];
            const rowNum = i + 1;

            const invoiceNumber = String(row.invoice_number || "").trim();
            if (!invoiceNumber) {
                errors.push(`Row ${rowNum}: invoice_number is required`);
                continue;
            }

            if (existingInvoiceNumbers.has(invoiceNumber.toLowerCase())) {
                skipped_count++;
                continue;
            }

            const rawAmount = Number(row.amount);
            if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
                errors.push(`Row ${rowNum} (${invoiceNumber}): amount must be a positive number`);
                continue;
            }

            const dueDate = parseFlexibleDate(row.due_at);
            if (!dueDate) {
                errors.push(`Row ${rowNum} (${invoiceNumber}): valid due_at date is required`);
                continue;
            }

            const issuedDate = parseFlexibleDate(row.issued_at) || new Date();

            const customerEmail = String(row.customer_email || "").trim().toLowerCase();
            const customerName = String(row.customer_name || row.company_name || customerEmail.split("@")[0] || "Customer").trim();

            if (!customerEmail || !customerEmail.includes("@")) {
                errors.push(`Row ${rowNum} (${invoiceNumber}): valid customer_email is required`);
                continue;
            }

            let customerId = customerMap.get(customerEmail);
            if (!customerId) {
                try {
                    const newCustomer = await prisma.customers.create({
                        data: {
                            organization_id,
                            name: customerName,
                            email: customerEmail,
                            company_name: row.company_name ? String(row.company_name).trim() : null,
                            phone: row.customer_phone || row.phone ? String(row.customer_phone || row.phone).trim() : null,
                        },
                    });
                    customerId = newCustomer.id;
                    customerMap.set(customerEmail, customerId);
                    customers_created++;
                } catch (err) {
                    errors.push(`Row ${rowNum}: failed to create customer for ${customerEmail}`);
                    continue;
                }
            }

            const normalizedStatus = row.status && INVOICE_STATUSES.includes(String(row.status).toUpperCase())
                ? String(row.status).toUpperCase()
                : "OPEN";

            try {
                await prisma.invoices.create({
                    data: {
                        organization_id,
                        customer_id: customerId,
                        invoice_number: invoiceNumber,
                        external_invoice_id: row.external_invoice_id ? String(row.external_invoice_id).trim() : null,
                        amount: rawAmount,
                        currency: String(row.currency || "INR").trim().toUpperCase().slice(0, 3),
                        issued_at: issuedDate,
                        due_at: dueDate,
                        status: normalizedStatus,
                    },
                });
                existingInvoiceNumbers.add(invoiceNumber.toLowerCase());
                imported_count++;
            } catch (err) {
                errors.push(`Row ${rowNum} (${invoiceNumber}): failed to save invoice`);
            }
        }

        return res.status(200).json({
            imported_count,
            customers_created,
            skipped_count,
            errors,
        });
    } catch (error) {
        console.error("Bulk import error:", error);
        return res.status(500).json({ error: "Failed to process bulk import" });
    }
});

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

        const limitError = await checkPlanLimit(organization_id);
        if (limitError) return res.status(402).json({ error: limitError });

        if (typeof external_invoice_id === "string" && external_invoice_id.startsWith("vault:") && !safeDeliverableUrl(external_invoice_id)) {
            return res.status(400).json({ error: "Deliverable link must be a normal https:// web address." });
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

// Send Official Payment Reminder
router.post("/:id/send-reminder", async (req, res) => {
    try {
        const organization_id = String(req.body?.organization_id || req.user?.organization_id || "");
        const { id } = req.params;
        const { subject, body, channel = "EMAIL" } = req.body ?? {};

        if (!organization_id || !UUID_REGEX.test(organization_id)) {
            return res.status(400).json({ error: "Valid organization_id is required" });
        }
        if (!UUID_REGEX.test(id)) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        const invoice = await prisma.invoices.findFirst({
            where: { id, organization_id },
            include: { customers: true, organizations: true },
        });

        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found" });
        }

        // Check suppressions (CAN-SPAM / Reg F opt-outs)
        const isSuppressed = await prisma.suppressions.findFirst({
            where: {
                organization_id,
                address: invoice.customers.email.toLowerCase(),
            },
        });

        if (isSuppressed) {
            return res.status(403).json({
                error: `Outreach blocked: Customer email ${invoice.customers.email} has opted out of communications (${isSuppressed.reason}).`,
                suppressed: true,
            });
        }

        // Find or create conversation
        let conversation = await prisma.conversations.findFirst({
            where: {
                organization_id,
                customer_id: invoice.customer_id,
                invoice_id: invoice.id,
            },
            orderBy: { created_at: "desc" },
        });

        if (!conversation) {
            conversation = await prisma.conversations.create({
                data: {
                    organization_id,
                    customer_id: invoice.customer_id,
                    invoice_id: invoice.id,
                    channel,
                    status: "OPEN",
                },
            });
        }

        const reminderSubject = subject || `Payment Reminder: Invoice ${invoice.invoice_number} is past due`;
        const reminderBody =
            body ||
            `Dear ${invoice.customers.name},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number} for ${invoice.currency} ${invoice.amount} is currently outstanding. Please process payment at your earliest convenience.\n\nThank you,\n${invoice.organizations.name}`;

        // Create outbound message in timeline
        const message = await prisma.messages.create({
            data: {
                organization_id,
                conversation_id: conversation.id,
                direction: "OUTBOUND",
                channel,
                sender: `billing@${invoice.organizations.slug}.com`,
                recipient: invoice.customers.email,
                subject: reminderSubject,
                body: reminderBody,
            },
        });

        // Record completed collection action
        const action = await prisma.collection_actions.create({
            data: {
                organization_id,
                customer_id: invoice.customer_id,
                invoice_id: invoice.id,
                conversation_id: conversation.id,
                action_type: "PAYMENT_REMINDER",
                status: "COMPLETED",
                scheduled_at: new Date(),
                executed_at: new Date(),
                metadata: {
                    sent_message_id: message.id,
                    channel,
                    recipient: invoice.customers.email,
                },
            },
        });

        return res.status(200).json({
            success: true,
            message,
            collection_action: action,
        });
    } catch (error) {
        console.error("Error sending reminder:", error);
        return res.status(500).json({ error: "Failed to send reminder" });
    }
});

export default router;