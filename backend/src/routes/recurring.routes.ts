import { captureJobFailure } from "../lib/monitoring";
import { Router } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { parseDetails } from "../lib/invoiceDetails";
import { runAutoReminders, type AutoReminderResult } from "../services/reminderService";
import { FREQUENCIES, addPeriod, runDueRecurring, type Frequency } from "../lib/recurring";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "https://paivo.in").replace(/\/$/, "");
const MAX_SCHEDULES = 25;

/** Owner-facing endpoints, behind login. */
export const recurringRouter = Router();

recurringRouter.get("/", async (req, res) => {
  const org = req.user!.organization_id;
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT r.id, r.customer_id, c.name AS customer_name, r.frequency, to_char(r.next_run,'YYYY-MM-DD') AS next_run, r.active, r.runs, r.template
       FROM recurring_invoices r JOIN customers c ON c.id = r.customer_id
      WHERE r.organization_id = $1::uuid ORDER BY r.created_at DESC`,
    org,
  );
  res.json(rows);
});

recurringRouter.post("/", async (req, res) => {
  try {
    const org = req.user!.organization_id;
    const { customer_id, frequency, first_run, currency, terms_days, prefix, deliverable } = req.body ?? {};
    if (!UUID.test(String(customer_id))) return res.status(400).json({ error: "Choose a client." });
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Choose how often to repeat." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(first_run))) return res.status(400).json({ error: "Choose the next date." });
    const parsed = parseDetails(req.body);
    if (!parsed || "error" in parsed) return res.status(400).json({ error: parsed && "error" in parsed ? parsed.error : "Add line items." });
    const customer = await prisma.customers.findFirst({ where: { id: customer_id, organization_id: org }, select: { id: true } });
    if (!customer) return res.status(404).json({ error: "Client not found." });
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM recurring_invoices WHERE organization_id = $1::uuid`, org);
    if (n >= MAX_SCHEDULES) return res.status(400).json({ error: `You can keep up to ${MAX_SCHEDULES} repeating invoices.` });

    const template = {
      items: parsed.details.items.map((i) => ({ description: i.description, quantity: i.quantity, rate: i.rate })),
      discount: parsed.details.discount,
      tax_mode: parsed.details.tax_mode,
      tax_percent: parsed.details.tax_percent,
      notes: parsed.details.notes,
      currency: String(currency || "INR").slice(0, 3),
      terms_days: Math.min(Math.max(Number(terms_days) || 0, 0), 120),
      prefix: String(prefix || "REC").slice(0, 12),
      deliverable: typeof deliverable === "string" ? deliverable.slice(0, 500) : undefined,
    };
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO recurring_invoices (organization_id, customer_id, template, frequency, next_run)
       VALUES ($1::uuid, $2::uuid, $3::jsonb, $4, $5::date) RETURNING id`,
      org, customer_id, JSON.stringify(template), frequency, first_run,
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not save the repeating invoice." });
  }
});

recurringRouter.patch("/:id", async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
  const active = req.body?.active === true;
  const n = await prisma.$executeRawUnsafe(`UPDATE recurring_invoices SET active = $2 WHERE id = $1::uuid AND organization_id = $3::uuid`, req.params.id, active, req.user!.organization_id);
  if (!n) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

recurringRouter.delete("/:id", async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
  const n = await prisma.$executeRawUnsafe(`DELETE FROM recurring_invoices WHERE id = $1::uuid AND organization_id = $2::uuid`, req.params.id, req.user!.organization_id);
  if (!n) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

/** Daily job. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`; anyone else is refused. */
export const cronRouter = Router();

cronRouter.get("/recurring", async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const given = String(req.headers.authorization || "");
  const expected = `Bearer ${secret}`;
  const ok = secret.length >= 16 && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: "Unauthorized" });
  // Two independent jobs: a failure in one must not stop the other, and the response reports both.
  let recurring: { created: number; failed: number } | { error: string };
  try {
    recurring = await runDueRecurring(PUBLIC_APP_URL);
  } catch (e) {
    console.error("cron: recurring invoices failed", e);
    await captureJobFailure("recurring-invoices", e);
    recurring = { error: "Run failed" };
  }
  let autoReminders: AutoReminderResult | { error: string };
  try {
    autoReminders = await runAutoReminders();
  } catch (e) {
    console.error("cron: automatic reminders failed", e);
    await captureJobFailure("auto-reminders", e);
    autoReminders = { error: "Run failed" };
  }
  const failed = "error" in recurring && "error" in autoReminders;
  // Top-level created/failed keep the response shape the recurring job always had.
  res.status(failed ? 500 : 200).json({ ...("error" in recurring ? {} : recurring), recurring, auto_reminders: autoReminders });
});

export { addPeriod, type Frequency };
