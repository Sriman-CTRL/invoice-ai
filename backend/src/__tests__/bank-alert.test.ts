import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { parseBankAlert } from "../lib/bankAlert";

/**
 * Bank-alert suggestions. The fixtures are SYNTHETIC (written for these tests, "Example Bank"); they do not claim that
 * any real bank's alerts parse. The integration tests prove an alert can only ever create a suggestion.
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };
const SECRET = "test-inbound-secret-0123456789";

const alertText = (amount: string, ref: string, extra = "") =>
  `Dear Customer, INR ${amount} is credited to your A/c XX1234 on 22-Nov-26 by UPI Ref No ${ref}. Avl Bal INR 98,765.43. ${extra}-Example Bank`;

// ---------- parser ----------

test("parseBankAlert: reads one credit with its reference and ignores the balance", () => {
  assert.deepEqual(parseBankAlert(alertText("12,500.00", "432112345678")), { amount: 12500, reference: "432112345678" });
  assert.deepEqual(parseBankAlert("Rs.7,351.25 credited to a/c XX5678 via IMPS. Ref: 543210987654", "Credit alert"), { amount: 7351.25, reference: "543210987654" });
  assert.deepEqual(parseBankAlert("₹ 1,00,000 has been credited. UTR: SBIN12345678901234 Available balance ₹ 2,50,000.50"), { amount: 100000, reference: "SBIN12345678901234" });
  assert.deepEqual(parseBankAlert(alertText("99", "123456789012").replace(/\s+/g, "\n")), { amount: 99, reference: "123456789012" });
});

test("parseBankAlert: stays quiet when anything is ambiguous or not a credit", () => {
  assert.equal(parseBankAlert(alertText("500.00", "432112345678").replace("credited", "debited")), null, "debit");
  assert.equal(parseBankAlert("INR 500.00 will be credited to your account soon. Ref 432112345678"), null, "future credit");
  assert.equal(parseBankAlert("INR 500.00 credited. Ref 432112345678. INR 800.00 debited earlier."), null, "mentions a debit too");
  assert.equal(parseBankAlert("INR 500.00 credited to your account"), null, "no reference");
  assert.equal(parseBankAlert("INR 500.00 and INR 700.00 credited. Ref 432112345678"), null, "two amounts");
  assert.equal(parseBankAlert("Your OTP is 123456. Never share it."), null);
  assert.equal(parseBankAlert("credited"), null, "too short");
  assert.equal(parseBankAlert("Hi, I have credited INR 500 to you. Ref hello"), null, "reference without digits");
  assert.equal(parseBankAlert(""), null);
});

// ---------- integration ----------

let server: Server;
let base = "";
let prismaModule: any;
let prisma: any;
const created: { orgIds: string[] } = { orgIds: [] };
type Tenant = { token: string; orgId: string; customerId: string; email: string };

const sys = (fn: () => Promise<any>): Promise<any> => prismaModule.runAsSystem(async () => await fn());
async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const inbound = (payload: Record<string, unknown>) =>
  call("POST", "/api/inbound/email", payload, undefined, { "x-inbound-key": SECRET, "x-inbound-timestamp": String(Math.floor(Date.now() / 1000)) });

async function makeTenant(label: string): Promise<Tenant> {
  const email = `bank-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Bank-Alert-Tenant-6204";
  assert.equal((await call("POST", "/api/auth/register", { email, password, organization_name: `Bank ${label}`, accepted_terms: true })).status, 201);
  const login = await call("POST", "/api/auth/login", { email, password });
  const orgId = login.json.user.organization_id as string;
  created.orgIds.push(orgId);
  await sys(() => prisma.$executeRawUnsafe(`UPDATE organizations SET plan = 'PRO' WHERE id = $1::uuid`, orgId));
  const customer = await call("POST", "/api/customers", { name: `Client ${label}`, email: `client-${label}-${Date.now()}@example.com` }, login.json.token);
  return { token: login.json.token, orgId, customerId: customer.json.id, email };
}
async function invoice(t: Tenant, amount: number) {
  const res = await call("POST", "/api/invoices", { customer_id: t.customerId, invoice_number: `BA-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, amount, issued_at: "2026-11-01", due_at: "2026-12-01", status: "OPEN" }, t.token);
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return res.json.id as string;
}
const status = async (t: Tenant, id: string) => (await call("GET", `/api/invoices/${id}`, undefined, t.token)).json.invoice.status as string;
const suggestions = (orgId: string, invoiceId: string) =>
  sys(() => prisma.collection_actions.findMany({ where: { organization_id: orgId, invoice_id: invoiceId, action_type: "PAYMENT_MATCH_SUGGESTED" } }));
const payments = (orgId: string, invoiceId: string) => sys(() => prisma.payments.findMany({ where: { organization_id: orgId, invoice_id: invoiceId } }));
const forward = (t: Tenant, text: string, over: Record<string, unknown> = {}) =>
  inbound({ organization_id: t.orgId, from: t.email, to: "alerts@example.test", subject: "Fwd: credit alert", text, ...over });

before(async () => {
  process.env.INBOUND_WEBHOOK_SECRET = SECRET;
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
      for (const table of ["payments", "collection_actions", "messages", "conversations", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

test("ALERT: a strong match (same UTR as the client's proof) is only a suggestion, never a payment", opts, async () => {
  const t = await makeTenant("strong");
  const id = await invoice(t, 5000);
  const proof = await call("POST", `/api/public/invoices/${id}/submit-proof`, { utr: "987654321012", amount: 5000 });
  assert.equal(proof.status, 200);

  const res = await forward(t, alertText("5,000.00", "987654321012"));
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.bank_alert.kind, "SUGGESTED");
  assert.equal(res.json.bank_alert.match, "STRONG");

  const list = await suggestions(t.orgId, id);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "PENDING");
  assert.equal(list[0].metadata.utr, "987654321012");
  assert.ok(list[0].metadata.payment_id, "points at the client's pending payment");
  assert.match(list[0].metadata.evidence, /same UTR/);

  // The invariant: nothing settled, nothing changed.
  assert.equal(await status(t, id), "OPEN");
  const pays = await payments(t.orgId, id);
  assert.equal(pays.filter((p: any) => p.status === "SUCCEEDED").length, 0);
  assert.equal(pays.length, 1, "no extra payment row either");

  // Same alert again: no second suggestion.
  const again = await forward(t, alertText("5,000.00", "987654321012"));
  assert.equal(again.json.bank_alert.kind, "DUPLICATE");
  assert.equal((await suggestions(t.orgId, id)).length, 1);

  // Only the seller's own one-click confirmation settles it.
  const settle = await call("POST", `/api/collection-actions/${list[0].id}/verify-proof`, {}, t.token);
  assert.equal(settle.status, 200, JSON.stringify(settle.json));
  assert.equal(await status(t, id), "PAID");
});

test("ALERT: a weak match needs exactly one open invoice with that balance", opts, async () => {
  const t = await makeTenant("weak");
  const only = await invoice(t, 7351.25);
  const twinA = await invoice(t, 4200);
  const twinB = await invoice(t, 4200);

  const weak = await forward(t, alertText("7,351.25", "543210987654"));
  assert.equal(weak.json.bank_alert.kind, "SUGGESTED");
  assert.equal(weak.json.bank_alert.match, "WEAK");
  const list = await suggestions(t.orgId, only);
  assert.equal(list.length, 1);
  assert.equal(list[0].metadata.payment_id, undefined);
  assert.equal(await status(t, only), "OPEN");
  assert.equal((await payments(t.orgId, only)).length, 0, "a weak match creates no payment row");

  const ambiguous = await forward(t, alertText("4,200.00", "111222333444"));
  assert.equal(ambiguous.json.bank_alert.kind, "NO_MATCH");
  assert.equal((await suggestions(t.orgId, twinA)).length + (await suggestions(t.orgId, twinB)).length, 0);

  const nothing = await forward(t, alertText("1,234.56", "555666777888"));
  assert.equal(nothing.json.bank_alert.kind, "NO_MATCH");
});

test("ALERT: another business's invoices are never matched", opts, async () => {
  const a = await makeTenant("isoa");
  const b = await makeTenant("isob");
  const bInvoice = await invoice(b, 3333);
  const res = await forward(a, alertText("3,333.00", "246801357924"));
  assert.equal(res.json.bank_alert.kind, "NO_MATCH");
  assert.equal((await suggestions(b.orgId, bInvoice)).length, 0);
});

test("ALERT: emails from strangers and debit alerts go through the normal pipeline, not the alert path", opts, async () => {
  const t = await makeTenant("stranger");
  const id = await invoice(t, 6100);
  const stranger = await forward(t, alertText("6,100.00", "135792468013"), { from: "someone-else@example.org" });
  assert.equal(stranger.status, 200);
  assert.equal(stranger.json.bank_alert, undefined, "not treated as a bank alert");
  const debit = await forward(t, alertText("6,100.00", "135792468014").replace("credited", "debited"));
  assert.equal(debit.json.bank_alert, undefined);
  assert.equal((await suggestions(t.orgId, id)).length, 0);
  assert.equal(await status(t, id), "OPEN");
});

test("ALERT: the inbound key and timestamp are still required", opts, async () => {
  const noKey = await call("POST", "/api/inbound/email", { from: "x@example.com", text: alertText("1.00", "135792468013") });
  assert.equal(noKey.status, 401);
});
