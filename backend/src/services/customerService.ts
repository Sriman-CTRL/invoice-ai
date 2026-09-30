import prisma from "../lib/prisma";

export interface CustomerDetails {
    customer: any;
    summary: {
        total_invoices: number;
        total_invoiced: number;
        total_paid: number;
        total_outstanding: number;
        overdue_amount: number;
    };
    invoices: any[];
    payments: any[];
    conversations: any[];
    collection_actions: any[];
}

export async function getCustomerDetails(organization_id: string, customer_id: string): Promise<CustomerDetails | null> {
    const customer = await prisma.customers.findUnique({
        where: { id: customer_id }
    });

    if (!customer) {
        return null; // Not found
    }

    if (customer.organization_id !== organization_id) {
        return null; // Simulate 404 for cross-organization isolation
    }

    const now = new Date();

    const invoices = await prisma.invoices.findMany({
        where: {
            organization_id,
            customer_id
        },
        orderBy: { created_at: "desc" }
    });

    const invoiceIds = invoices.map(i => i.id);

    const payments = await prisma.payments.findMany({
        where: {
            organization_id,
            invoice_id: { in: invoiceIds }
        },
        orderBy: { created_at: "desc" }
    });

    const conversations = await prisma.conversations.findMany({
        where: {
            organization_id,
            customer_id
        },
        orderBy: { created_at: "desc" }
    });

    const collection_actions = await prisma.collection_actions.findMany({
        where: {
            organization_id,
            customer_id
        },
        orderBy: { created_at: "desc" }
    });

    // Calculate Summary
    const total_invoices = invoices.length;
    let total_invoiced = 0;
    let total_paid = 0;
    let overdue_amount = 0;

    for (const inv of invoices) {
        if (["OPEN", "PARTIALLY_PAID", "PAID"].includes(inv.status)) {
            total_invoiced += Number(inv.amount);
        }
    }

    for (const pay of payments) {
        if (pay.status === "SUCCEEDED") {
            total_paid += Number(pay.amount);
        }
    }

    const total_outstanding = Math.max(0, total_invoiced - total_paid);

    // Overdue amount
    const overdueInvoices = invoices.filter(inv => 
        ["OPEN", "PARTIALLY_PAID"].includes(inv.status) && 
        inv.due_at && inv.due_at < now
    );

    for (const overdueInv of overdueInvoices) {
        const invAmount = Number(overdueInv.amount);
        const invPayments = payments.filter(p => p.invoice_id === overdueInv.id && p.status === "SUCCEEDED");
        const invPaid = invPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        overdue_amount += Math.max(0, invAmount - invPaid);
    }

    return {
        customer,
        summary: {
            total_invoices,
            total_invoiced,
            total_paid,
            total_outstanding,
            overdue_amount
        },
        invoices,
        payments,
        conversations,
        collection_actions
    };
}
