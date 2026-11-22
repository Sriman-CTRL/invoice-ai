import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * Integration tests: prove one business can never read or change another's data,
 * and that the public pay page cannot be abused. Runs against a real database, so it
 * only runs when DATABASE_URL is local (CI) or INTEGRATION_TESTS=1 is set deliberately.
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };

let server: Server;
let base = "";
const created: { orgIds: string[] } = { orgIds: [] };

type Tenant = { token: string; orgId: string; customerId: string; invoiceId: string };

async function call(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

async function makeTenant(label: string, invoiceNumber: string): Promise<Tenant> {
  const email = `iso-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Isolation12345";
  const reg = await call("POST", "/api/auth/register", { email, password, organization_name: `Iso ${label}` });
  assert.equal(reg.status, 201, "register");
  const login = await call("POST", "/api/auth/login", { email, password });
  assert.equal(login.status, 200, "login");
  const token = login.json.token as string;
  const orgId = login.json.user.organization_id as string;
  created.orgIds.push(orgId);
  const customer = await call("POST", "/api/customers", { name: `Client ${label}`, email: `client-${label}@example.com`, phone: "9999999999" }, token);
  assert.equal(customer.status, 201, "customer");
  const invoice = await call(
    "POST",
    "/api/invoices",
    { customer_id: customer.json.id, invoice_number: invoiceNumber, amount: 1000, issued_at: "2026-11-01", due_at: "2026-12-01", external_invoice_id: "vault:https://example.com/files" },
    token,
  );
  assert.equal(invoice.status, 201, "invoice");
  return { token, orgId, customerId: customer.json.id, invoiceId: invoice.json.id };
}

let a: Tenant;
let b: Tenant;

before(async () => {
  if (!enabled) return;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const { default: app } = await import("../server");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Same invoice number in both orgs on purpose: numbers are only unique per business.
  a = await makeTenant("a", "INV-SAME");
  b = await makeTenant("b", "INV-SAME");
});

after(async () => {
  if (!enabled) return;
  server?.close();
  const { default: prisma } = await import("../lib/prisma");
  for (const org of created.orgIds) {
    for (const table of ["payments", "collection_actions", "messages", "conversations", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
      await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
    }
    await prisma.$executeRawUnsafe(`DELETE FROM plan_requests WHERE organization_id = $1::uuid`, org).catch(() => undefined);
    await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
  }
  await prisma.$disconnect();
});

test("ISOLATION: org B cannot read org A's invoice, customer or lists", opts, async () => {
  assert.equal((await call("GET", `/api/invoices/${a.invoiceId}`, undefined, b.token)).status, 404);
  assert.equal((await call("GET", `/api/customers/${a.customerId}`, undefined, b.token)).status, 404);
  const list = await call("GET", "/api/invoices", undefined, b.token);
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(list.json).includes(a.invoiceId), "B's invoice list must not contain A's invoice");
  const customers = await call("GET", "/api/customers", undefined, b.token);
  assert.ok(!JSON.stringify(customers.json).includes(a.customerId), "B's customer list must not contain A's customer");
});

test("ISOLATION: org B cannot act on org A's records", opts, async () => {
  const pay = await call("POST", "/api/payments", { invoice_id: a.invoiceId, amount: 100 }, b.token);
  assert.ok([403, 404].includes(pay.status), `payment on foreign invoice should fail, got ${pay.status}`);
  const remind = await call("POST", `/api/invoices/${a.invoiceId}/send-reminder`, {}, b.token);
  assert.ok([403, 404].includes(remind.status), `reminder on foreign invoice should fail, got ${remind.status}`);
  const erase = await call("POST", `/api/customers/${a.customerId}/erasure`, undefined, b.token);
  assert.ok([403, 404].includes(erase.status), `erasure of foreign customer should fail, got ${erase.status}`);
  const stillThere = await call("GET", `/api/customers/${a.customerId}`, undefined, a.token);
  assert.equal(stillThere.status, 200);
  assert.notEqual(stillThere.json.customer?.name, "Anonymized Debtor");
});

test("ISOLATION: a spoofed organization_id is rejected", opts, async () => {
  assert.equal((await call("GET", `/api/invoices?organization_id=${a.orgId}`, undefined, b.token)).status, 403);
  const forged = await call("POST", "/api/customers", { organization_id: a.orgId, name: "Evil", email: "evil@example.com" }, b.token);
  assert.equal(forged.status, 403);
});

test("AUTH: missing, malformed and unsigned tokens are rejected", opts, async () => {
  assert.equal((await call("GET", "/api/invoices")).status, 401);
  assert.equal((await call("GET", "/api/invoices", undefined, "not-a-token")).status, 401);
  const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: a.orgId, organization_id: a.orgId })).toString("base64url")}.`;
  assert.equal((await call("GET", "/api/invoices", undefined, unsigned)).status, 401);
});

test("AUTH: non-admins are refused by the platform admin endpoints", opts, async () => {
  assert.equal((await call("GET", "/api/admin/plan-requests", undefined, a.token)).status, 403);
  assert.deepEqual((await call("GET", "/api/admin/me", undefined, a.token)).json, { is_admin: false });
  assert.equal((await call("POST", "/api/admin/plan-requests/00000000-0000-0000-0000-000000000000/approve", {}, a.token)).status, 403);
});

test("PUBLIC: pay links only resolve by random id, never by invoice number", opts, async () => {
  assert.equal((await call("GET", "/api/public/invoices/INV-SAME")).status, 404, "duplicate invoice numbers must not resolve");
  const pageA = await call("GET", `/api/public/invoices/${a.invoiceId}`);
  assert.equal(pageA.status, 200);
  assert.equal(pageA.json.organization.name, "Iso a");
  const pageB = await call("GET", `/api/public/invoices/${b.invoiceId}`);
  assert.equal(pageB.json.organization.name, "Iso b");
  assert.equal(pageA.json.customer.email, null, "client email must not be exposed publicly");
  assert.equal(pageA.json.customer.phone, null, "client phone must not be exposed publicly");
  assert.equal(pageA.json.deliverable_url, null, "deliverable stays hidden while unpaid");
  assert.equal(pageA.json.deliverable_locked, true);
});

test("PUBLIC: proof submission validates input and blocks abuse", opts, async () => {
  const path = `/api/public/invoices/${a.invoiceId}/submit-proof`;
  assert.equal((await call("POST", path, { utr: "<script>alert(1)</script>" })).status, 400);
  assert.equal((await call("POST", path, { utr: "123456789012", amount: 999999 })).status, 400);
  assert.equal((await call("POST", path, { utr: "123456789012", notes: "x".repeat(600) })).status, 400);
  assert.equal((await call("POST", path, { utr: "123456789012", paid_at: "2999-01-01" })).status, 400);
  assert.equal((await call("POST", path, { utr: "PARTIAL400ABC", amount: 400 })).status, 200);
  assert.equal((await call("POST", path, { utr: "PARTIAL400ABC", amount: 400 })).status, 409, "duplicate UTR");
});

test("PAYMENTS: confirming a partial proof does NOT mark paid or unlock the vault", opts, async () => {
  const actions = await call("GET", "/api/collection-actions", undefined, a.token);
  const proof = (actions.json.value as any[]).find((x) => x.action_type === "VERIFY_PAYMENT_PROOF");
  assert.ok(proof, "proof action exists");
  const verified = await call("POST", `/api/collection-actions/${proof.id}/verify-proof`, {}, a.token);
  assert.equal(verified.status, 200);
  assert.equal(verified.json.invoice.status, "PARTIALLY_PAID");
  const page = await call("GET", `/api/public/invoices/${a.invoiceId}`);
  assert.equal(page.json.deliverable_locked, true);
  assert.equal(page.json.deliverable_url, null);
  assert.equal(page.json.outstanding_amount, 600);
  // B can never settle A's action.
  assert.ok([403, 404].includes((await call("POST", `/api/collection-actions/${proof.id}/verify-proof`, {}, b.token)).status));
});

test("INPUT: deliverable links must be plain http(s) URLs", opts, async () => {
  const bad = await call(
    "POST",
    "/api/invoices",
    { customer_id: b.customerId, invoice_number: "INV-XSS", amount: 10, issued_at: "2026-11-01", due_at: "2026-12-01", external_invoice_id: "vault:javascript:alert(1)" },
    b.token,
  );
  assert.equal(bad.status, 400);
});

test("AUTH: weak passwords are rejected and repeated bad logins are locked out", opts, async () => {
  assert.equal((await call("POST", "/api/auth/register", { email: `weak-${Date.now()}@example.com`, password: "password", organization_name: "Weak" })).status, 400);
  const email = `lock-${Date.now()}@example.com`;
  const reg = await call("POST", "/api/auth/register", { email, password: "Lockout12345", organization_name: "Lock" });
  assert.equal(reg.status, 201);
  const lockedOrg = (await call("POST", "/api/auth/login", { email, password: "Lockout12345" })).json.user.organization_id;
  created.orgIds.push(lockedOrg);
  const codes: number[] = [];
  for (let i = 0; i < 10; i++) codes.push((await call("POST", "/api/auth/login", { email, password: `wrong-${i}` }, undefined, { "x-test": String(i) })).status);
  assert.ok(codes.includes(429), `expected a lockout, got ${codes.join(",")}`);
  assert.equal((await call("POST", "/api/auth/login", { email, password: "Lockout12345" })).status, 429, "correct password is refused while locked");
});

test("CORS: arbitrary *.vercel.app origins are not trusted", opts, async () => {
  const res = await fetch(`${base}/api/invoices`, { method: "OPTIONS", headers: { Origin: "https://evil-site.vercel.app", "Access-Control-Request-Method": "GET" } });
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});
