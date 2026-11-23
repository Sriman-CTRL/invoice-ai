import { Router, Request, Response } from "express";
import { getDashboardData } from "../services/dashboardService";
import prisma from "../lib/prisma";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/dashboard
 * Fetch deterministic database-backed dashboard information for the organization
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
    try {
        const { organization_id } = req.query;

        if (!organization_id || typeof organization_id !== "string") {
            res.status(400).json({ error: "organization_id is required" });
            return;
        }

        if (!UUID_REGEX.test(organization_id)) {
            res.status(400).json({ error: "organization_id must be a valid UUID" });
            return;
        }

        const data = await getDashboardData(organization_id);

        res.json(data);
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


/**
 * GET /api/dashboard/analytics
 * Revenue by month, top clients, how fast clients pay, and what is overdue. Money is in the org's invoice currencies
 * summed as-is, so mixed-currency accounts see INR-equivalent only when everything is INR (the common case here).
 */
router.get("/analytics", async (req: Request, res: Response): Promise<void> => {
    try {
        const org = req.user?.organization_id;
        if (!org) { res.status(401).json({ error: "Unauthorized" }); return; }
        const months = await prisma.$queryRawUnsafe<any[]>(
            `WITH m AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS month)
             SELECT to_char(m.month, 'YYYY-MM') AS month,
                    COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.organization_id = $1::uuid AND p.status = 'SUCCEEDED' AND date_trunc('month', COALESCE(p.paid_at, p.created_at)) = m.month), 0)::float8 AS received,
                    COALESCE((SELECT sum(i.amount) FROM invoices i WHERE i.organization_id = $1::uuid AND i.status <> 'DRAFT' AND i.status <> 'CANCELLED' AND date_trunc('month', COALESCE(i.issued_at, i.created_at)) = m.month), 0)::float8 AS invoiced
               FROM m ORDER BY m.month`,
            org,
        );
        const top = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.id, c.name, c.company_name, COALESCE(sum(p.amount), 0)::float8 AS paid, count(DISTINCT i.id)::int AS invoices
               FROM customers c
               LEFT JOIN invoices i ON i.customer_id = c.id AND i.status <> 'DRAFT' AND i.status <> 'CANCELLED'
               LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'SUCCEEDED'
              WHERE c.organization_id = $1::uuid
              GROUP BY c.id ORDER BY paid DESC, invoices DESC LIMIT 5`,
            org,
        );
        const kpi = await prisma.$queryRawUnsafe<any[]>(
            `SELECT
                COALESCE((SELECT sum(amount) FROM payments WHERE organization_id = $1::uuid AND status = 'SUCCEEDED'), 0)::float8 AS lifetime_received,
                COALESCE((SELECT sum(i.amount - COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED'), 0))
                           FROM invoices i WHERE i.organization_id = $1::uuid AND i.status IN ('OPEN','PARTIALLY_PAID')), 0)::float8 AS outstanding,
                COALESCE((SELECT sum(i.amount - COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED'), 0))
                           FROM invoices i WHERE i.organization_id = $1::uuid AND i.status IN ('OPEN','PARTIALLY_PAID') AND i.due_at < now()), 0)::float8 AS overdue,
                (SELECT round(avg(EXTRACT(EPOCH FROM (COALESCE(p.paid_at, p.created_at) - COALESCE(i.issued_at, i.created_at))) / 86400)::numeric, 1)::float8
                   FROM invoices i JOIN payments p ON p.invoice_id = i.id AND p.status = 'SUCCEEDED'
                  WHERE i.organization_id = $1::uuid AND i.status = 'PAID') AS avg_days_to_pay,
                (SELECT count(*)::int FROM invoices WHERE organization_id = $1::uuid AND status = 'PAID') AS paid_count,
                (SELECT count(*)::int FROM invoices WHERE organization_id = $1::uuid AND status NOT IN ('DRAFT','CANCELLED')) AS sent_count`,
            org,
        );
        res.json({ months, top_clients: top, kpi: kpi[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load analytics" });
    }
});

/**
 * GET /api/dashboard/gst-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * One row per issued invoice with its taxable value and GST split, ready for an accountant.
 */
router.get("/gst-report", async (req: Request, res: Response): Promise<void> => {
    try {
        const org = req.user?.organization_id;
        if (!org) { res.status(401).json({ error: "Unauthorized" }); return; }
        const from = String(req.query.from || "");
        const to = String(req.query.to || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) { res.status(400).json({ error: "from and to must be dates (YYYY-MM-DD)" }); return; }
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT i.invoice_number, to_char(COALESCE(i.issued_at, i.created_at), 'YYYY-MM-DD') AS date, c.name AS customer, c.company_name, i.currency, i.status,
                    i.amount::float8 AS total, d.items, d.discount::float8 AS discount, d.tax_percent::float8 AS tax_percent, d.tax_mode
               FROM invoices i
               JOIN customers c ON c.id = i.customer_id
               LEFT JOIN invoice_details d ON d.invoice_id = i.id
              WHERE i.organization_id = $1::uuid AND i.status NOT IN ('DRAFT','CANCELLED')
                AND COALESCE(i.issued_at, i.created_at)::date BETWEEN $2::date AND $3::date
              ORDER BY COALESCE(i.issued_at, i.created_at), i.invoice_number`,
            org, from, to,
        );
        const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
        const out = rows.map((r) => {
            const items: Array<{ amount: number }> = Array.isArray(r.items) ? r.items : [];
            const subtotal = r2(items.reduce((a, i) => a + Number(i.amount || 0), 0));
            const taxable = items.length ? r2(Math.max(0, subtotal - (r.discount || 0))) : r2(r.total);
            const tax = items.length && r.tax_mode !== "NONE" ? r2((taxable * (r.tax_percent || 0)) / 100) : 0;
            const half = r2(tax / 2);
            return {
                invoice_number: r.invoice_number, date: r.date, customer: r.company_name || r.customer, currency: r.currency, status: r.status,
                taxable, cgst: r.tax_mode === "GST_INTRA" ? half : 0, sgst: r.tax_mode === "GST_INTRA" ? r2(tax - half) : 0,
                igst: r.tax_mode === "GST_INTER" ? tax : 0, total: r2(r.total), gst_rate: r.tax_mode === "NONE" || !items.length ? 0 : r.tax_percent,
            };
        });
        res.json({ from, to, rows: out });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to build the GST report" });
    }
});

export default router;
