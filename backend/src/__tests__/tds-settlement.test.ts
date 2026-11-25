import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * TDS settlement: tax the client deducted before paying settles the invoice together with cash (amount + tds_amount),
 * is never money received, and only a SUCCEEDED payment changes invoice status (a client's TDS claim is just a claim).
 * Integration tests need a LOCAL database (same switch as money-paths.test.ts).
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };

const FILES = "https://example.com/final-files";
let server: Server;
let base = "";
const created: { orgIds: string[] } = { orgIds: [] };
type Tenant = { token: string; orgId: string; customerId: string };
let a: Tenant;
let b: Tenant;
let seq = 0;

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

async function makeTenant(label: string): Promise<Tenant> {
  const email = `tds-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Tds-Settlement-Tenant-5827";
  assert.equal((await call("POST", "/api/auth/register", { email, password, organization_name: `Tds ${label}`, accepted_terms: true })).status, 201);
  const login = await call("POST", "/api/auth/login", { email, password });
  assert.equal(login.status, 200);
  created.orgIds.push(login.json.user.organization_id);
  // The free plan allows 5 invoices a month; these tests create more, so use a paid plan on the local test database.
  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  await prismaModule.runAsSystem(async () => await prisma.$executeRawUnsafe(`UPDATE organizations SET plan = 'PRO' WHERE id = $1::uuid`, login.json.user.organization_id));
  const customer = await call("POST", "/api/customers", { name: `Client ${label}`, email: `client-${label}-${Date.now()}@example.com` }, login.json.token);
  assert.equal(customer.status, 201);
  return { token: login.json.token, orgId: login.json.user.organization_id, customerId: customer.json.id };
}

async function makeInvoice(t: Tenant, amount: number) {
  seq += 1;
  const res = await call(
    "POST",
    "/api/invoices",
    { customer_id: t.customerId, invoice_number: `TDS-${Date.now()}-${seq}`, amount, issued_at: "2026-11-01", due_at: "2026-12-01", status: "OPEN", external_invoice_id: `vault:${FILES}` },
    t.token,
  );
  assert.equal(res.status, 201, `invoice create: ${JSON.stringify(res.json)}`);
  return res.json.id as string;
}

const pay = (t: Tenant, invoiceId: string, body: Record<string, unknown>) => call("POST", "/api/payments", { invoice_id: invoiceId, ...body }, t.token);
const detail = async (t: Tenant, id: string) => (await call("GET", `/api/invoices/${id}`, undefined, t.token)).json;
const publicPage = (id: string) => call("GET", `/api/public/invoices/${id}`);

before(async () => {
  if (!enabled) return;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const serverModule: any = await import("../server.js");
  const app = serverModule.default?.default ?? serverModule.default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  a = await makeTenant("a");
  b = await makeTenant("b");
});

after(async () => {
  if (!enabled) return;
  server?.close();
  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  await prismaModule.runAsSystem(async () => {
    for (const org of created.orgIds) {
      for (const table of ["payment_proof_images", "payments", "collection_actions", "messages", "conversations", "invoice_details", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

test("TDS: 50,000 invoice, 45,000 cash + 5,000 TDS is PAID and the files unlock", opts, async () => {
  const id = await makeInvoice(a, 50000);
  assert.equal((await publicPage(id)).json.deliverable_url, null, "locked before payment");
  const res = await pay(a, id, { amount: 45000, tds_amount: 5000, tds_section: "194j" });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(res.json.payment.tds_section, "194J");
  const d = await detail(a, id);
  assert.equal(d.invoice.status, "PAID");
  assert.equal(d.financial_summary.paid_amount, 45000, "cash received stays cash");
  assert.equal(d.financial_summary.tds_amount, 5000);
  assert.equal(d.financial_summary.outstanding_amount, 0);
  const page = await publicPage(id);
  assert.equal(page.json.status, "PAID");
  assert.equal(page.json.outstanding_amount, 0);
  assert.equal(page.json.paid_amount, 45000);
  assert.equal(page.json.tds_amount, 5000);
  assert.equal(page.json.deliverable_url, FILES, "files unlock once cash + TDS cover the invoice");
});

test("TDS: cash + TDS above the outstanding is rejected; bad TDS input is rejected", opts, async () => {
  const id = await makeInvoice(a, 50000);
  assert.equal((await pay(a, id, { amount: 45000.01, tds_amount: 5000 })).status, 409, "sum above the invoice");
  assert.equal((await pay(a, id, { amount: 50000, tds_amount: 0.01 })).status, 409, "even a tiny TDS on top of full cash");
  assert.equal((await pay(a, id, { amount: 45000, tds_amount: -1 })).status, 400, "negative TDS");
  assert.equal((await pay(a, id, { amount: 45000, tds_amount: "abc" })).status, 400, "non-numeric TDS");
  assert.equal((await pay(a, id, { amount: 45000, tds_amount: 5000, tds_section: "bad section!" })).status, 400, "section must be a short code");
  assert.equal((await detail(a, id)).invoice.status, "OPEN", "nothing was recorded");
  // The overpay guard also counts TDS from earlier payments.
  assert.equal((await pay(a, id, { amount: 20000, tds_amount: 5000 })).status, 201);
  assert.equal((await pay(a, id, { amount: 25000.01 })).status, 409, "earlier TDS already settled part of the invoice");
  assert.equal((await pay(a, id, { amount: 20000, tds_amount: 5000 })).status, 201);
  assert.equal((await detail(a, id)).invoice.status, "PAID");
});

test("TDS: TDS with partial cash is PARTIALLY_PAID, files stay locked, balance is right", opts, async () => {
  const id = await makeInvoice(a, 50000);
  assert.equal((await pay(a, id, { amount: 20000, tds_amount: 5000 })).status, 201);
  const d = await detail(a, id);
  assert.equal(d.invoice.status, "PARTIALLY_PAID");
  assert.equal(d.financial_summary.outstanding_amount, 25000);
  const page = await publicPage(id);
  assert.equal(page.json.outstanding_amount, 25000, "pay page (QR/UPI amount) asks only for the real balance");
  assert.equal(page.json.deliverable_url, null);
  assert.equal(page.json.deliverable_locked, true);
});

test("TDS: a PENDING or FAILED payment with TDS changes nothing (rule 1)", opts, async () => {
  const id = await makeInvoice(a, 1000);
  assert.equal((await pay(a, id, { amount: 900, tds_amount: 100, status: "PENDING" })).status, 201);
  assert.equal((await detail(a, id)).invoice.status, "OPEN");
  assert.equal((await detail(a, id)).financial_summary.tds_amount, 0, "unconfirmed TDS is not counted");
  assert.equal((await pay(a, id, { amount: 900, tds_amount: 100, status: "FAILED" })).status, 201);
  assert.equal((await detail(a, id)).invoice.status, "OPEN");
});

test("TDS: credit note and TDS together settle an invoice, and the credit-note maths counts TDS", opts, async () => {
  const id = await makeInvoice(a, 1000);
  assert.equal((await pay(a, id, { amount: 400, tds_amount: 100 })).status, 201);
  const tooMuch = await call("POST", "/api/credit-notes", { invoice_id: id, amount: 500.01, reason: "Scope reduced" }, a.token);
  assert.equal(tooMuch.status, 409, "500 is left after 400 cash + 100 TDS, so 500.01 is too much");
  assert.equal((await call("POST", "/api/credit-notes", { invoice_id: id, amount: 300, reason: "Scope reduced" }, a.token)).status, 201);
  assert.equal((await detail(a, id)).financial_summary.outstanding_amount, 200);
  assert.equal((await pay(a, id, { amount: 150, tds_amount: 50.01 })).status, 409, "credit + TDS + cash above the invoice");
  assert.equal((await pay(a, id, { amount: 150, tds_amount: 50 })).status, 201);
  const d = await detail(a, id);
  assert.equal(d.invoice.status, "PAID");
  assert.equal(d.financial_summary.outstanding_amount, 0);
  assert.equal((await publicPage(id)).json.deliverable_url, FILES);
});

test("TDS: payments recorded without TDS behave exactly as before (tds 0)", opts, async () => {
  const id = await makeInvoice(a, 1000);
  const first = await pay(a, id, { amount: 400 });
  assert.equal(first.status, 201);
  assert.equal(Number(first.json.payment.tds_amount), 0);
  assert.equal(first.json.payment.tds_section, null);
  assert.equal((await detail(a, id)).invoice.status, "PARTIALLY_PAID");
  assert.equal((await pay(a, id, { amount: 600 })).status, 201);
  const d = await detail(a, id);
  assert.equal(d.invoice.status, "PAID");
  assert.equal(d.financial_summary.tds_amount, 0);
  assert.equal(d.financial_summary.paid_amount, 1000);
  // A section without an amount is ignored, not stored.
  const id2 = await makeInvoice(a, 1000);
  const noTds = await pay(a, id2, { amount: 1000, tds_section: "194J" });
  assert.equal(noTds.status, 201);
  assert.equal(noTds.json.payment.tds_section, null);
});

test("TDS: another business cannot record a TDS payment on this invoice", opts, async () => {
  const id = await makeInvoice(a, 1000);
  assert.equal((await pay(b, id, { amount: 900, tds_amount: 100 })).status, 404);
  assert.equal((await call("POST", "/api/payments", { organization_id: a.orgId, invoice_id: id, amount: 900, tds_amount: 100 }, b.token)).status, 403);
  assert.equal((await detail(a, id)).invoice.status, "OPEN");
});

test("TDS CLAIM: the client's claim is only a claim; the seller confirms it, then it settles", opts, async () => {
  const id = await makeInvoice(a, 50000);
  const bad = (body: Record<string, unknown>) => call("POST", `/api/public/invoices/${id}/submit-proof`, { utr: "UTR1234567890", ...body });
  assert.equal((await bad({ tds_amount: 50000 })).status, 400, "TDS cannot be the whole amount");
  assert.equal((await bad({ tds_amount: -5 })).status, 400);
  assert.equal((await bad({ tds_amount: 5000, tds_section: "x y" })).status, 400);
  assert.equal((await bad({ tds_amount: 5000, amount: 45000.5 })).status, 400, "cash + TDS above the amount due");

  const proof = await bad({ tds_amount: 5000, tds_section: "194j" });
  assert.equal(proof.status, 200, JSON.stringify(proof.json));
  // Nothing settled by the claim itself.
  assert.equal((await detail(a, id)).invoice.status, "OPEN");
  const page = await publicPage(id);
  assert.equal(page.json.outstanding_amount, 50000);
  assert.equal(page.json.tds_amount, 0);
  assert.equal(page.json.deliverable_url, null);
  assert.equal(page.json.pending_verification, true);

  // The seller sees the claim in the Action Queue.
  const actions = await call("GET", "/api/collection-actions", undefined, a.token);
  const list = Array.isArray(actions.json) ? actions.json : actions.json.value ?? actions.json.actions ?? [];
  const action = list.find((x: any) => x.id === proof.json.action_id);
  assert.ok(action, "action visible to the seller");
  assert.equal(Number(action.metadata.tds_amount), 5000);
  assert.equal(action.metadata.tds_section, "194J");
  assert.equal(Number(action.metadata.amount), 45000, "cash defaults to what is due after TDS");

  // Another business cannot confirm it.
  assert.equal((await call("POST", `/api/collection-actions/${proof.json.action_id}/verify-proof`, {}, b.token)).status, 404);

  const confirm = await call("POST", `/api/collection-actions/${proof.json.action_id}/verify-proof`, {}, a.token);
  assert.equal(confirm.status, 200, JSON.stringify(confirm.json));
  const d = await detail(a, id);
  assert.equal(d.invoice.status, "PAID");
  assert.equal(d.financial_summary.paid_amount, 45000);
  assert.equal(d.financial_summary.tds_amount, 5000);
  assert.equal((await publicPage(id)).json.deliverable_url, FILES);
});

test("TDS CLAIM: a partial proof with a TDS claim leaves the invoice PARTIALLY_PAID after confirmation", opts, async () => {
  const id = await makeInvoice(a, 50000);
  const proof = await call("POST", `/api/public/invoices/${id}/submit-proof`, { utr: "UTR9988776655", amount: 20000, tds_amount: 5000 });
  assert.equal(proof.status, 200, JSON.stringify(proof.json));
  assert.equal((await call("POST", `/api/collection-actions/${proof.json.action_id}/verify-proof`, {}, a.token)).status, 200);
  const d = await detail(a, id);
  assert.equal(d.invoice.status, "PARTIALLY_PAID");
  assert.equal(d.financial_summary.outstanding_amount, 25000);
  assert.equal((await publicPage(id)).json.deliverable_url, null);
});

test("TDS: analytics lists TDS to claim by financial year (April to March) and keeps cash as money received", opts, async () => {
  const t = await makeTenant("fy");
  const id = await makeInvoice(t, 10000);
  const recorded = await pay(t, id, { amount: 9000, tds_amount: 1000, tds_section: "194J", paid_at: "2026-02-15T10:00:00.000Z" });
  assert.equal(recorded.status, 201, JSON.stringify(recorded.json));
  const id2 = await makeInvoice(t, 10000);
  assert.equal((await pay(t, id2, { amount: 8000, tds_amount: 2000, paid_at: "2026-06-10T10:00:00.000Z" })).status, 201);
  const res = await call("GET", "/api/dashboard/analytics", undefined, t.token);
  assert.equal(res.status, 200);
  const byFy = Object.fromEntries((res.json.tds_by_year as any[]).map((r) => [r.fy, r.tds]));
  assert.equal(byFy["2025-26"], 1000, "15 Feb 2026 falls in FY 2025-26");
  assert.equal(byFy["2026-27"], 2000, "10 Jun 2026 falls in FY 2026-27");
  assert.equal(res.json.kpi.lifetime_received, 17000, "money received is cash only");
  assert.equal(res.json.kpi.outstanding, 0, "TDS settled both invoices");
});
