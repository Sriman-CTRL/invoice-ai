import prisma from "../lib/prisma";
import type { ClassificationResult, MessageIntent } from "./ai/types";

/**
 * Deterministic collection action engine.
 *
 * The AI determines INTENT.
 * This engine determines ACTION.
 *
 * Financial state (invoice.status) is NEVER changed here based on AI output alone.
 * Only actual payment records can update invoice status (see payment.routes.ts).
 */

// How many recent collection actions to check before creating a duplicate
const DUPLICATE_WINDOW_STATUSES = ["PENDING", "PROCESSING"];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionEngineInput {
    organization_id: string;
    customer_id: string;
    invoice_id: string | null;
    conversation_id: string;
    message_id: string;
    classification: ClassificationResult;
}

export interface ActionEngineResult {
    action_created: boolean;
    action_type: string | null;
    collection_action_id: string | null;
    skipped_reason: string | null;
    payment_verification?: PaymentVerificationResult;
}

export interface PaymentVerificationResult {
    invoice_amount: number;
    total_paid: number;
    remaining: number;
    status: "FULLY_PAID" | "PARTIALLY_PAID" | "NOT_PAID";
    invoice_status: string;
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

/**
 * Evaluate a classification result and deterministically decide what
 * collection_action to create (if any).
 *
 * Idempotency: If a PENDING or PROCESSING action of the same type already
 * exists for this (organization, conversation, action_type) combination,
 * a new one is NOT created.
 */
export async function runCollectionActionEngine(
    input: ActionEngineInput
): Promise<ActionEngineResult> {
    const { organization_id, customer_id, invoice_id, conversation_id, classification } = input;
    const { intent } = classification;

    // Metadata to store in the action for auditability
    // Cast to 'object' satisfies Prisma's InputJsonValue constraint
    const metadata = {
        message_id: input.message_id,
        ai_intent: classification.intent,
        ai_confidence: classification.confidence,
        promised_date: classification.promised_date,
        promised_amount: classification.promised_amount,
        reason: classification.reason,
    } as object;

    // ── PAYMENT_CONFIRMED ────────────────────────────────────────────────────
    // CRITICAL: Do NOT mark invoice PAID. Verify actual payment records.
    if (intent === "PAYMENT_CONFIRMED") {
        return handlePaymentConfirmed(
            organization_id,
            customer_id,
            invoice_id,
            conversation_id,
            metadata
        );
    }

    // ── Determine action_type for other intents ──────────────────────────────
    const actionTypeMap: Partial<Record<MessageIntent, string>> = {
        PAYMENT_PROMISED: "FOLLOW_UP_SCHEDULED",
        REQUEST_EXTENSION: "ESCALATE_FOR_REVIEW",
        DISPUTE: "ESCALATE_DISPUTE",
        INVOICE_ISSUE: "RESEND_INVOICE",
        PAYMENT_NOT_RECEIVED: "FOLLOW_UP_SCHEDULED",
        PAYMENT_PLAN_REQUEST: "ESCALATE_FOR_REVIEW",
        WRONG_INVOICE: "RESEND_INVOICE",
        OTHER: "MANUAL_REVIEW",
    };

    const action_type = actionTypeMap[intent];
    if (!action_type) {
        return {
            action_created: false,
            action_type: null,
            collection_action_id: null,
            skipped_reason: `No action rule defined for intent "${intent}"`,
        };
    }

    // ── Idempotency check ───────────────────────────────────────────────────
    const existing = await prisma.collection_actions.findFirst({
        where: {
            organization_id,
            conversation_id,
            action_type,
            status: { in: DUPLICATE_WINDOW_STATUSES },
        },
        orderBy: { created_at: "desc" },
    });

    if (existing) {
        return {
            action_created: false,
            action_type,
            collection_action_id: existing.id,
            skipped_reason: `Duplicate: an active "${action_type}" action already exists (id: ${existing.id})`,
        };
    }

    // ── Create action ───────────────────────────────────────────────────────
    const scheduled_at = computeScheduledAt(intent, classification.promised_date);

    const action = await prisma.collection_actions.create({
        data: {
            organization_id,
            customer_id,
            invoice_id,
            conversation_id,
            action_type,
            status: "PENDING",
            scheduled_at,
            metadata,
        },
    });

    return {
        action_created: true,
        action_type,
        collection_action_id: action.id,
        skipped_reason: null,
    };
}

// ─── Payment Confirmed Handler ─────────────────────────────────────────────

async function handlePaymentConfirmed(
    organization_id: string,
    customer_id: string,
    invoice_id: string | null,
    conversation_id: string,
    metadata: object
): Promise<ActionEngineResult> {
    // Without an invoice_id we can't verify — escalate for review
    if (!invoice_id) {
        return createActionSafely(
            organization_id,
            customer_id,
            invoice_id,
            conversation_id,
            "PAYMENT_VERIFICATION_REQUIRED",
            null,
            {
                ...(metadata as Record<string, unknown>),
                note: "PAYMENT_CONFIRMED but no invoice_id on conversation; manual verification required",
            } as object
        );
    }

    // Load the invoice
    const invoice = await prisma.invoices.findFirst({
        where: { id: invoice_id, organization_id },
    });

    if (!invoice) {
        return createActionSafely(
            organization_id,
            customer_id,
            invoice_id,
            conversation_id,
            "PAYMENT_VERIFICATION_REQUIRED",
            null,
            {
                ...(metadata as Record<string, unknown>),
                note: "Invoice not found during payment confirmation verification",
            } as object
        );
    }

    // Aggregate ACTUAL successful payments from the payments table
    const agg = await prisma.payments.aggregate({
        where: { invoice_id, organization_id, status: "SUCCEEDED" },
        _sum: { amount: true },
    });

    const totalPaid = Number(agg._sum.amount ?? 0);
    const invoiceAmount = Number(invoice.amount);
    const remaining = invoiceAmount - totalPaid;

    let paymentStatus: PaymentVerificationResult["status"];
    if (totalPaid >= invoiceAmount) {
        paymentStatus = "FULLY_PAID";
    } else if (totalPaid > 0) {
        paymentStatus = "PARTIALLY_PAID";
    } else {
        paymentStatus = "NOT_PAID";
    }

    const verificationResult: PaymentVerificationResult = {
        invoice_amount: invoiceAmount,
        total_paid: totalPaid,
        remaining,
        status: paymentStatus,
        invoice_status: invoice.status,
    };

    // If fully paid: no action needed (payment.routes.ts already handled status)
    if (paymentStatus === "FULLY_PAID") {
        return {
            action_created: false,
            action_type: "PAYMENT_VERIFICATION_REQUIRED",
            collection_action_id: null,
            skipped_reason: "Invoice is already fully paid per actual payment records",
            payment_verification: verificationResult,
        };
    }

    // Customer claims paid but actual records show NOT_PAID or PARTIALLY_PAID
    const note =
        paymentStatus === "NOT_PAID"
            ? "Customer claims PAYMENT_CONFIRMED but no matching payment exists in records"
            : `Customer claims PAYMENT_CONFIRMED but only ${totalPaid} of ${invoiceAmount} is confirmed in records`;

    const result = await createActionSafely(
        organization_id,
        customer_id,
        invoice_id,
        conversation_id,
        "PAYMENT_VERIFICATION_REQUIRED",
        null,
        {
            ...(metadata as Record<string, unknown>),
            note,
            payment_verification: verificationResult,
        } as object
    );

    return { ...result, payment_verification: verificationResult };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createActionSafely(
    organization_id: string,
    customer_id: string,
    invoice_id: string | null,
    conversation_id: string,
    action_type: string,
    scheduled_at: Date | null,
    metadata: object
): Promise<ActionEngineResult> {
    // Idempotency check
    const existing = await prisma.collection_actions.findFirst({
        where: {
            organization_id,
            conversation_id,
            action_type,
            status: { in: DUPLICATE_WINDOW_STATUSES },
        },
        orderBy: { created_at: "desc" },
    });

    if (existing) {
        return {
            action_created: false,
            action_type,
            collection_action_id: existing.id,
            skipped_reason: `Duplicate: an active "${action_type}" action already exists (id: ${existing.id})`,
        };
    }

    const action = await prisma.collection_actions.create({
        data: {
            organization_id,
            customer_id,
            invoice_id,
            conversation_id,
            action_type,
            status: "PENDING",
            scheduled_at,
            metadata,
        },
    });

    return {
        action_created: true,
        action_type,
        collection_action_id: action.id,
        skipped_reason: null,
    };
}

/**
 * Compute when the action should be scheduled based on intent and promised date.
 * Defaults: PAYMENT_PROMISED → promised_date or +1 day; others → now.
 */
function computeScheduledAt(intent: MessageIntent, promised_date: string | null): Date | null {
    if (intent === "PAYMENT_PROMISED" || intent === "REQUEST_EXTENSION") {
        if (promised_date) {
            const d = new Date(promised_date);
            // Schedule follow-up the day after the promised date
            d.setDate(d.getDate() + 1);
            return d;
        }
        // Default: follow up in 24 hours
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
    }

    // Immediate review actions
    if (
        intent === "DISPUTE" ||
        intent === "PAYMENT_PLAN_REQUEST" ||
        intent === "INVOICE_ISSUE" ||
        intent === "WRONG_INVOICE"
    ) {
        return new Date();
    }

    return null;
}
