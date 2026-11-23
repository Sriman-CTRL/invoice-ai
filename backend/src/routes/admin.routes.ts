import { NextFunction, Request, Response, Router } from "express";
import prisma from "../lib/prisma";
import { ensureOrgSettingsSchema } from "../lib/orgSettings";
import { ensureExtraSchema } from "../lib/extraSchema";

const router = Router();

/** Platform admins are the emails listed in PLATFORM_ADMIN_EMAILS (comma separated). Fails closed. */
async function isPlatformAdmin(userId: string): Promise<boolean> {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return false;
  const rows = await prisma.$queryRawUnsafe<{ email: string }[]>("SELECT email FROM users WHERE id = $1::uuid", userId);
  return Boolean(rows[0] && allowed.includes(rows[0].email.toLowerCase()));
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || !(await isPlatformAdmin(req.user.id))) {
      res.status(403).json({ error: "Platform admin access required" });
      return;
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to verify admin access" });
  }
}

// Lets the UI decide whether to show the Admin link. Never reveals the allow-list.
router.get("/me", async (req, res) => {
  try {
    res.json({ is_admin: req.user ? await isPlatformAdmin(req.user.id) : false });
  } catch {
    res.json({ is_admin: false });
  }
});

router.get("/plan-requests", requireAdmin, async (_req, res) => {
  try {
    await ensureOrgSettingsSchema();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT r.id, r.plan, r.utr, r.status, r.created_at, o.id AS organization_id, o.name AS organization_name, o.plan AS current_plan,
              (SELECT email FROM users u WHERE u.organization_id = o.id ORDER BY u.created_at LIMIT 1) AS owner_email
       FROM plan_requests r JOIN organizations o ON o.id = r.organization_id
       ORDER BY (r.status = 'PENDING') DESC, r.created_at DESC LIMIT 200`,
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load plan requests" });
  }
});

/** Growth dashboard: visits from first-party events, signups/activation straight from the database. */
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    await ensureExtraSchema();
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10) || 30, 1), 365);
    const q = <T,>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql, days);
    const [daily, pages, referrers, visitorsFor, signups, activated, pending, orgsTotal, paidOrgs] = await Promise.all([
      q<{ day: string; views: number; visitors: number }>(`SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day, count(*)::int AS views, count(DISTINCT visitor)::int AS visitors FROM analytics_events WHERE at > now() - ($1::int * interval '1 day') GROUP BY 1 ORDER BY 1`),
      q<{ path: string; views: number }>(`SELECT path, count(*)::int AS views FROM analytics_events WHERE at > now() - ($1::int * interval '1 day') GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      q<{ referrer: string; visits: number }>(`SELECT referrer, count(DISTINCT visitor)::int AS visits FROM analytics_events WHERE referrer IS NOT NULL AND at > now() - ($1::int * interval '1 day') GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      q<{ path: string; visitors: number }>(`SELECT path, count(DISTINCT visitor)::int AS visitors FROM analytics_events WHERE path IN ('/', '/pricing', '/register') AND at > now() - ($1::int * interval '1 day') GROUP BY 1`),
      q<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE created_at > now() - ($1::int * interval '1 day')`),
      q<{ n: number }>(`SELECT count(DISTINCT i.organization_id)::int AS n FROM invoices i JOIN organizations o ON o.id = i.organization_id WHERE o.created_at > now() - ($1::int * interval '1 day')`),
      q<{ n: number }>(`SELECT count(*)::int AS n FROM plan_requests WHERE status = 'PENDING' AND $1::int > 0`),
      q<{ n: number }>(`SELECT count(*)::int AS n FROM organizations WHERE $1::int > 0`),
      q<{ n: number }>(`SELECT count(*)::int AS n FROM organizations WHERE plan <> 'FREE' AND $1::int > 0`),
    ]);
    const v = (p: string) => visitorsFor.find((x) => x.path === p)?.visitors ?? 0;
    res.json({
      days,
      daily, pages, referrers,
      funnel: { landing: v("/"), pricing: v("/pricing"), register_page: v("/register"), signups: signups[0]?.n ?? 0, activated: activated[0]?.n ?? 0 },
      totals: { organizations: orgsTotal[0]?.n ?? 0, paid_organizations: paidOrgs[0]?.n ?? 0, pending_upgrades: pending[0]?.n ?? 0 },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Approve = activate the requested plan for that organisation. Only PENDING requests can be actioned.
router.post("/plan-requests/:id/:decision", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const decision = String(req.params.decision);
    if (!UUID_RE.test(id) || !["approve", "reject"].includes(decision)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    await ensureOrgSettingsSchema();
    const status = decision === "approve" ? "APPROVED" : "REJECTED";
    const updated = await prisma.$queryRawUnsafe<{ organization_id: string; plan: string }[]>(
      `UPDATE plan_requests SET status = $2 WHERE id = $1::uuid AND status = 'PENDING' RETURNING organization_id, plan`,
      id, status,
    );
    if (!updated.length) {
      res.status(409).json({ error: "Request not found or already processed" });
      return;
    }
    if (decision === "approve") {
      await prisma.$executeRawUnsafe(`UPDATE organizations SET plan = $2, updated_at = now() WHERE id = $1::uuid`, updated[0].organization_id, updated[0].plan);
    }
    res.json({ success: true, status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

export default router;
