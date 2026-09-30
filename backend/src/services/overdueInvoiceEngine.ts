import prisma from "../lib/prisma";

export interface OverdueProcessResult {
    invoices_detected: number;
    actions_created: number;
    created_action_ids: string[];
    skipped: Array<{
        invoice_id: string;
        reason: string;
    }>;
}

/**
 * Deterministic engine to detect overdue invoices and create collection actions.
 * 
 * Rules for overdue:
 * - status is OPEN or PARTIALLY_PAID
 * - due_at is strictly in the past (< current time)
 * - organization_id matches
 * 
 * Idempotency:
 * - Does not create duplicate actions if a PENDING or PROCESSING action of type "FOLLOW_UP_SCHEDULED" 
 *   already exists for the same invoice.
 */
export async function processOverdueInvoices(
    organization_id: string
): Promise<OverdueProcessResult> {
    const now = new Date();

    // 1. Find all overdue invoices deterministically
    const overdueInvoices = await prisma.invoices.findMany({
        where: {
            organization_id,
            status: {
                in: ["OPEN", "PARTIALLY_PAID"],
            },
            due_at: {
                lt: now, // strictly less than current time
            },
        },
    });

    const result: OverdueProcessResult = {
        invoices_detected: overdueInvoices.length,
        actions_created: 0,
        created_action_ids: [],
        skipped: [],
    };

    // 2. Process each invoice
    for (const invoice of overdueInvoices) {
        // Check idempotency: does a PENDING/PROCESSING action already exist for this invoice?
        const existingAction = await prisma.collection_actions.findFirst({
            where: {
                organization_id,
                invoice_id: invoice.id,
                action_type: "FOLLOW_UP_SCHEDULED",
                status: {
                    in: ["PENDING", "PROCESSING"],
                },
            },
        });

        if (existingAction) {
            result.skipped.push({
                invoice_id: invoice.id,
                reason: `Active FOLLOW_UP_SCHEDULED action already exists (id: ${existingAction.id})`,
            });
            continue;
        }

        // We do not change the invoice status automatically because PostgreSQL/business logic
        // is the source of truth, and we only act as an observer here.
        // We create the collection action.
        const action = await prisma.collection_actions.create({
            data: {
                organization_id,
                customer_id: invoice.customer_id,
                invoice_id: invoice.id,
                // Using an existing action_type
                action_type: "FOLLOW_UP_SCHEDULED",
                status: "PENDING",
                scheduled_at: now,
                metadata: {
                    reason: "Invoice became overdue",
                    due_at: invoice.due_at,
                    invoice_amount: invoice.amount,
                    invoice_status: invoice.status,
                } as object,
            },
        });

        result.actions_created++;
        result.created_action_ids.push(action.id);
    }

    return result;
}
