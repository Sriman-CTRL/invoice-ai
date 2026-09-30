import prisma from "../lib/prisma";

export interface DashboardData {
    invoice_summary: {
        total: number;
        draft: number;
        open: number;
        partially_paid: number;
        paid: number;
        overdue: number;
        disputed: number;
        cancelled: number;
    };
    financial_summary: {
        total_invoiced: number;
        total_paid: number;
        total_outstanding: number;
        overdue_outstanding: number;
        currency: string;
    };
    customer_summary: {
        total_customers: number;
        customers_with_outstanding: number;
        customers_with_overdue: number;
    };
    collection_summary: {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        cancelled: number;
    };
    recent_activity: {
        invoices: any[];
        payments: any[];
        collection_actions: any[];
    };
}

export async function getDashboardData(organization_id: string): Promise<DashboardData> {
    const now = new Date();

    // 1. Invoice Summary
    const invoiceGroups = await prisma.invoices.groupBy({
        by: ['status'],
        where: { organization_id },
        _count: { id: true },
    });

    const overdueCount = await prisma.invoices.count({
        where: {
            organization_id,
            status: { in: ["OPEN", "PARTIALLY_PAID"] },
            due_at: { lt: now },
        },
    });

    const invoice_summary = {
        total: 0,
        draft: 0,
        open: 0,
        partially_paid: 0,
        paid: 0,
        overdue: overdueCount,
        disputed: 0, // Assuming DISPUTED isn't a direct invoice status right now, or if it is, we map it
        cancelled: 0,
    };

    let totalInvoicesCount = 0;
    for (const group of invoiceGroups) {
        const count = group._count.id;
        totalInvoicesCount += count;
        if (group.status === "DRAFT") invoice_summary.draft = count;
        if (group.status === "OPEN") invoice_summary.open = count;
        if (group.status === "PARTIALLY_PAID") invoice_summary.partially_paid = count;
        if (group.status === "PAID") invoice_summary.paid = count;
        if (group.status === "DISPUTED") invoice_summary.disputed = count;
        if (group.status === "CANCELLED") invoice_summary.cancelled = count;
    }
    invoice_summary.total = totalInvoicesCount;

    // 2. Financial Summary
    // We only count invoiced amounts for non-DRAFT and non-CANCELLED perhaps?
    // Let's count all or maybe OPEN + PARTIALLY_PAID + PAID
    const validInvoices = await prisma.invoices.aggregate({
        where: { 
            organization_id,
            status: { in: ["OPEN", "PARTIALLY_PAID", "PAID"] } // Generally invoices that are active
        },
        _sum: { amount: true },
    });

    const total_invoiced = Number(validInvoices._sum.amount ?? 0);

    const successfulPayments = await prisma.payments.aggregate({
        where: { organization_id, status: "SUCCEEDED" },
        _sum: { amount: true },
    });
    
    const total_paid = Number(successfulPayments._sum.amount ?? 0);
    const total_outstanding = Math.max(0, total_invoiced - total_paid);

    // Overdue Outstanding
    const overdueInvoices = await prisma.invoices.findMany({
        where: {
            organization_id,
            status: { in: ["OPEN", "PARTIALLY_PAID"] },
            due_at: { lt: now },
        },
        select: {
            id: true,
            amount: true,
        }
    });

    let overdue_outstanding = 0;
    if (overdueInvoices.length > 0) {
        const overdueInvoiceIds = overdueInvoices.map(inv => inv.id);
        const overduePayments = await prisma.payments.aggregate({
            where: {
                organization_id,
                invoice_id: { in: overdueInvoiceIds },
                status: "SUCCEEDED"
            },
            _sum: { amount: true }
        });
        
        const totalOverdueInvoiced = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const totalOverduePaid = Number(overduePayments._sum.amount ?? 0);
        overdue_outstanding = Math.max(0, totalOverdueInvoiced - totalOverduePaid);
    }

    // Determine primary currency (just picking the first invoice's currency or defaulting to INR)
    const firstInvoice = await prisma.invoices.findFirst({
        where: { organization_id },
        select: { currency: true },
    });
    const currency = firstInvoice?.currency || "INR";

    const financial_summary = {
        total_invoiced,
        total_paid,
        total_outstanding,
        overdue_outstanding,
        currency,
    };

    // 3. Customer Summary
    const total_customers = await prisma.customers.count({ where: { organization_id } });
    
    const customers_with_outstanding = (await prisma.invoices.findMany({
        where: { organization_id, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        select: { customer_id: true },
        distinct: ['customer_id']
    })).length;

    const customers_with_overdue = (await prisma.invoices.findMany({
        where: { organization_id, status: { in: ["OPEN", "PARTIALLY_PAID"] }, due_at: { lt: now } },
        select: { customer_id: true },
        distinct: ['customer_id']
    })).length;

    const customer_summary = {
        total_customers,
        customers_with_outstanding,
        customers_with_overdue,
    };

    // 4. Collection Summary
    const collectionGroups = await prisma.collection_actions.groupBy({
        by: ['status'],
        where: { organization_id },
        _count: { id: true },
    });

    const collection_summary = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
    };

    for (const group of collectionGroups) {
        const count = group._count.id;
        if (group.status === "PENDING") collection_summary.pending = count;
        if (group.status === "PROCESSING") collection_summary.processing = count;
        if (group.status === "COMPLETED") collection_summary.completed = count;
        if (group.status === "FAILED") collection_summary.failed = count;
        if (group.status === "CANCELLED") collection_summary.cancelled = count;
    }

    // 5. Recent Activity
    const recent_invoices = await prisma.invoices.findMany({
        where: { organization_id },
        orderBy: { created_at: "desc" },
        take: 10,
        include: { customers: { select: { name: true } } }
    });

    const recent_payments = await prisma.payments.findMany({
        where: { organization_id },
        orderBy: { created_at: "desc" },
        take: 10,
        include: { invoices: { select: { invoice_number: true } } }
    });

    const recent_collection_actions = await prisma.collection_actions.findMany({
        where: { organization_id },
        orderBy: { created_at: "desc" },
        take: 10,
        include: { 
            customers: { select: { name: true } },
            invoices: { select: { invoice_number: true } }
        }
    });

    const recent_activity = {
        invoices: recent_invoices,
        payments: recent_payments,
        collection_actions: recent_collection_actions,
    };

    return {
        invoice_summary,
        financial_summary,
        customer_summary,
        collection_summary,
        recent_activity,
    };
}
