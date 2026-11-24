import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { JWT_SECRET } from "../lib/config";
import { getOrgSettings } from "../lib/orgSettings";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One private, unguessable link per client. Anyone holding it can see that client's invoices from this seller
// (like an individual pay link, but for all of them), so it is only ever shown to the seller to share.
export const portalToken = (customerId: string): string =>
  crypto.createHmac("sha256", JWT_SECRET).update(`portal:${customerId}`).digest("hex").slice(0, 32);

const valid = (customerId: string, token: string): boolean => {
  const a = Buffer.from(portalToken(customerId));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const router = Router();

router.get("/:customerId/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = String(req.params.customerId);
    const token = String(req.params.token);
    if (!UUID.test(customerId) || !valid(customerId, token)) {
      res.status(404).json({ error: "This link isn't valid. Ask the sender for a fresh one." });
      return;
    }
    const customer = await prisma.customers.findFirst({ where: { id: customerId }, include: { organizations: true } });
    if (!customer) {
      res.status(404).json({ error: "This link isn't valid. Ask the sender for a fresh one." });
      return;
    }
    const settings = await getOrgSettings(customer.organization_id);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT i.id, i.invoice_number, i.amount::float8 AS amount, i.currency, i.status, i.issued_at, i.due_at,
              COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED'), 0)::float8 AS paid,
              COALESCE((SELECT sum(c.amount) FROM credit_notes c WHERE c.invoice_id = i.id), 0)::float8 AS credited
         FROM invoices i
        WHERE i.customer_id = $1::uuid AND i.status NOT IN ('DRAFT', 'CANCELLED')
        ORDER BY COALESCE(i.issued_at, i.created_at) DESC LIMIT 100`,
      customerId,
    );
    const invoices = rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      issued_at: r.issued_at,
      due_at: r.due_at,
      outstanding: Math.max(0, Math.round((r.amount - r.paid - r.credited) * 100) / 100),
    }));
    res.json({
      organization: { name: customer.organizations.name, brand_color: settings.brand_color, logo_data: settings.logo_data },
      customer: { name: customer.name, company_name: customer.company_name },
      invoices,
      outstanding_total: Math.round(invoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.outstanding, 0) * 100) / 100,
    });
  } catch (e) {
    console.error("client portal error", e);
    res.status(500).json({ error: "Could not load this page." });
  }
});

export default router;
