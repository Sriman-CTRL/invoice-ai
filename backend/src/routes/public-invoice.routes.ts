import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

/**
 * GET /api/public/invoices/:invoice_number
 * Public endpoint for clients to view invoice details, bank instructions, and deliverable status.
 */
router.get("/:invoice_number", async (req: Request, res: Response): Promise<void> => {
    try {
        const { invoice_number } = req.params;
        if (!invoice_number) {
            res.status(400).json({ error: "Invoice number is required" });
            return;
        }

        const orgSlug = typeof req.query.org === "string" ? req.query.org.trim() : null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice_number);
        const whereClause: any = isUuid
            ? { id: invoice_number }
            : { invoice_number: { equals: invoice_number, mode: "insensitive" } };

        if (orgSlug) {
            whereClause.organizations = { slug: orgSlug };
        }

        const invoice = await prisma.invoices.findFirst({
            where: whereClause,
            orderBy: { created_at: "desc" },
            include: {
                customers: true,
                organizations: true,
                payments: {
                    where: { status: "SUCCEEDED" },
                    orderBy: { created_at: "desc" },
                },
            },
        });

        if (!invoice) {
            res.status(404).json({ error: "Invoice not found or link has expired." });
            return;
        }

        const paidAmount = invoice.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const invoiceAmount = Number(invoice.amount);
        const outstandingAmount = Math.max(0, invoiceAmount - paidAmount);

        // Check for deliverable vault URL in external_invoice_id
        let deliverableUrl: string | null = null;
        let hasDeliverable = false;
        const external = invoice.external_invoice_id || "";

        if (external.startsWith("http://") || external.startsWith("https://") || external.startsWith("vault:")) {
            hasDeliverable = true;
            if (invoice.status === "PAID" || outstandingAmount <= 0) {
                deliverableUrl = external.replace(/^vault:/, "");
            }
        }

        // Check if there are any pending proof submissions
        const pendingPayment = await prisma.payments.findFirst({
            where: {
                invoice_id: invoice.id,
                status: "PENDING",
            },
            orderBy: { created_at: "desc" },
        });

        res.json({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: invoiceAmount,
            paid_amount: paidAmount,
            outstanding_amount: outstandingAmount,
            currency: invoice.currency,
            issued_at: invoice.issued_at,
            due_at: invoice.due_at,
            status: invoice.status,
            customer: {
                name: invoice.customers.name,
                company_name: invoice.customers.company_name,
                email: invoice.customers.email,
                phone: invoice.customers.phone,
            },
            organization: {
                name: invoice.organizations.name,
                slug: invoice.organizations.slug,
            },
            has_deliverable: hasDeliverable,
            deliverable_url: deliverableUrl,
            deliverable_locked: hasDeliverable && !deliverableUrl,
            pending_verification: Boolean(pendingPayment),
            pending_utr: pendingPayment?.external_payment_id || null,
        });
    } catch (error) {
        console.error("Public invoice lookup error:", error);
        res.status(500).json({ error: "Failed to load invoice." });
    }
});

/**
 * POST /api/public/invoices/:invoice_number/submit-proof
 * Public endpoint for clients to submit their UTR / payment reference.
 */
router.post("/:invoice_number/submit-proof", async (req: Request, res: Response): Promise<void> => {
    try {
        const { invoice_number } = req.params;
        const { utr, amount, notes, paid_at } = req.body ?? {};

        if (!invoice_number || !utr || String(utr).trim().length === 0) {
            res.status(400).json({ error: "Invoice number and UTR / Reference ID are required." });
            return;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice_number);
        const whereClause: any = isUuid
            ? { id: invoice_number }
            : { invoice_number: { equals: invoice_number, mode: "insensitive" } };

        const invoice = await prisma.invoices.findFirst({
            where: whereClause,
            orderBy: { created_at: "desc" },
            include: {
                customers: true,
                organizations: true,
                payments: { where: { status: "SUCCEEDED" } },
            },
        });

        if (!invoice) {
            res.status(404).json({ error: "Invoice not found." });
            return;
        }

        const paidAmount = invoice.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const outstandingAmount = Math.max(0, Number(invoice.amount) - paidAmount);
        const reportedAmount = Number(amount) > 0 ? Number(amount) : outstandingAmount;
        const cleanUtr = String(utr).trim();

        // 1. Create or update pending payment record
        const payment = await prisma.payments.create({
            data: {
                organization_id: invoice.organization_id,
                invoice_id: invoice.id,
                amount: reportedAmount,
                currency: invoice.currency,
                status: "PENDING",
                external_payment_id: cleanUtr,
                paid_at: paid_at ? new Date(paid_at) : new Date(),
            },
        });

        // 2. Ensure conversation thread exists
        let conversation = await prisma.conversations.findFirst({
            where: {
                organization_id: invoice.organization_id,
                customer_id: invoice.customer_id,
                invoice_id: invoice.id,
            },
        });

        if (!conversation) {
            conversation = await prisma.conversations.create({
                data: {
                    organization_id: invoice.organization_id,
                    customer_id: invoice.customer_id,
                    invoice_id: invoice.id,
                    channel: "PORTAL",
                    status: "OPEN",
                },
            });
        }

        // 3. Log inbound notification message
        await prisma.messages.create({
            data: {
                organization_id: invoice.organization_id,
                conversation_id: conversation.id,
                direction: "INBOUND",
                channel: "PORTAL",
                sender: invoice.customers.email,
                recipient: `billing@${invoice.organizations.slug}.com`,
                subject: `Payment Submitted: UTR ${cleanUtr}`,
                body: `Customer submitted payment proof via checkout portal:\n- Amount: ${invoice.currency} ${reportedAmount}\n- UTR / Ref: ${cleanUtr}${notes ? `\n- Customer Notes: ${notes}` : ""}\n\nPlease verify your bank statement to confirm settlement.`,
                ai_intent: "PAYMENT_PROMISED",
                ai_confidence: 1.0,
            },
        });

        // 4. Create collection action for admin review
        const action = await prisma.collection_actions.create({
            data: {
                organization_id: invoice.organization_id,
                customer_id: invoice.customer_id,
                invoice_id: invoice.id,
                conversation_id: conversation.id,
                action_type: "VERIFY_PAYMENT_PROOF",
                status: "PENDING",
                scheduled_at: new Date(),
                metadata: {
                    payment_id: payment.id,
                    utr: cleanUtr,
                    amount: reportedAmount,
                    customer_notes: notes || null,
                },
            },
        });

        res.status(200).json({
            success: true,
            message: "Payment reference submitted successfully. The billing team has been notified to verify and settle.",
            payment_id: payment.id,
            action_id: action.id,
        });
    } catch (error) {
        console.error("Submit payment proof error:", error);
        res.status(500).json({ error: "Failed to submit payment confirmation." });
    }
});

export default router;
