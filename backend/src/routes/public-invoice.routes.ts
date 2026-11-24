import { outstandingOf, settledByCredit } from "../lib/invoiceBalance";
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { getOrgSettings } from "../lib/orgSettings";
import { getDetails } from "../lib/invoiceDetails";
import { turnstileGuard } from "../lib/turnstile";
import { ensureExtraSchema, parseScreenshot } from "../lib/extraSchema";
import { serverError } from "../lib/monitoring";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_URL_RE = /^https?:\/\/[^\s"'<>]+$/i;
const STALE_LINK = "This payment link is not valid. Please ask the sender for a fresh link.";

/** Public links are keyed by the invoice's random UUID. Invoice numbers are guessable and only unique per business. */
function publicInvoiceId(param: unknown): string | null {
    const id = String(param ?? "").trim();
    return UUID_RE.test(id) ? id : null;
}

/** Deliverable links must be plain http(s) URLs so they can never execute script on the pay page. */
export function safeDeliverableUrl(external: string | null | undefined): string | null {
    const url = String(external ?? "").replace(/^vault:/, "").trim();
    return SAFE_URL_RE.test(url) ? url : null;
}

/**
 * GET /api/public/invoices/:invoice_number
 * Public endpoint for clients to view invoice details, bank instructions, and deliverable status.
 */
router.get("/:invoice_number", async (req: Request, res: Response): Promise<void> => {
    try {
        const invoiceId = publicInvoiceId(req.params.invoice_number);
        if (!invoiceId) {
            res.status(404).json({ error: STALE_LINK });
            return;
        }

        const invoice = await prisma.invoices.findFirst({
            where: { id: invoiceId },
            include: {
                customers: true,
                organizations: true,
                payments: {
                    where: { status: "SUCCEEDED" },
                    orderBy: { created_at: "desc" },
                },
                credit_notes: { select: { amount: true } },
            },
        });

        if (!invoice || invoice.status === "DRAFT") {
            res.status(404).json({ error: "Invoice not found or link has expired." });
            return;
        }

        const paidAmount = invoice.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const invoiceAmount = Number(invoice.amount);
        const creditedAmount = invoice.credit_notes.reduce((acc, c) => acc + Number(c.amount), 0);
        // Credit notes reduce what is owed, so the client is never asked for more than they owe.
        const outstandingAmount = outstandingOf(invoiceAmount, paidAmount, creditedAmount);

        // Check for deliverable vault URL in external_invoice_id
        let deliverableUrl: string | null = null;
        let hasDeliverable = false;
        const external = invoice.external_invoice_id || "";

        const safeUrl = safeDeliverableUrl(external);
        if (safeUrl) {
            hasDeliverable = true;
            if (invoice.status === "PAID" || outstandingAmount <= 0) {
                deliverableUrl = safeUrl;
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

        const settings = await getOrgSettings(invoice.organization_id);
        const details = await getDetails(invoice.id);

        // Record a view, but not for link-preview bots (WhatsApp, Slack, crawlers) and at most once per 30 minutes.
        const ua = String(req.headers["user-agent"] || "");
        if (!/bot|crawl|spider|preview|whatsapp|facebookexternalhit|slack|telegram|curl|wget|headless|lighthouse/i.test(ua)) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO invoice_views (organization_id, invoice_id)
                 SELECT $1::uuid, $2::uuid
                 WHERE NOT EXISTS (SELECT 1 FROM invoice_views WHERE invoice_id = $2::uuid AND viewed_at > now() - interval '30 minutes')`,
                invoice.organization_id,
                invoice.id,
            ).catch((e) => console.warn("view tracking skipped:", (e as Error).message));
        }
        const hasBank = Boolean(settings.bank_account_number && settings.bank_ifsc);

        res.json({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: invoiceAmount,
            paid_amount: paidAmount,
            credited_amount: creditedAmount,
            settled_by_credit: settledByCredit(invoice.status, invoiceAmount, paidAmount, creditedAmount),
            outstanding_amount: outstandingAmount,
            currency: invoice.currency,
            issued_at: invoice.issued_at,
            due_at: invoice.due_at,
            status: invoice.status,
            customer: {
                name: invoice.customers.name,
                company_name: invoice.customers.company_name,
                email: null,
                phone: null,
            },
            organization: {
                name: invoice.organizations.name,
                slug: invoice.organizations.slug,
                brand_color: settings.brand_color,
                logo_data: settings.logo_data,
                gstin: settings.gstin,
            },
            details: details ? { items: details.items, notes: details.notes, tax_mode: details.tax_mode, tax_percent: details.tax_percent, totals: details.totals } : null,
            payment: {
                upi_id: settings.upi_id,
                payee_name: settings.payee_name || invoice.organizations.name,
                bank: hasBank
                    ? {
                          account_name: settings.bank_account_name || settings.payee_name || invoice.organizations.name,
                          account_number: settings.bank_account_number,
                          ifsc: settings.bank_ifsc,
                          bank_name: settings.bank_name,
                      }
                    : null,
            },
            has_deliverable: hasDeliverable,
            deliverable_url: deliverableUrl,
            deliverable_locked: hasDeliverable && !deliverableUrl,
            pending_verification: Boolean(pendingPayment),
            pending_utr: pendingPayment?.external_payment_id || null,
        });
    } catch (error) {
        console.error("Public invoice lookup error:", error);
        return serverError(res, error, "Failed to load invoice.");
    }
});

/**
 * POST /api/public/invoices/:invoice_number/submit-proof
 * Public endpoint for clients to submit their UTR / payment reference.
 */
router.post("/:invoice_number/submit-proof", turnstileGuard, async (req: Request, res: Response): Promise<void> => {
    try {
        const invoiceId = publicInvoiceId(req.params.invoice_number);
        const { utr, amount, notes, paid_at } = req.body ?? {};
        const screenshot = parseScreenshot(req.body?.screenshot);
        if (screenshot && "error" in screenshot) {
            res.status(400).json({ error: screenshot.error });
            return;
        }

        if (!invoiceId) {
            res.status(404).json({ error: STALE_LINK });
            return;
        }
        const cleanUtr = String(utr ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9]{6,30}$/.test(cleanUtr)) {
            res.status(400).json({ error: "Enter the UTR / transaction reference exactly as shown in your banking app (letters and numbers only)." });
            return;
        }
        if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 500)) {
            res.status(400).json({ error: "Notes must be under 500 characters." });
            return;
        }
        const paidAt = paid_at ? new Date(paid_at) : new Date();
        if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86_400_000) {
            res.status(400).json({ error: "Invalid payment date." });
            return;
        }

        const invoice = await prisma.invoices.findFirst({
            where: { id: invoiceId },
            include: {
                customers: true,
                organizations: true,
                payments: { where: { status: "SUCCEEDED" } },
                credit_notes: { select: { amount: true } },
            },
        });

        if (!invoice) {
            res.status(404).json({ error: "Invoice not found." });
            return;
        }

        const paidAmount = invoice.payments.reduce((acc, p) => acc + Number(p.amount), 0);
        const creditedAmount = invoice.credit_notes.reduce((acc, c) => acc + Number(c.amount), 0);
        const outstandingAmount = outstandingOf(Number(invoice.amount), paidAmount, creditedAmount);
        if (invoice.status === "PAID" || invoice.status === "CANCELLED" || outstandingAmount <= 0) {
            res.status(409).json({ error: "This invoice is already settled." });
            return;
        }
        const reportedAmount = amount === undefined || amount === null || amount === "" ? outstandingAmount : Number(amount);
        if (!Number.isFinite(reportedAmount) || reportedAmount <= 0 || reportedAmount > outstandingAmount + 0.01) {
            res.status(400).json({ error: `Amount must be between 1 and the outstanding ${outstandingAmount}.` });
            return;
        }
        // Anti-spam: cap unverified proofs per invoice, and reject duplicate UTRs.
        const pending = await prisma.payments.findMany({
            where: { invoice_id: invoice.id, status: "PENDING" },
            select: { external_payment_id: true },
        });
        if (pending.some((p) => (p.external_payment_id || "").toUpperCase() === cleanUtr)) {
            res.status(409).json({ error: "This UTR has already been submitted and is awaiting verification." });
            return;
        }
        if (pending.length >= 3) {
            res.status(429).json({ error: "Several payment proofs are already awaiting verification for this invoice. Please wait for the sender to confirm." });
            return;
        }

        // 1. Create or update pending payment record
        const payment = await prisma.payments.create({
            data: {
                organization_id: invoice.organization_id,
                invoice_id: invoice.id,
                amount: reportedAmount,
                currency: invoice.currency,
                status: "PENDING",
                external_payment_id: cleanUtr,
                paid_at: paidAt,
            },
        });

        if (screenshot && !("error" in screenshot)) {
            await ensureExtraSchema();
            await prisma.$executeRawUnsafe(
                "INSERT INTO payment_proof_images (organization_id, payment_id, mime, data) VALUES ($1::uuid, $2::uuid, $3, $4)",
                invoice.organization_id, payment.id, screenshot.mime, screenshot.base64,
            );
        }

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
                    has_screenshot: Boolean(screenshot),
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
        return serverError(res, error, "Failed to submit payment confirmation.");
    }
});

export default router;
