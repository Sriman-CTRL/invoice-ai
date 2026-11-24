import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { AUTO_REMINDER_STEPS, buildAutoReminder, selectDueStep } from "../services/reminderService";

/**
 * Automatic reminders. The mailer is always an injected fake: no test ever sends real email.
 * Integration parts need a LOCAL database (same switch as the other integration tests).
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };

const DAY = 24 * 60 * 60 * 1000;
let server: Server;
let base = "";
let prismaModule: any;
let prisma: any;
const created: { orgIds: string[] } = { orgIds: [] };
type Tenant = { token: string; orgId: string; customerId: string; email: string };

const sys = (fn: () => Promise<any>): Promise<any> => prismaModule.runAsSystem(async () => await fn());
async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

async function makeTenant(label: string, autoOn: boolean, withUpi = true): Promise<Tenant> {
  const email = `auto-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Auto-Remind-Tenant-3917";
  assert.equal((await call("POST", "/api/auth/register", { email, password, organization_name: `Auto ${label}`, accepted_terms: true })).status, 201);
  const login = await call("POST", "/api/auth/login", { email, password });
  const orgId = login.json.user.organization_id as string;
  created.orgIds.push(orgId);
  await sys(() => prisma.$executeRawUnsafe(`UPDATE organizations SET plan = 'PRO', auto_reminders = $2, upi_id = $3 WHERE id = $1::uuid`, orgId, autoOn, withUpi ? "seller@okbank" : null));
  const customer = await call("POST", "/api/customers", { name: `Client ${label}`, email: `client-${label}-${Date.now()}@example.com` }, login.json.token);
  assert.equal(customer.status, 201);
  return { token: login.json.token, orgId, customerId: customer.json.id, email };
}

async function overdueInvoice(t: Tenant, daysLate: number, amount = 4500) {
  const due = new Date(Date.now() - daysLate * DAY - 3600_000);
  const res = await call("POST", "/api/invoices", {
    customer_id: t.customerId, invoice_number: `AR-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, amount,
    issued_at: new Date(due.getTime() - 20 * DAY).toISOString(), due_at: due.toISOString(), status: "OPEN",
  }, t.token);
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return res.json.id as string;
}

function fakeMailer() {
  const sent: any[] = [];
  const mailer = async (input: any) => { sent.push(input); return { id: `fake-${sent.length}` }; };
  return { sent, mailer };
}

const reminderActions = (orgId: string, invoiceId: string) =>
  sys(() => prisma.collection_actions.findMany({ where: { organization_id: orgId, invoice_id: invoiceId, action_type: "PAYMENT_REMINDER" } }));

const run = async (o: Record<string, unknown>): Promise<any> => {
  const svc: any = await import("../services/reminderService.js");
  return sys(() => svc.runAutoReminders(o));
};

before(async () => {
  if (!enabled) return;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const serverModule: any = await import("../server.js");
  const app = serverModule.default?.default ?? serverModule.default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  prismaModule = await import("../lib/prisma.js");
  prisma = prismaModule.default?.default ?? prismaModule.default;
});

after(async () => {
  if (!enabled) return;
  server?.close();
  await sys(async () => {
    for (const org of created.orgIds) {
      for (const table of ["payments", "collection_actions", "messages", "conversations", "invoice_details", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

// ---------- pure ----------

test("selectDueStep: highest due step only, never repeated, nothing before day 1", () => {
  const due = new Date("2026-11-01T00:00:00Z");
  const at = (days: number) => new Date(due.getTime() + days * DAY + 1000);
  assert.deepEqual([...AUTO_REMINDER_STEPS], [1, 7, 14]);
  assert.equal(selectDueStep(due, new Date(due.getTime() - DAY), []), null, "not yet due");
  assert.equal(selectDueStep(due, at(0), []), null, "due today: wait a day");
  assert.equal(selectDueStep(due, at(1), []), 1);
  assert.equal(selectDueStep(due, at(1), [1]), null, "same step never twice");
  assert.equal(selectDueStep(due, at(8), []), 7, "no burst: only the highest due step");
  assert.equal(selectDueStep(due, at(8), [1]), 7);
  assert.equal(selectDueStep(due, at(8), [7]), null);
  assert.equal(selectDueStep(due, at(20), [1, 7]), 14);
  assert.equal(selectDueStep(due, at(90), [14]), null, "after the last step nothing more is sent");
  assert.equal(selectDueStep(due, at(90), []), 14);
});

test("buildAutoReminder: polite wording per step with amount, number, date and seller", () => {
  const base = { sellerName: "Sample Studio", customerName: "Asha", invoiceNumber: "INV-9", outstanding: 123456.5, currency: "INR", dueAt: new Date("2026-11-01T06:00:00Z") };
  for (const step of [1, 7, 14]) {
    const m = buildAutoReminder({ ...base, step });
    assert.ok(m.text.includes("₹1,23,456.50"), "amount in en-IN rupees");
    assert.ok(m.text.includes("INV-9") && m.subject.includes("INV-9"));
    assert.ok(m.text.includes("1 Nov 2026"));
    assert.ok(m.text.includes("Sample Studio") && m.text.includes("Asha"));
    assert.ok(!/legal|lawyer|court|penalt|sue|collections? agency|blacklist/i.test(m.text), "never threatening");
  }
  assert.notEqual(buildAutoReminder({ ...base, step: 1 }).text, buildAutoReminder({ ...base, step: 14 }).text);
});

// ---------- scheduled job ----------

test("AUTO: off by default, nothing is sent for a business that did not switch it on", opts, async () => {
  const t = await makeTenant("off", false);
  await overdueInvoice(t, 3);
  const { sent, mailer } = fakeMailer();
  const result = await run({ mailer });
  assert.equal(sent.filter((m) => m.fromName === "Auto off").length, 0);
  assert.equal(result.failed, 0);
});

test("AUTO: sends the day-1 reminder once with pay link, unsubscribe link and Reply-To, and records it", opts, async () => {
  const t = await makeTenant("one", true);
  const id = await overdueInvoice(t, 2);
  const { sent, mailer } = fakeMailer();
  await run({ mailer });
  const mine = sent.filter((m) => m.fromName === "Auto one");
  assert.equal(mine.length, 1);
  assert.ok(mine[0].payUrl.endsWith(`/pay/${id}`));
  assert.match(mine[0].unsubscribeUrl, /\/api\/unsubscribe\?/);
  assert.equal(mine[0].replyTo, t.email, "replies go to the seller");
  assert.ok(mine[0].text.includes("₹4,500.00"));
  const actions = await reminderActions(t.orgId, id);
  assert.equal(actions.length, 1);
  assert.deepEqual({ auto: actions[0].metadata.auto, step: actions[0].metadata.step, delivered: actions[0].metadata.delivered }, { auto: true, step: 1, delivered: true });

  // Second run straight away: idempotent.
  const again = fakeMailer();
  await run({ mailer: again.mailer });
  assert.equal(again.sent.filter((m) => m.fromName === "Auto one").length, 0);
  assert.equal((await reminderActions(t.orgId, id)).length, 1);
});

test("AUTO: later runs move on one step at a time, never a burst", opts, async () => {
  const t = await makeTenant("steps", true);
  const id = await overdueInvoice(t, 2);
  await run({ mailer: fakeMailer().mailer }); // day-1 step
  // Pretend that was sent 3 days ago so the 24 h cooldown has passed, then jump ahead to day 9 (step 7 is due).
  await sys(() => prisma.$executeRawUnsafe(`UPDATE collection_actions SET executed_at = now() - interval '3 days' WHERE organization_id = $1::uuid AND invoice_id = $2::uuid`, t.orgId, id));
  await sys(() => prisma.$executeRawUnsafe(`UPDATE auto_reminder_claims SET claimed_at = now() - interval '3 days' WHERE organization_id = $1::uuid AND invoice_id = $2::uuid`, t.orgId, id));
  const later = fakeMailer();
  await run({ mailer: later.mailer, now: new Date(Date.now() + 7 * DAY) });
  const mine = later.sent.filter((m) => m.fromName === "Auto steps");
  assert.equal(mine.length, 1, "exactly one email");
  assert.match(mine[0].subject, /week overdue/);
  const steps = (await reminderActions(t.orgId, id)).map((a: any) => a.metadata.step).sort();
  assert.deepEqual(steps, [1, 7]);
});

test("AUTO: skips suppressed customers, disputes, restricted processing, paid invoices and missing payment details", opts, async () => {
  const t = await makeTenant("skip", true);
  const suppressed = await overdueInvoice(t, 3);
  const cust2 = await call("POST", "/api/customers", { name: "Other", email: `other-${Date.now()}@example.com` }, t.token);
  const t2 = { ...t, customerId: cust2.json.id };
  const disputed = await overdueInvoice(t2, 3);
  const cust3 = await call("POST", "/api/customers", { name: "Restricted", email: `restricted-${Date.now()}@example.com` }, t.token);
  const t3 = { ...t, customerId: cust3.json.id };
  const restricted = await overdueInvoice(t3, 3);
  const paid = await overdueInvoice({ ...t, customerId: cust3.json.id }, 3, 100);
  await call("POST", "/api/payments", { invoice_id: paid, amount: 100 }, t.token);

  await sys(async () => {
    const email = (await prisma.customers.findFirst({ where: { id: t.customerId, organization_id: t.orgId } })).email;
    await prisma.suppressions.create({ data: { organization_id: t.orgId, address: email.toLowerCase(), reason: "UNSUBSCRIBED" } });
    await prisma.collection_actions.create({ data: { organization_id: t.orgId, customer_id: cust2.json.id, invoice_id: disputed, action_type: "ESCALATE_DISPUTE", status: "PENDING", metadata: {} } });
    await prisma.customers.update({ where: { id: cust3.json.id }, data: { processing_restricted: true } });
  });

  const { sent, mailer } = fakeMailer();
  const result = await run({ mailer });
  assert.equal(sent.filter((m) => m.fromName === "Auto skip").length, 0);
  for (const id of [suppressed, disputed, restricted, paid]) assert.equal((await reminderActions(t.orgId, id)).length, 0);
  assert.ok(result.skipped.suppressed >= 1 && result.skipped.disputed >= 1 && result.skipped.restricted >= 1);

  const noPay = await makeTenant("nopay", true, false);
  await overdueInvoice(noPay, 3);
  const second = fakeMailer();
  await run({ mailer: second.mailer });
  assert.equal(second.sent.filter((m) => m.fromName === "Auto nopay").length, 0, "no UPI or bank details: nothing is sent");
});

test("AUTO: respects the 24 hour cooldown and the daily cap", opts, async () => {
  const t = await makeTenant("cap", true);
  const recent = await overdueInvoice(t, 3);
  const a = await overdueInvoice(t, 3);
  const b = await overdueInvoice(t, 3);
  // A reminder emailed by hand (or automatically) a few hours ago blocks that invoice.
  await sys(() => prisma.collection_actions.create({ data: { organization_id: t.orgId, customer_id: t.customerId, invoice_id: recent, action_type: "PAYMENT_REMINDER", status: "COMPLETED", executed_at: new Date(Date.now() - 3 * 3600_000), metadata: { delivered: true } } }));

  const previous = process.env.REMINDER_DAILY_CAP;
  process.env.REMINDER_DAILY_CAP = "2"; // the manual one above already counts as one
  try {
    const { sent, mailer } = fakeMailer();
    const result = await run({ mailer });
    assert.equal(sent.filter((m) => m.fromName === "Auto cap").length, 1, "one slot left under the cap");
    assert.ok(result.skipped.cooldown >= 1);
    assert.ok(result.skipped.daily_cap >= 1);
    assert.equal((await reminderActions(t.orgId, recent)).length, 1, "cooldown invoice got nothing new");
    assert.equal((await reminderActions(t.orgId, a)).length + (await reminderActions(t.orgId, b)).length, 1);
  } finally {
    if (previous === undefined) delete process.env.REMINDER_DAILY_CAP; else process.env.REMINDER_DAILY_CAP = previous;
  }
});

test("AUTO: two overlapping runs send the step exactly once (claim before send)", opts, async () => {
  const t = await makeTenant("race", true);
  const id = await overdueInvoice(t, 2);
  const { sent, mailer } = fakeMailer();
  const slow = async (input: any) => { await new Promise((r) => setTimeout(r, 150)); return mailer(input); };
  const results = await Promise.all([run({ mailer: slow }), run({ mailer: slow }), run({ mailer: slow })]);
  assert.equal(sent.filter((m) => m.fromName === "Auto race").length, 1, "one email in total");
  assert.ok(results.some((r: any) => (r.skipped.already_claimed ?? 0) >= 1), "the others saw the claim");
  const claims = await sys(() => prisma.auto_reminder_claims.findMany({ where: { organization_id: t.orgId, invoice_id: id } }));
  assert.equal(claims.length, 1);
  assert.equal(claims[0].status, "SENT");
});

test("AUTO: if the history record cannot be written after sending, the step is still never re-sent", opts, async () => {
  const t = await makeTenant("recfail", true);
  const id = await overdueInvoice(t, 2);
  const pg = await import("pg");
  const owner = new (pg.default?.Client ?? (pg as any).Client)({ connectionString: process.env.DATABASE_URL });
  await owner.connect();
  const fn = "trg_block_reminder_record_" + Math.floor(Math.random() * 1e9);
  await owner.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.organization_id = '${t.orgId}'::uuid THEN RAISE EXCEPTION 'simulated write failure'; END IF; RETURN NEW; END $$`);
  await owner.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON collection_actions FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
    const first = fakeMailer();
    await run({ mailer: first.mailer });
    assert.equal(first.sent.filter((m) => m.fromName === "Auto recfail").length, 1);
    assert.equal((await reminderActions(t.orgId, id)).length, 0, "history write really failed");
    const second = fakeMailer();
    await run({ mailer: second.mailer });
    assert.equal(second.sent.filter((m) => m.fromName === "Auto recfail").length, 0, "no resend");
  } finally {
    await owner.query(`DROP TRIGGER IF EXISTS ${fn} ON collection_actions`);
    await owner.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    await owner.end();
  }
});

test("AUTO: a failed send is retried on a later day, not straight away", opts, async () => {
  const t = await makeTenant("retry", true);
  const id = await overdueInvoice(t, 2);
  const failing = async () => { throw new Error("provider down"); };
  const r1 = await run({ mailer: failing });
  assert.ok(r1.failed >= 1);
  const claim = async () => (await sys(() => prisma.auto_reminder_claims.findMany({ where: { organization_id: t.orgId, invoice_id: id } })))[0];
  assert.equal((await claim()).status, "FAILED");

  const same = fakeMailer();
  await run({ mailer: same.mailer });
  assert.equal(same.sent.filter((m) => m.fromName === "Auto retry").length, 0, "not retried within hours");

  await sys(() => prisma.$executeRawUnsafe(`UPDATE auto_reminder_claims SET finished_at = now() - interval '1 day', claimed_at = now() - interval '1 day' WHERE organization_id = $1::uuid`, t.orgId));
  const next = fakeMailer();
  await run({ mailer: next.mailer });
  assert.equal(next.sent.filter((m) => m.fromName === "Auto retry").length, 1, "retried next day");
  assert.equal((await claim()).status, "SENT");
});

test("AUTO: dry run sends and records nothing; run cap stops early", opts, async () => {
  const t = await makeTenant("dry", true);
  const id = await overdueInvoice(t, 3);
  const dry = fakeMailer();
  const result = await run({ mailer: dry.mailer, dryRun: true });
  assert.equal(result.dry_run, true);
  assert.equal(dry.sent.length, 0);
  assert.equal((await reminderActions(t.orgId, id)).length, 0, "nothing recorded, so the real run still sends");

  const capped = await makeTenant("runcap", true);
  await overdueInvoice(capped, 3); await overdueInvoice(capped, 3);
  const c = fakeMailer();
  const r2 = await run({ mailer: c.mailer, runCap: 1 });
  assert.equal(r2.stopped_early, "run_cap");
  assert.equal(c.sent.length, 1, "the cap is for the whole run");
});

// ---------- settings + manual route ----------

test("SETTINGS: auto_reminders is off by default and can only be turned on when email and payment details exist", opts, async () => {
  const t = await makeTenant("toggle", false, false);
  assert.equal((await call("GET", "/api/organizations/settings", undefined, t.token)).json.auto_reminders, false);
  assert.equal((await call("PUT", "/api/organizations/settings", { auto_reminders: "yes" }, t.token)).status, 400, "must be a boolean");
  const previous = process.env.RESEND_API_KEY;
  try {
    delete process.env.RESEND_API_KEY;
    assert.equal((await call("PUT", "/api/organizations/settings", { auto_reminders: true }, t.token)).status, 400, "email sending is off");
    process.env.RESEND_API_KEY = "re_test_not_real";
    assert.equal((await call("PUT", "/api/organizations/settings", { auto_reminders: true }, t.token)).status, 400, "no payment details yet");
    const ok = await call("PUT", "/api/organizations/settings", { auto_reminders: true, upi_id: "seller@okbank" }, t.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.json.auto_reminders, true);
    assert.equal((await call("PUT", "/api/organizations/settings", { auto_reminders: false }, t.token)).json.auto_reminders, false, "can always be turned off");
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
  }
});

test("MANUAL REMINDER: the button's guards and messages are unchanged", opts, async () => {
  const t = await makeTenant("manual", false);
  const id = await overdueInvoice(t, 3);
  const previous = process.env.RESEND_API_KEY;
  try {
    delete process.env.RESEND_API_KEY;
    const off = await call("POST", `/api/invoices/${id}/send-reminder`, { deliver: true }, t.token);
    assert.equal(off.status, 503);
    assert.match(off.json.error, /Email sending isn't switched on yet/);

    // Without delivery it still just records a reminder (Email Client / WhatsApp flow).
    const log = await call("POST", `/api/invoices/${id}/send-reminder`, { deliver: false, channel: "WHATSAPP" }, t.token);
    assert.equal(log.status, 200);
    assert.equal(log.json.collection_action.metadata.delivered, false);

    process.env.RESEND_API_KEY = "re_test_not_real";
    await sys(() => prisma.$executeRawUnsafe(`UPDATE organizations SET upi_id = NULL WHERE id = $1::uuid`, t.orgId));
    const noPay = await call("POST", `/api/invoices/${id}/send-reminder`, { deliver: true }, t.token);
    assert.equal(noPay.status, 400);
    assert.match(noPay.json.error, /Add your UPI ID or bank details/);

    await sys(() => prisma.$executeRawUnsafe(`UPDATE organizations SET upi_id = 'seller@okbank' WHERE id = $1::uuid`, t.orgId));
    await sys(() => prisma.collection_actions.create({ data: { organization_id: t.orgId, customer_id: t.customerId, invoice_id: id, action_type: "PAYMENT_REMINDER", status: "COMPLETED", executed_at: new Date(), metadata: { delivered: true } } }));
    const cool = await call("POST", `/api/invoices/${id}/send-reminder`, { deliver: true }, t.token);
    assert.equal(cool.status, 429);
    assert.match(cool.json.error, /already emailed in the last 24 hours/);

    await sys(async () => {
      const email = (await prisma.customers.findFirst({ where: { id: t.customerId, organization_id: t.orgId } })).email;
      await prisma.suppressions.create({ data: { organization_id: t.orgId, address: email.toLowerCase(), reason: "UNSUBSCRIBED" } });
    });
    const sup = await call("POST", `/api/invoices/${id}/send-reminder`, { deliver: false }, t.token);
    assert.equal(sup.status, 403);
    assert.equal(sup.json.suppressed, true);
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
  }
});

test("CRON: the daily endpoint needs its secret and runs both jobs", opts, async () => {
  const previous = process.env.CRON_SECRET;
  const previousDry = process.env.AUTO_REMINDERS_DRY_RUN;
  process.env.CRON_SECRET = "cron-secret-for-tests-0123456789";
  process.env.AUTO_REMINDERS_DRY_RUN = "1"; // the real endpoint must never email anyone from a test
  try {
    assert.equal((await call("GET", "/api/cron/recurring")).status, 401);
    const res = await fetch(base + "/api/cron/recurring", { headers: { Authorization: "Bearer cron-secret-for-tests-0123456789" } });
    assert.equal(res.status, 200);
    const json: any = await res.json();
    assert.ok(json.recurring && json.auto_reminders, "reports both jobs");
    assert.equal(typeof json.created, "number", "recurring fields keep their old place");
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
    if (previousDry === undefined) delete process.env.AUTO_REMINDERS_DRY_RUN; else process.env.AUTO_REMINDERS_DRY_RUN = previousDry;
  }
});
