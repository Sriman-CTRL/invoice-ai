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
        /** The headline figures above are INR only. */
        currency: string;
    };
    /** Every other currency, totalled on its own. Amounts in different currencies are never added together. */
    other_currencies: Array<{ currency: string; total_invoiced: number; total_paid: number; total_outstanding: number; overdue_outstanding: number }>;
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
    // Money is totalled per currency and never added across currencies: INR is the headline, the rest are listed separately.
    const now_ = now;
    const invoicedBy = await prisma.invoices.groupBy({
        by: ["currency"],
        where: { organization_id, status: { in: ["OPEN", "PARTIALLY_PAID", "PAID"] } },
        _sum: { amount: true },
    });
    const paidBy = await prisma.payments.groupBy({
        by: ["currency"],
        where: { organization_id, status: "SUCCEEDED" },
        _sum: { amount: true, tds_amount: true },
    });
    const overdueRows = await prisma.$queryRawUnsafe<Array<{ currency: string; overdue: number }>>(
        `SELECT i.currency, COALESCE(sum(GREATEST(i.amount - COALESCE(pp.settled, 0), 0)), 0)::float8 AS overdue
           FROM invoices i
           LEFT JOIN (SELECT invoice_id, sum(amount + tds_amount) AS settled FROM payments WHERE status = 'SUCCEEDED' GROUP BY invoice_id) pp ON pp.invoice_id = i.id
          WHERE i.organization_id = $1::uuid AND i.status IN ('OPEN', 'PARTIALLY_PAID') AND i.due_at < $2
          GROUP BY i.currency`,
        organization_id, now_,
    );
    const currencies = new Set<string>(["INR", ...invoicedBy.map((r) => r.currency), ...paidBy.map((r) => r.currency), ...overdueRows.map((r) => r.currency)]);
    const totals = [...currencies].sort().map((cur) => {
        const total_invoiced = Number(invoicedBy.find((r) => r.currency === cur)?._sum.amount ?? 0);
        const p = paidBy.find((r) => r.currency === cur);
        // total_paid is cash received; TDS the client deducted also settles invoices, so it leaves the outstanding total.
        const total_paid = Number(p?._sum.amount ?? 0);
        const total_tds = Number(p?._sum.tds_amount ?? 0);
        return {
            currency: cur,
            total_invoiced,
            total_paid,
            total_outstanding: Math.max(0, total_invoiced - total_paid - total_tds),
            overdue_outstanding: Number(overdueRows.find((r) => r.currency === cur)?.overdue ?? 0),
        };
    });
    const financial_summary = totals.find((t_) => t_.currency === "INR")!;
    const other_currencies = totals.filter((t_) => t_.currency !== "INR" && (t_.total_invoiced > 0 || t_.total_paid > 0 || t_.overdue_outstanding > 0));

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
        other_currencies,
        customer_summary,
        collection_summary,
        recent_activity,
    };
}
