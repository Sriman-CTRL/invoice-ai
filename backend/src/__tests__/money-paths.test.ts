import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { computeTotals } from "../lib/invoiceDetails";
import { parseScreenshot } from "../lib/extraSchema";

/**
 * Money-path tests. Integration parts run against a real LOCAL database as the restricted role
 * (same switch as tenant-isolation.test.ts); the pure functions always run.
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };

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
  const email = `money-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Money-Path-Tenant-5827";
  assert.equal((await call("POST", "/api/auth/register", { email, password, organization_name: `Money ${label}`, accepted_terms: true })).status, 201);
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

async function makeInvoice(t: Tenant, amount: number, extra: Record<string, unknown> = {}) {
  seq += 1;
  const res = await call(
    "POST",
    "/api/invoices",
    { customer_id: t.customerId, invoice_number: `MP-${Date.now()}-${seq}`, amount, issued_at: "2026-11-01", due_at: "2026-12-01", status: "OPEN", ...extra },
    t.token,
  );
  assert.equal(res.status, 201, `invoice create: ${JSON.stringify(res.json)}`);
  return res.json.id as string;
}

const pay = (t: Tenant, invoiceId: string, amount: number, status?: string) =>
  call("POST", "/api/payments", { invoice_id: invoiceId, amount, ...(status ? { status } : {}) }, t.token);
const invoiceStatus = async (t: Tenant, id: string) => (await call("GET", `/api/invoices/${id}`, undefined, t.token)).json.invoice?.status as string;
const publicPage = (id: string) => call("GET", `/api/public/invoices/${id}`);
const submitProof = (id: string, body: Record<string, unknown>) => call("POST", `/api/public/invoices/${id}/submit-proof`, body);

// 1x1 PNG
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

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

// ---------- payments ----------

test("PAYMENT: only a SUCCEEDED payment moves the invoice status", opts, async () => {
  const id = await makeInvoice(a, 1000);
  assert.equal((await pay(a, id, 1000, "PENDING")).status, 201);
  assert.equal(await invoiceStatus(a, id), "OPEN", "PENDING does not change status");
  assert.equal((await pay(a, id, 1000, "FAILED")).status, 201);
  assert.equal(await invoiceStatus(a, id), "OPEN", "FAILED does not change status");
  assert.equal((await pay(a, id, 1000, "BOGUS")).status, 400, "unknown status rejected");
  assert.equal((await pay(a, id, 1000)).status, 201);
  assert.equal(await invoiceStatus(a, id), "PAID");
});

test("PAYMENT: partial then full settlement, and overpayment is rejected", opts, async () => {
  const id = await makeInvoice(a, 1000);
  assert.equal((await pay(a, id, 1000.01)).status, 409, "more than the invoice amount");
  assert.equal((await pay(a, id, 0)).status, 400);
  assert.equal((await pay(a, id, -5)).status, 400);
  assert.equal((await pay(a, id, 400)).status, 201);
  assert.equal(await invoiceStatus(a, id), "PARTIALLY_PAID");
  assert.equal((await pay(a, id, 600.01)).status, 409, "more than the remaining balance");
  assert.equal((await pay(a, id, 600)).status, 201);
  assert.equal(await invoiceStatus(a, id), "PAID");
  assert.equal((await pay(a, id, 1)).status, 409, "already paid");
});

test("PAYMENT: two concurrent payments that together exceed the balance cannot both succeed", opts, async () => {
  const id = await makeInvoice(a, 1000);
  const results = await Promise.all([pay(a, id, 700), pay(a, id, 700)]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(await invoiceStatus(a, id), "PARTIALLY_PAID");
  const list = await call("GET", `/api/payments?invoice_id=${id}`, undefined, a.token);
  assert.equal(list.json.filter((p: any) => p.status === "SUCCEEDED").length, 1);
});

test("PAYMENT: another business's invoice is never touched", opts, async () => {
  const id = await makeInvoice(a, 1000);
  const spoof = await call("POST", "/api/payments", { organization_id: a.orgId, invoice_id: id, amount: 1000 }, b.token);
  assert.equal(spoof.status, 403, "naming another org in the body is refused");
  assert.equal((await pay(b, id, 1000)).status, 404, "org B cannot pay org A's invoice");
  assert.equal(await invoiceStatus(a, id), "OPEN");
});

// ---------- public pay page ----------

test("PUBLIC PAGE: bad ids and DRAFT invoices are 404; the deliverable stays hidden until fully paid", opts, async () => {
  assert.equal((await publicPage("INV-0001")).status, 404, "invoice numbers are not links");
  assert.equal((await publicPage("not-a-uuid")).status, 404);
  assert.equal((await publicPage("00000000-0000-4000-8000-000000000000")).status, 404);

  const draft = await makeInvoice(a, 500, { status: "DRAFT" });
  assert.equal((await publicPage(draft)).status, 404, "draft invoices are not public");

  const id = await makeInvoice(a, 1000, { external_invoice_id: "vault:https://example.com/final-files" });
  let page = await publicPage(id);
  assert.equal(page.status, 200);
  assert.equal(page.json.deliverable_url, null);
  assert.equal(page.json.deliverable_locked, true);
  assert.ok(!JSON.stringify(page.json).includes("example.com/final-files"), "url not leaked anywhere in the response");

  await pay(a, id, 400);
  page = await publicPage(id);
  assert.equal(page.json.deliverable_url, null, "still hidden after a partial payment");

  await pay(a, id, 600);
  page = await publicPage(id);
  assert.equal(page.json.deliverable_url, "https://example.com/final-files");
});

test("PUBLIC PAGE: only http(s) deliverable links are accepted", opts, async () => {
  for (const bad of ["vault:javascript:alert(1)", "vault:ftp://example.com/x", "vault:data:text/html,hi", "vault:file:///etc/passwd"]) {
    const res = await call("POST", "/api/invoices", { customer_id: a.customerId, invoice_number: `BAD-${Date.now()}-${++seq}`, amount: 10, issued_at: "2026-11-01", due_at: "2026-12-01", external_invoice_id: bad }, a.token);
    assert.equal(res.status, 400, `${bad} refused`);
  }
});

test("PUBLIC PAGE: submit-proof validates input and never changes invoice status by itself", opts, async () => {
  const id = await makeInvoice(a, 1000, { external_invoice_id: "vault:https://example.com/final-files" });
  assert.equal((await submitProof(id, { utr: "abc" })).status, 400, "UTR too short");
  assert.equal((await submitProof(id, { utr: "BAD UTR!!" })).status, 400, "UTR characters");
  assert.equal((await submitProof(id, { utr: "UTR1234567890", amount: 5000 })).status, 400, "more than outstanding");
  assert.equal((await submitProof(id, { utr: "UTR1234567890", screenshot: "data:text/html;base64,PGI+" })).status, 400, "not an image");
  assert.equal((await submitProof(id, { utr: "UTR1234567890", screenshot: "data:image/png;base64," + Buffer.from("not really a png").toString("base64") })).status, 400, "wrong magic bytes");
  assert.equal((await submitProof("00000000-0000-4000-8000-000000000000", { utr: "UTR1234567890" })).status, 404);

  const ok = await submitProof(id, { utr: "UTR1234567890", amount: 1000, screenshot: PNG_DATA_URL });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(await invoiceStatus(a, id), "OPEN", "a proof alone does not settle anything");
  const page = await publicPage(id);
  assert.equal(page.json.deliverable_url, null, "files stay locked until the seller confirms");
  assert.equal(page.json.pending_verification, true);
  assert.equal((await submitProof(id, { utr: "utr1234567890" })).status, 409, "duplicate UTR");
});

// ---------- settlement from the Action Queue ----------

test("VERIFY-PROOF: settles only for the owning business, and a second click does not pay twice", opts, async () => {
  const id = await makeInvoice(a, 1000, { external_invoice_id: "vault:https://example.com/final-files" });
  const proof = await submitProof(id, { utr: "SETTLE00000001", amount: 1000 });
  assert.equal(proof.status, 200);
  const actionId = proof.json.action_id as string;

  const other = await call("POST", `/api/collection-actions/${actionId}/verify-proof`, {}, b.token);
  assert.equal(other.status, 404, "org B cannot settle org A's proof");
  assert.equal(await invoiceStatus(a, id), "OPEN");

  const first = await call("POST", `/api/collection-actions/${actionId}/verify-proof`, {}, a.token);
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(await invoiceStatus(a, id), "PAID");
  assert.equal((await publicPage(id)).json.deliverable_url, "https://example.com/final-files");

  const second = await call("POST", `/api/collection-actions/${actionId}/verify-proof`, {}, a.token);
  assert.equal(second.status, 200, "repeating the confirmation is harmless");
  const payments = await call("GET", `/api/payments?invoice_id=${id}`, undefined, a.token);
  const succeeded = payments.json.filter((p: any) => p.status === "SUCCEEDED");
  assert.equal(succeeded.length, 1, "exactly one settled payment");
  assert.equal(Number(succeeded[0].amount), 1000);
  assert.equal(await invoiceStatus(a, id), "PAID");
});

test("VERIFY-PROOF: a partial proof keeps the invoice partly paid and the files locked", opts, async () => {
  const id = await makeInvoice(a, 1000, { external_invoice_id: "vault:https://example.com/final-files" });
  const proof = await submitProof(id, { utr: "PARTIAL0000001", amount: 400 });
  assert.equal(proof.status, 200);
  assert.equal((await call("POST", `/api/collection-actions/${proof.json.action_id}/verify-proof`, {}, a.token)).status, 200);
  assert.equal(await invoiceStatus(a, id), "PARTIALLY_PAID");
  assert.equal((await publicPage(id)).json.deliverable_url, null);
});

// ---------- credit notes ----------

test("CREDIT NOTE: cannot exceed the open balance, and another business's invoice is rejected", opts, async () => {
  const id = await makeInvoice(a, 1000);
  await pay(a, id, 400);
  const tooMuch = await call("POST", "/api/credit-notes", { invoice_id: id, amount: 700, reason: "Scope reduced" }, a.token);
  assert.equal(tooMuch.status, 409, "paid 400 leaves 600, so 700 is too much");
  assert.equal((await call("POST", "/api/credit-notes", { invoice_id: id, amount: 100, reason: "" }, a.token)).status, 400, "reason required");
  assert.equal((await call("POST", "/api/credit-notes", { invoice_id: id, amount: 100, reason: "Goodwill" }, b.token)).status, 404, "org B cannot credit org A's invoice");
  const ok = await call("POST", "/api/credit-notes", { invoice_id: id, amount: 100, reason: "Goodwill" }, a.token);
  assert.equal(ok.status, 201);
  assert.equal(ok.json.remainingBalance, 500);
});

test("CREDIT NOTE: two concurrent credit notes cannot together exceed the balance", opts, async () => {
  const id = await makeInvoice(a, 1000);
  const results = await Promise.all([
    call("POST", "/api/credit-notes", { invoice_id: id, amount: 600, reason: "First" }, a.token),
    call("POST", "/api/credit-notes", { invoice_id: id, amount: 600, reason: "Second" }, a.token),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});

// ---------- credit notes and what the client owes ----------

const credit = (t: Tenant, invoiceId: string, amount: number) =>
  call("POST", "/api/credit-notes", { invoice_id: invoiceId, amount, reason: "Scope reduced" }, t.token);

test("CREDIT NOTE (partial): the pay page, the client portal and the invoice detail ask for what is really owed", opts, async () => {
  const id = await makeInvoice(a, 1000, { external_invoice_id: "vault:https://example.com/final-files" });
  assert.equal((await pay(a, id, 300)).status, 201);
  assert.equal((await credit(a, id, 200)).status, 201);

  const page = (await publicPage(id)).json;
  assert.equal(page.amount, 1000);
  assert.equal(page.paid_amount, 300);
  assert.equal(page.credited_amount, 200);
  assert.equal(page.outstanding_amount, 500, "1000 - 300 paid - 200 credit");
  assert.equal(page.settled_by_credit, false);
  assert.equal(page.deliverable_url, null, "still locked");

  const detail = (await call("GET", `/api/invoices/${id}`, undefined, a.token)).json;
  assert.equal(detail.financial_summary.outstanding_amount, 500);
  assert.equal(detail.financial_summary.credited_amount, 200);

  // The client cannot report paying more than they owe, and paying the remainder settles the invoice.
  assert.equal((await submitProof(id, { utr: "CREDITPART0001", amount: 501 })).status, 400, "more than the credited balance");
  const proof = await submitProof(id, { utr: "CREDITPART0002", amount: 500 });
  assert.equal(proof.status, 200, JSON.stringify(proof.json));
  assert.equal((await call("POST", `/api/collection-actions/${proof.json.action_id}/verify-proof`, {}, a.token)).status, 200);
  assert.equal(await invoiceStatus(a, id), "PAID", "payment + credit cover the invoice");
  const after = (await publicPage(id)).json;
  assert.equal(after.outstanding_amount, 0);
  assert.equal(after.settled_by_credit, true, "payments (800) plus the credit note (200) covered it, so it is not plain 'paid'");
  assert.equal(after.deliverable_url, "https://example.com/final-files");
});

test("CREDIT NOTE (partial): a recorded payment cannot exceed the balance after the credit", opts, async () => {
  const id = await makeInvoice(a, 1000);
  assert.equal((await credit(a, id, 400)).status, 201);
  assert.equal((await pay(a, id, 600.01)).status, 409, "only 600 is owed now");
  assert.equal((await pay(a, id, 600)).status, 201);
  assert.equal(await invoiceStatus(a, id), "PAID");
});

test("CREDIT NOTE (full): the invoice becomes PAID but is shown as settled by credit note, and the client owes nothing", opts, async () => {
  const id = await makeInvoice(a, 800, { external_invoice_id: "vault:https://example.com/final-files" });
  assert.equal((await credit(a, id, 800)).status, 201);
  assert.equal(await invoiceStatus(a, id), "PAID", "unchanged rule: a credit that zeroes the balance marks it PAID");
  const page = (await publicPage(id)).json;
  assert.equal(page.outstanding_amount, 0);
  assert.equal(page.settled_by_credit, true);
  assert.equal(page.paid_amount, 0, "no money was received");
  assert.equal((await call("GET", `/api/invoices/${id}`, undefined, a.token)).json.financial_summary.settled_by_credit, true);
  assert.equal((await submitProof(id, { utr: "CREDITFULL0001" })).status, 409, "nothing left to pay");
});

test("CREDIT NOTE: the client portal lists the reduced balance", opts, async () => {
  const id = await makeInvoice(a, 900);
  assert.equal((await credit(a, id, 150)).status, 201);
  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  const rows = await prismaModule.runAsSystem(async () => await prisma.$queryRawUnsafe(`SELECT customer_id FROM invoices WHERE id = $1::uuid`, id));
  const customerId = rows[0].customer_id as string;
  const { portalToken } = (await import("../routes/client-portal.routes.js")) as any;
  const portal = await call("GET", `/api/public/client/${customerId}/${portalToken(customerId)}`);
  assert.equal(portal.status, 200, JSON.stringify(portal.json));
  const row = portal.json.invoices.find((i: any) => i.id === id);
  assert.equal(row.outstanding, 750);
});

// ---------- pure functions ----------

test("computeTotals: no GST", () => {
  const t = computeTotals([{ description: "Logo", quantity: 1, rate: 1000, amount: 1000 }], 0, 18, "NONE");
  assert.deepEqual(t, { subtotal: 1000, discount: 0, taxable: 1000, tax: 0, cgst: 0, sgst: 0, igst: 0, total: 1000 });
});

test("computeTotals: intra-state GST splits into CGST and SGST", () => {
  const t = computeTotals([{ description: "Site", quantity: 1, rate: 10000, amount: 10000 }], 1000, 18, "GST_INTRA");
  assert.equal(t.taxable, 9000);
  assert.equal(t.tax, 1620);
  assert.equal(t.cgst, 810);
  assert.equal(t.sgst, 810);
  assert.equal(t.igst, 0);
  assert.equal(t.total, 10620);
});

test("computeTotals: inter-state GST is all IGST", () => {
  const t = computeTotals([{ description: "Site", quantity: 1, rate: 10000, amount: 10000 }], 0, 12, "GST_INTER");
  assert.equal(t.igst, 1200);
  assert.equal(t.cgst + t.sgst, 0);
  assert.equal(t.total, 11200);
});

test("computeTotals: discount is clamped to the subtotal and never negative", () => {
  const items = [{ description: "A", quantity: 1, rate: 500, amount: 500 }];
  assert.equal(computeTotals(items, 9999, 18, "GST_INTRA").total, 0);
  assert.equal(computeTotals(items, 9999, 18, "GST_INTRA").discount, 500);
  assert.equal(computeTotals(items, -50, 0, "NONE").total, 500);
});

test("computeTotals: rounds to paise and CGST + SGST always add up to the tax", () => {
  const t = computeTotals([{ description: "A", quantity: 3, rate: 3.35, amount: 10.05 }], 0, 18, "GST_INTRA");
  assert.equal(t.tax, 1.81);
  assert.equal(Math.round((t.cgst + t.sgst) * 100), Math.round(t.tax * 100));
  assert.equal(t.total, 11.86);
});

// ---------- screenshot parsing ----------

test("parseScreenshot: accepts real PNG/JPEG/WebP, rejects everything else", () => {
  assert.equal(parseScreenshot(undefined), null);
  assert.equal(parseScreenshot(""), null);
  assert.deepEqual(parseScreenshot(PNG_DATA_URL) && Object.keys(parseScreenshot(PNG_DATA_URL) as object), ["mime", "base64"]);
  const jpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]).toString("base64");
  assert.ok(!("error" in (parseScreenshot(jpeg) as object)));
  const webp = "data:image/webp;base64," + Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]).toString("base64");
  assert.ok(!("error" in (parseScreenshot(webp) as object)));
  assert.ok("error" in (parseScreenshot(42) as object), "non-string");
  assert.ok("error" in (parseScreenshot("data:image/gif;base64,R0lGODlh") as object), "gif not allowed");
  assert.ok("error" in (parseScreenshot("data:image/png;base64," + Buffer.from("hello world, not an image").toString("base64")) as object), "magic bytes checked");
  assert.ok("error" in (parseScreenshot("data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(401 * 1024)]).toString("base64")) as object), "over 400 KB");
});
