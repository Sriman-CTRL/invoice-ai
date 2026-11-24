import { creditedTotal, outstandingOf, settledByCredit } from "../lib/invoiceBalance";
import prisma from "../lib/prisma";
import { getDetails } from "../lib/invoiceDetails";

export interface InvoiceDetails {
    invoice: any;
    customer: any;
    financial_summary: {
        invoice_amount: number;
        paid_amount: number;
        credited_amount: number;
        settled_by_credit: boolean;
        outstanding_amount: number;
        currency: string;
    };
    payments: any[];
    conversation: any | null;
    conversations: any[];
    collection_actions: any[];
    details: any | null;
    views: { count: number; last_viewed_at: string | null };
}

export async function getInvoiceDetails(organization_id: string, invoice_id: string): Promise<InvoiceDetails | null> {
    const invoice = await prisma.invoices.findUnique({
        where: { id: invoice_id },
        include: {
            customers: true
        }
    });

    if (!invoice || invoice.organization_id !== organization_id) {
        return null; // Not found or cross-tenant access attempt
    }

    const { customers: customer, ...invoiceData } = invoice;

    const payments = await prisma.payments.findMany({
        where: {
            organization_id,
            invoice_id
        },
        orderBy: { created_at: "desc" }
    });

    // Conversations can theoretically be multiple per invoice (if there were multiple threads),
    // but the schema says invoice has many conversations, so we fetch the most recent one or all?
    // The requirement says:
    // "Return the conversation associated with this invoice if one exists."
    // "If multiple conversations can exist for one invoice, inspect the existing schema and return the appropriate structure rather than silently discarding data."
    // Schema shows: `conversations` is an array inside `invoice`. 
    // Wait, the prompt requested: "conversation: null" (singular) in the JSON structure. 
    // Let's return the most recent active conversation, or if none, the most recent closed one, or all as an array?
    // Wait, "conversation: null" in the JSON but "If multiple conversations can exist... return the appropriate structure rather than silently discarding data". 
    // Let's use `conversations: []` in the payload instead to safely return all if multiple exist. The prompt template says "conversation: null", but immediately follows with "return the appropriate structure". Let's provide `conversations: []` as a safer bet or keep `conversation` as a single object if there's only one. Let's return an array of conversations. But wait, it specifically asks for "conversation: null". I will check if there is exactly 1 or more, but let's stick to an array to be completely safe based on the schema and prompt instruction "inspect the existing schema and return the appropriate structure". In `schema.prisma`, `invoices` has `conversations conversations[]`. So I will return `conversations: []`.
    const conversations = await prisma.conversations.findMany({
        where: {
            organization_id,
            invoice_id
        },
        orderBy: { created_at: "desc" }
    });

    const collection_actions = await prisma.collection_actions.findMany({
        where: {
            organization_id,
            invoice_id
        },
        orderBy: { created_at: "desc" }
    });

    let paid_amount = 0;
    for (const p of payments) {
        if (p.status === "SUCCEEDED") {
            paid_amount += Number(p.amount);
        }
    }

    const invoice_amount = Number(invoice.amount);
    const credited_amount = await creditedTotal(prisma, organization_id, invoice_id);
    const outstanding_amount = outstandingOf(invoice_amount, paid_amount, credited_amount);

    const details = await getDetails(invoice_id);
    const viewRows = await prisma.$queryRawUnsafe<{ n: number; last: Date | null }[]>(
        `SELECT count(*)::int AS n, max(viewed_at) AS last FROM invoice_views WHERE invoice_id = $1::uuid`,
        invoice_id,
    );

    return {
        details,
        views: { count: viewRows[0]?.n ?? 0, last_viewed_at: viewRows[0]?.last ? new Date(viewRows[0].last).toISOString() : null },
        invoice: invoiceData,
        customer,
        financial_summary: {
            invoice_amount,
            paid_amount,
            credited_amount,
            settled_by_credit: settledByCredit(String(invoice.status), invoice_amount, paid_amount, credited_amount),
            outstanding_amount,
            currency: invoice.currency
        },
        payments,
        // Since schema allows multiple, return as an array per "return appropriate structure" rule.
        conversations,
        // Fallback for strict singular adherence just in case (the requested type might be null)
        conversation: conversations.length > 0 ? conversations[0] : null,
        collection_actions
    };
}
