import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * Export invoices (clients outside India): non-INR currencies, SWIFT, an optional other payment link, LUT number and
 * the seller's own declaration text (empty by default), and per-currency analytics. Needs a LOCAL database.
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };

let server: Server;
let base = "";
const created: { orgIds: string[] } = { orgIds: [] };
type Tenant = { token: string; orgId: string; customerId: string };
let prisma: any;
let runAsSystem: any;
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
  const email = `exp-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Export-Tenant-5827";
  assert.equal((await call("POST", "/api/auth/register", { email, password, organization_name: `Exp ${label}`, accepted_terms: true })).status, 201);
  const login = await call("POST", "/api/auth/login", { email, password });
  created.orgIds.push(login.json.user.organization_id);
  await runAsSystem(async () => await prisma.$executeRawUnsafe(`UPDATE organizations SET plan = 'PRO' WHERE id = $1::uuid`, login.json.user.organization_id));
  const customer = await call("POST", "/api/customers", { name: `Client ${label}`, email: `client-${label}-${Date.now()}@example.com` }, login.json.token);
  return { token: login.json.token, orgId: login.json.user.organization_id, customerId: customer.json.id };
}
const put = (t: Tenant, body: Record<string, unknown>) => call("PUT", "/api/organizations/settings", body, t.token);
async function invoice(t: Tenant, currency: string | undefined, amount = 1000) {
  seq += 1;
  return call("POST", "/api/invoices", { customer_id: t.customerId, invoice_number: `EXP-${Date.now()}-${seq}`, amount, issued_at: "2026-11-01", due_at: "2026-12-01", status: "OPEN", ...(currency ? { currency } : {}) }, t.token);
}
const page = (id: string) => call("GET", `/api/public/invoices/${id}`);

before(async () => {
  if (!enabled) return;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const prismaModule: any = await import("../lib/prisma.js");
  prisma = prismaModule.default?.default ?? prismaModule.default;
  runAsSystem = prismaModule.runAsSystem;
  const serverModule: any = await import("../server.js");
  server = (serverModule.default?.default ?? serverModule.default).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  if (!enabled) return;
  server?.close();
  await runAsSystem(async () => {
    for (const org of created.orgIds) {
      for (const table of ["payments", "collection_actions", "messages", "conversations", "invoice_details", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

test("EXPORT: only the supported currencies are accepted, and codes are upper-cased", opts, async () => {
  const t = await makeTenant("cur");
  for (const c of ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "INR"]) assert.equal((await invoice(t, c)).status, 201, c);
  assert.equal((await invoice(t, "XYZ")).status, 400);
  assert.equal((await invoice(t, "dollars")).status, 400);
  const lower = await invoice(t, "usd");
  assert.equal(lower.status, 201);
  assert.equal(lower.json.currency, "USD");
  assert.equal((await invoice(t, undefined)).json.currency, "INR");
});

test("EXPORT: settings validate SWIFT, the payment link (https only) and the LUT number", opts, async () => {
  const t = await makeTenant("set");
  assert.equal((await put(t, { swift_code: "bad" })).status, 400);
  assert.equal((await put(t, { payment_link: "http://paypal.me/x" })).status, 400, "http is refused");
  assert.equal((await put(t, { payment_link: "javascript:alert(1)" })).status, 400);
  assert.equal((await put(t, { lut_number: "!!" })).status, 400);
  const ok = await put(t, { swift_code: "hdfcinbb", payment_link: "https://wise.com/pay/me/example", lut_number: "AD290000000000A", export_declaration: "Your own wording here." });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.swift_code, "HDFCINBB");
  assert.equal(ok.json.export_declaration, "Your own wording here.");
});

test("EXPORT: the pay page shows SWIFT, the link and the seller's LUT text on foreign invoices only, and nothing by default", opts, async () => {
  const t = await makeTenant("pay");
  assert.equal((await put(t, { bank_account_name: "Seller", bank_account_number: "123456789", bank_ifsc: "HDFC0001234", bank_name: "HDFC Bank" })).status, 200);
  const usdDefault = (await page((await invoice(t, "USD")).json.id)).json;
  assert.equal(usdDefault.export, null, "no export text unless the seller wrote it (Paivo ships no default)");
  assert.equal(usdDefault.payment.payment_link, null);

  assert.equal((await put(t, { swift_code: "HDFCINBB", payment_link: "https://wise.com/pay/me/example", lut_number: "LUT-123/2026", export_declaration: "Seller own export line." })).status, 200);
  const usd = (await page((await invoice(t, "USD")).json.id)).json;
  assert.equal(usd.payment.bank.swift_code, "HDFCINBB");
  assert.equal(usd.payment.payment_link, "https://wise.com/pay/me/example");
  assert.deepEqual(usd.export, { lut_number: "LUT-123/2026", declaration: "Seller own export line." });

  const inr = (await page((await invoice(t, "INR")).json.id)).json;
  assert.equal(inr.export, null);
  assert.equal(inr.payment.payment_link, null);
  assert.equal(inr.payment.bank.swift_code, null);
});

test("EXPORT: analytics never add USD to INR; other currencies are totalled separately", opts, async () => {
  const t = await makeTenant("ana");
  const inr = await invoice(t, "INR", 1000);
  const usd1 = await invoice(t, "USD", 200);
  await invoice(t, "USD", 300);
  await invoice(t, "EUR", 50);
  assert.equal((await call("POST", "/api/payments", { invoice_id: inr.json.id, amount: 1000 }, t.token)).status, 201);
  assert.equal((await call("POST", "/api/payments", { invoice_id: usd1.json.id, amount: 200 }, t.token)).status, 201);
  const res = await call("GET", "/api/dashboard/analytics", undefined, t.token);
  assert.equal(res.status, 200);
  assert.equal(res.json.kpi.lifetime_received, 1000, "USD payments are not added to INR received");
  assert.equal(res.json.kpi.outstanding, 0, "the open USD and EUR invoices are not added to INR outstanding");
  assert.equal(res.json.months.reduce((a: number, m: any) => a + m.invoiced, 0), 1000);
  const by = Object.fromEntries(res.json.other_currencies.map((c: any) => [c.currency, c]));
  assert.equal(by.USD.invoiced, 500);
  assert.equal(by.USD.received, 200);
  assert.equal(by.USD.outstanding, 300);
  assert.equal(by.EUR.invoiced, 50);
  assert.ok(!by.INR);
});
