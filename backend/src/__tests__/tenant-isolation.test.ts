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
  const password = "Isolate-Tenant-7391";
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
  const serverModule: any = await import("../server.js");
  const app = serverModule.default?.default ?? serverModule.default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Same invoice number in both orgs on purpose: numbers are only unique per business.
  a = await makeTenant("a", "INV-SAME");
  b = await makeTenant("b", "INV-SAME");
});

after(async () => {
  if (!enabled) return;
  server?.close();
  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  const runAsSystem = prismaModule.runAsSystem;
  await runAsSystem(async () => {
    for (const org of created.orgIds) {
      for (const table of ["payment_proof_images", "payments", "collection_actions", "messages", "conversations", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM plan_requests WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
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
  const reg = await call("POST", "/api/auth/register", { email, password: "Lockout-Tenant-7391", organization_name: "Lock" });
  assert.equal(reg.status, 201);
  const lockedOrg = (await call("POST", "/api/auth/login", { email, password: "Lockout-Tenant-7391" })).json.user.organization_id;
  created.orgIds.push(lockedOrg);
  const codes: number[] = [];
  for (let i = 0; i < 10; i++) codes.push((await call("POST", "/api/auth/login", { email, password: `wrong-${i}` }, undefined, { "x-test": String(i) })).status);
  assert.ok(codes.includes(429), `expected a lockout, got ${codes.join(",")}`);
  assert.equal((await call("POST", "/api/auth/login", { email, password: "Lockout-Tenant-7391" })).status, 429, "correct password is refused while locked");
});

test("CORS: arbitrary *.vercel.app origins are not trusted", opts, async () => {
  const res = await fetch(`${base}/api/invoices`, { method: "OPTIONS", headers: { Origin: "https://evil-site.vercel.app", "Access-Control-Request-Method": "GET" } });
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("SCREENSHOT: only real PNG/JPEG/WebP images are accepted", opts, async () => {
  const path = `/api/public/invoices/${b.invoiceId}/submit-proof`;
  const fakePng = "data:image/png;base64," + Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
  assert.equal((await call("POST", path, { utr: "FAKEIMG12345", screenshot: fakePng })).status, 400, "text disguised as png");
  const svg = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>').toString("base64");
  assert.equal((await call("POST", path, { utr: "SVGIMG123456", screenshot: svg })).status, 400, "svg is never accepted");
  const huge = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500 * 1024)]).toString("base64");
  assert.equal((await call("POST", path, { utr: "HUGEIMG12345", screenshot: huge })).status, 400, "over 400 KB");
});

test("SCREENSHOT: a valid screenshot is stored and only the owning business can view it", opts, async () => {
  const sent = await call("POST", `/api/public/invoices/${b.invoiceId}/submit-proof`, { utr: "SHOT12345678", amount: 100, screenshot: TINY_PNG });
  assert.equal(sent.status, 200);
  const actions = await call("GET", "/api/collection-actions", undefined, b.token);
  const action = (actions.json.value as any[]).find((x) => x.action_type === "VERIFY_PAYMENT_PROOF" && x.metadata?.has_screenshot);
  assert.ok(action, "proof action flagged with has_screenshot");

  const img = await fetch(`${base}/api/collection-actions/${action.id}/proof-image`, { headers: { Authorization: `Bearer ${b.token}` } });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.equal(img.headers.get("x-content-type-options"), "nosniff");
  assert.match(img.headers.get("cache-control") || "", /no-store/);
  assert.match(img.headers.get("content-security-policy") || "", /sandbox/);

  assert.equal((await call("GET", `/api/collection-actions/${action.id}/proof-image`, undefined, a.token)).status, 404, "other business cannot see it");
  assert.equal((await call("GET", `/api/collection-actions/${action.id}/proof-image`)).status, 401, "anonymous cannot see it");
});

test("ANALYTICS: page views are recorded without personal data and the report is admin-only", opts, async () => {
  const ok = await call("POST", "/api/events", { event: "pageview", path: `/pay/${a.invoiceId}`, referrer: "https://www.linkedin.com/feed/?x=1", visitor: "abcdef1234567890" });
  assert.equal(ok.status, 204);
  assert.equal((await call("POST", "/api/events", { event: "evil", path: "/x" })).status, 204, "unknown events are ignored, not errors");
  assert.equal((await call("GET", "/api/admin/analytics", undefined, a.token)).status, 403, "non-admin refused");

  // Make tenant A's owner a platform admin for this test only.
  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  const email = await prismaModule.runAsSystem(async () => (await prisma.$queryRawUnsafe("SELECT email FROM users WHERE organization_id = $1::uuid LIMIT 1", a.orgId))[0].email);
  const previous = process.env.PLATFORM_ADMIN_EMAILS;
  process.env.PLATFORM_ADMIN_EMAILS = email;
  try {
    const report = await call("GET", "/api/admin/analytics?days=7", undefined, a.token);
    assert.equal(report.status, 200);
    assert.ok(report.json.funnel && report.json.totals, "report has funnel and totals");
    assert.ok(report.json.pages.find((p: any) => p.path === "/pay/:id"), "invoice uuid in the path was normalised to :id");
    assert.ok(!JSON.stringify(report.json).includes(a.invoiceId), "raw invoice ids are never stored");
    assert.ok(report.json.referrers.some((r: any) => r.referrer === "www.linkedin.com"), "referrer reduced to hostname");
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = previous;
  }
});

test("PASSWORD: changing a password needs the current one, enforces strength, and replaces the old one", opts, async () => {
  const email = `pw-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const first = "OriginalPass2468";
  const reg = await call("POST", "/api/auth/register", { email, password: first, organization_name: "PW Org" });
  assert.equal(reg.status, 201);
  const login = await call("POST", "/api/auth/login", { email, password: first });
  created.orgIds.push(login.json.user.organization_id);
  const token = login.json.token as string;

  assert.equal((await call("PUT", "/api/auth/password", { current_password: first, new_password: "Brand-New-Pass-9051" })).status, 401, "must be signed in");
  const wrong = await call("PUT", "/api/auth/password", { current_password: "not-my-password", new_password: "Brand-New-Pass-9051" }, token);
  assert.equal(wrong.status, 400);
  assert.match(wrong.json.error, /current password/i);

  for (const weak of ["short1A", "onlyletterslongpassword", "Password123456789", "Mypassword-1234567", email.split("@")[0] + "9"]) {
    const r = await call("PUT", "/api/auth/password", { current_password: first, new_password: weak }, token);
    assert.equal(r.status, 400, `weak password should be rejected: ${weak}`);
  }
  assert.equal((await call("PUT", "/api/auth/password", { current_password: first, new_password: first }, token)).status, 400, "same password refused");

  const ok = await call("PUT", "/api/auth/password", { current_password: first, new_password: "Brand-New-Pass-9051" }, token);
  assert.equal(ok.status, 200);
  assert.equal((await call("POST", "/api/auth/login", { email, password: first })).status, 401, "old password no longer works");
  assert.equal((await call("POST", "/api/auth/login", { email, password: "Brand-New-Pass-9051" })).status, 200, "new password works");
});

test("LEADS: waitlist and feedback are validated, de-duplicated, spam-resistant, and visible only to the admin", opts, async () => {
  const stamp = Date.now();
  const email = `lead-${stamp}@example.com`;
  assert.equal((await call("POST", "/api/leads", { kind: "nonsense", email })).status, 400, "unknown kind");
  assert.equal((await call("POST", "/api/leads", { kind: "waitlist", email: "not-an-email" })).status, 400, "bad email");
  assert.equal((await call("POST", "/api/leads", { kind: "feedback", message: "x" })).status, 400, "too short");
  assert.equal((await call("POST", "/api/leads", { kind: "waitlist", email: `bot-${stamp}@example.com`, website: "http://spam.example" })).status, 204, "honeypot is silently dropped");

  assert.equal((await call("POST", "/api/leads", { kind: "waitlist", email, plan: "pro" })).status, 201);
  assert.equal((await call("POST", "/api/leads", { kind: "waitlist", email, plan: "pro" })).status, 200, "same email + plan is stored once");
  const fb = await call("POST", "/api/leads", { kind: "feedback", message: `The reminder button did nothing ${stamp}`, email });
  assert.equal(fb.status, 201);

  assert.equal((await call("GET", "/api/admin/leads", undefined, a.token)).status, 403, "non-admin cannot read leads");

  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  const adminEmail = await prismaModule.runAsSystem(async () => (await prisma.$queryRawUnsafe("SELECT email FROM users WHERE organization_id = $1::uuid LIMIT 1", a.orgId))[0].email);
  const previous = process.env.PLATFORM_ADMIN_EMAILS;
  process.env.PLATFORM_ADMIN_EMAILS = adminEmail;
  try {
    const list = await call("GET", "/api/admin/leads", undefined, a.token);
    assert.equal(list.status, 200);
    const mine = list.json.leads.filter((l: any) => l.email === email);
    assert.equal(mine.filter((l: any) => l.kind === "waitlist").length, 1, "waitlist entry exists exactly once");
    assert.ok(mine.some((l: any) => l.kind === "feedback" && l.message.includes(String(stamp))), "feedback stored");
    assert.ok(!list.json.leads.some((l: any) => String(l.email).startsWith(`bot-${stamp}`)), "honeypot entry was not stored");
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = previous;
    await prismaModule.runAsSystem(async () => { await prisma.$executeRawUnsafe("DELETE FROM leads WHERE email = $1", email); });
  }
});
