import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { gstinCheckChar } from "../lib/gstin";

/**
 * Invoice snapshots: an issued invoice keeps the seller, client and line items it was issued with; a draft follows live
 * data until it is approved. Integration tests need a LOCAL database (same switch as money-paths.test.ts).
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
let prisma: any;
let runAsSystem: any;

const gstin = (prefix14: string) => prefix14 + gstinCheckChar(prefix14);
const GSTIN_OLD = gstin("27AAPFU0939F1Z");
const GSTIN_NEW = gstin("29AABCT1332L1Z");

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

async function makeTenant(label: string): Promise<Tenant> {
  const email = `snap-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "Snapshot-Tenant-5827";
  assert.equal((await call("POST", "/api/auth/register", { email, password, organization_name: `Snap ${label} Pvt`, accepted_terms: true })).status, 201);
  const login = await call("POST", "/api/auth/login", { email, password });
  assert.equal(login.status, 200);
  created.orgIds.push(login.json.user.organization_id);
  await runAsSystem(async () => await prisma.$executeRawUnsafe(`UPDATE organizations SET plan = 'PRO' WHERE id = $1::uuid`, login.json.user.organization_id));
  const customer = await call("POST", "/api/customers", { name: `Client ${label}`, email: `client-${label}-${Date.now()}@example.com`, company_name: `Client ${label} LLP` }, login.json.token);
  assert.equal(customer.status, 201);
  return { token: login.json.token, orgId: login.json.user.organization_id, customerId: customer.json.id };
}

const putSettings = (t: Tenant, body: Record<string, unknown>) => call("PUT", "/api/organizations/settings", body, t.token);

async function makeInvoice(t: Tenant, status: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  const res = await call(
    "POST",
    "/api/invoices",
    {
      customer_id: t.customerId, invoice_number: `SNAP-${Date.now()}-${seq}`, issued_at: "2026-11-01", due_at: "2026-12-01", status,
      items: [{ description: "Logo design", quantity: 1, rate: 1000 }], tax_mode: "GST_INTRA", tax_percent: 18, ...extra,
    },
    t.token,
  );
  assert.equal(res.status, 201, `invoice create: ${JSON.stringify(res.json)}`);
  return res.json.id as string;
}
const publicPage = (id: string) => call("GET", `/api/public/invoices/${id}`);
const detail = async (t: Tenant, id: string) => (await call("GET", `/api/invoices/${id}`, undefined, t.token)).json;
const gstRows = async (t: Tenant) => (await call("GET", "/api/dashboard/gst-report?from=2026-11-01&to=2026-11-30", undefined, t.token)).json.rows as any[];

before(async () => {
  if (!enabled) return;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const prismaModule: any = await import("../lib/prisma.js");
  prisma = prismaModule.default?.default ?? prismaModule.default;
  runAsSystem = prismaModule.runAsSystem;
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
  await runAsSystem(async () => {
    for (const org of created.orgIds) {
      for (const table of ["invoice_snapshots", "payments", "collection_actions", "messages", "conversations", "invoice_details", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

test("SNAPSHOT: changing GSTIN, UPI ID, payee and business name after issuing leaves the issued invoice unchanged", opts, async () => {
  assert.equal((await putSettings(a, { gstin: GSTIN_OLD, upi_id: "old-seller@okhdfc", payee_name: "Old Payee", brand_color: "#112233" })).status, 200);
  const id = await makeInvoice(a, "OPEN");
  const before = (await publicPage(id)).json;
  assert.equal(before.payment.upi_id, "old-seller@okhdfc");
  assert.equal(before.organization.gstin, GSTIN_OLD);

  assert.equal((await putSettings(a, { gstin: GSTIN_NEW, upi_id: "new-seller@okicici", payee_name: "New Payee", brand_color: "#445566" })).status, 200);
  assert.equal((await call("PATCH", "/api/organizations/me", { organization_id: a.orgId, name: "Renamed Business" }, a.token)).status, 200);

  const after = (await publicPage(id)).json;
  assert.equal(after.payment.upi_id, "old-seller@okhdfc", "the pay page follows the snapshot, not the new UPI ID");
  assert.equal(after.payment.payee_name, "Old Payee");
  assert.equal(after.organization.gstin, GSTIN_OLD);
  assert.equal(after.organization.brand_color, "#112233");
  assert.equal(after.organization.name, "Snap a Pvt");
  const d = await detail(a, id);
  assert.equal(d.snapshot.seller.gstin, GSTIN_OLD, "the PDF reads the snapshot from the detail response");
  assert.equal(d.snapshot.seller.name, "Snap a Pvt");
  assert.equal(d.payment_details_changed, true, "the seller is told the payment details changed");

  // An invoice issued after the change gets the new details.
  const id2 = await makeInvoice(a, "OPEN");
  const fresh = (await publicPage(id2)).json;
  assert.equal(fresh.payment.upi_id, "new-seller@okicici");
  assert.equal(fresh.organization.gstin, GSTIN_NEW);
  assert.equal(fresh.organization.name, "Renamed Business");
});

test("SNAPSHOT: a draft follows live data until it is approved, then it is frozen", opts, async () => {
  assert.equal((await putSettings(a, { upi_id: "draft-one@okhdfc" })).status, 200);
  const id = await makeInvoice(a, "DRAFT");
  let d = await detail(a, id);
  assert.equal(d.snapshot, null, "a draft has no snapshot");
  assert.equal(d.payment_details_changed, false);
  assert.equal((await putSettings(a, { upi_id: "draft-two@okhdfc" })).status, 200);
  assert.equal((await detail(a, id)).snapshot, null, "still live after another change");

  assert.equal((await call("POST", `/api/invoices/${id}/approve`, {}, a.token)).status, 200);
  d = await detail(a, id);
  assert.equal(d.snapshot.seller.upi_id, "draft-two@okhdfc", "approval freezes what was current at that moment");
  assert.equal((await putSettings(a, { upi_id: "draft-three@okhdfc" })).status, 200);
  assert.equal((await publicPage(id)).json.payment.upi_id, "draft-two@okhdfc");
});

test("SNAPSHOT: client details and line items stay as issued on the pay page and in the GST report", opts, async () => {
  const id = await makeInvoice(a, "OPEN");
  const before = (await publicPage(id)).json;
  assert.equal(before.customer.name, "Client a");
  const row0 = (await gstRows(a)).find((r) => r.invoice_number && r.total === before.amount && r.customer === "Client a LLP");
  assert.ok(row0, "report row exists");

  // The client is renamed and the live line items are edited behind the app's back.
  await runAsSystem(async () => {
    await prisma.$executeRawUnsafe(`UPDATE customers SET name = 'Renamed Person', company_name = 'Renamed Co' WHERE id = $1::uuid`, a.customerId);
    await prisma.$executeRawUnsafe(`UPDATE invoice_details SET items = '[{"description":"Changed","quantity":1,"rate":1,"amount":1}]'::jsonb, tax_mode = 'NONE' WHERE invoice_id = $1::uuid`, id);
  });
  const after = (await publicPage(id)).json;
  assert.equal(after.customer.name, "Client a");
  assert.equal(after.customer.company_name, "Client a LLP");
  assert.equal(after.details.items[0].description, "Logo design");
  assert.equal(after.details.tax_mode, "GST_INTRA");
  const d = await detail(a, id);
  assert.equal(d.snapshot.client.name, "Client a");
  assert.equal(d.details.items[0].description, "Logo design");
  const rows = await gstRows(a);
  const mine = rows.find((r) => r.total === before.amount && r.customer === "Client a LLP" && r.cgst > 0);
  assert.ok(mine, "GST report keeps the client name and GST split from issue time");
  assert.ok(!rows.some((r) => r.customer === "Renamed Co" && r.total === before.amount), "the new name is not applied to issued invoices");
  // Restore for the later tests.
  await runAsSystem(async () => { await prisma.$executeRawUnsafe(`UPDATE customers SET name = 'Client a', company_name = 'Client a LLP' WHERE id = $1::uuid`, a.customerId); });
});

test("SNAPSHOT: 'update payment details on this invoice' is explicit, scoped and refused for closed or draft invoices", opts, async () => {
  assert.equal((await putSettings(a, { upi_id: "before-refresh@okhdfc" })).status, 200);
  const id = await makeInvoice(a, "OPEN");
  const paid = await makeInvoice(a, "OPEN");
  const draft = await makeInvoice(a, "DRAFT");
  assert.equal((await putSettings(a, { upi_id: "after-refresh@okhdfc" })).status, 200);
  assert.equal((await publicPage(id)).json.payment.upi_id, "before-refresh@okhdfc");

  assert.equal((await call("POST", `/api/invoices/${id}/update-payment-details`, {}, b.token)).status, 404, "another business cannot touch it");
  assert.equal((await publicPage(id)).json.payment.upi_id, "before-refresh@okhdfc");
  assert.equal((await call("POST", `/api/invoices/${id}/update-payment-details`, {}, a.token)).status, 200);
  assert.equal((await publicPage(id)).json.payment.upi_id, "after-refresh@okhdfc");
  assert.equal((await detail(a, id)).payment_details_changed, false);

  assert.equal((await call("POST", `/api/invoices/${draft}/update-payment-details`, {}, a.token)).status, 409);
  const amount = (await publicPage(paid)).json.amount;
  assert.equal((await call("POST", "/api/payments", { invoice_id: paid, amount }, a.token)).status, 201);
  assert.equal((await call("POST", `/api/invoices/${paid}/update-payment-details`, {}, a.token)).status, 409, "a paid invoice keeps its details");
});

test("SNAPSHOT: the enable-rls.cjs backfill snapshots issued invoices that have none, and is idempotent", opts, async () => {
  const id = await makeInvoice(a, "OPEN");
  const draft = await makeInvoice(a, "DRAFT");
  await runAsSystem(async () => { await prisma.$executeRawUnsafe(`DELETE FROM invoice_snapshots WHERE invoice_id = $1::uuid`, id); });
  const src = readFileSync(join(__dirname, "..", "..", "scripts", "enable-rls.cjs"), "utf8");
  const m = /await run\(`(INSERT INTO invoice_snapshots[\s\S]*?ON CONFLICT \(invoice_id\) DO NOTHING)`\)/.exec(src);
  assert.ok(m, "backfill statement found in enable-rls.cjs");
  const count = async (inv: string) => Number((await runAsSystem(async () => await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM invoice_snapshots WHERE invoice_id = $1::uuid`, inv)))[0].n);
  await runAsSystem(async () => { await prisma.$executeRawUnsafe(m![1]); });
  assert.equal(await count(id), 1, "issued invoice backfilled");
  assert.equal(await count(draft), 0, "drafts are not snapshotted");
  const snapBefore = JSON.stringify((await detail(a, id)).snapshot);
  await putSettings(a, { upi_id: "post-backfill@okhdfc" });
  await runAsSystem(async () => { await prisma.$executeRawUnsafe(m![1]); });
  assert.equal(JSON.stringify((await detail(a, id)).snapshot), snapBefore, "running it again changes nothing");
});

test("SNAPSHOT: an issued invoice with no snapshot (older data) is frozen on first read", opts, async () => {
  const id = await makeInvoice(a, "OPEN");
  await runAsSystem(async () => { await prisma.$executeRawUnsafe(`DELETE FROM invoice_snapshots WHERE invoice_id = $1::uuid`, id); });
  assert.equal((await publicPage(id)).status, 200);
  assert.ok((await detail(a, id)).snapshot, "snapshot created on read");
});
