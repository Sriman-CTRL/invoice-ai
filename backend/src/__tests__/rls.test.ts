import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";

/**
 * Database-level proof of tenant isolation. These tests talk to Postgres directly as the restricted
 * `app_user` role (no application code involved), so they show the database itself refuses
 * cross-tenant access. Skipped unless DATABASE_URL_APP is set.
 */
const url = process.env.DATABASE_URL_APP || "";
const enabled = Boolean(url) && (/localhost|127\.0\.0\.1/.test(url) || process.env.INTEGRATION_TESTS === "1");
const opts = { skip: enabled ? false : "set DATABASE_URL_APP (and a local DB or INTEGRATION_TESTS=1) to run RLS tests" };

let db: Client;
let orgA = "";
let orgB = "";
let invoiceB = "";
const tag = `rls${Date.now()}${Math.floor(Math.random() * 1e5)}`;

/** Run `fn` in a transaction with the given tenant context, then roll back or commit. */
async function withContext<T>(ctx: { org?: string; system?: boolean }, fn: () => Promise<T>, commit = false): Promise<T> {
  await db.query("BEGIN");
  try {
    await db.query("SELECT set_config('app.current_org_id', $1, true), set_config('app.system', $2, true)", [ctx.org ?? "", ctx.system ? "on" : "off"]);
    const out = await fn();
    await db.query(commit ? "COMMIT" : "ROLLBACK");
    return out;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

before(async () => {
  if (!enabled) return;
  db = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await db.connect();
  await withContext({ system: true }, async () => {
    orgA = (await db.query("INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id", [`RLS A`, `${tag}-a`])).rows[0].id;
    orgB = (await db.query("INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id", [`RLS B`, `${tag}-b`])).rows[0].id;
    for (const [org, label] of [[orgA, "a"], [orgB, "b"]] as const) {
      const cust = (await db.query("INSERT INTO customers (organization_id, name, email) VALUES ($1, $2, $3) RETURNING id", [org, `Cust ${label}`, `${tag}-${label}@example.com`])).rows[0].id;
      const inv = (await db.query("INSERT INTO invoices (organization_id, customer_id, invoice_number, amount) VALUES ($1, $2, $3, 100) RETURNING id", [org, cust, `INV-${label}`])).rows[0].id;
      if (label === "b") invoiceB = inv;
    }
  }, true);
});

after(async () => {
  if (!enabled || !db) return;
  await withContext({ system: true }, async () => {
    for (const org of [orgA, orgB]) {
      await db.query("DELETE FROM invoices WHERE organization_id = $1", [org]);
      await db.query("DELETE FROM customers WHERE organization_id = $1", [org]);
      await db.query("DELETE FROM organizations WHERE id = $1", [org]);
    }
  }, true);
  await db.end();
});

test("RLS: the app role cannot bypass row-level security", opts, async () => {
  const r = await db.query("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user");
  assert.equal(r.rows[0].rolbypassrls, false);
  assert.equal(r.rows[0].rolsuper, false);
});

test("RLS: with no tenant context, every tenant table returns zero rows (fail closed)", opts, async () => {
  await withContext({}, async () => {
    for (const t of ["invoices", "customers", "payments", "messages", "conversations", "collection_actions", "users", "organizations"]) {
      const n = (await db.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
      assert.equal(n, 0, `${t} must be empty without a tenant context`);
    }
  });
});

test("RLS: a tenant sees only its own rows", opts, async () => {
  await withContext({ org: orgA }, async () => {
    const rows = (await db.query("SELECT organization_id FROM invoices WHERE invoice_number IN ('INV-a','INV-b')")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].organization_id, orgA);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM organizations")).rows[0].n, 1);
  });
});

test("RLS: a tenant cannot update or delete another tenant's rows", opts, async () => {
  await withContext({ org: orgA }, async () => {
    assert.equal((await db.query("UPDATE invoices SET amount = 1 WHERE id = $1", [invoiceB])).rowCount, 0);
    assert.equal((await db.query("DELETE FROM invoices WHERE id = $1", [invoiceB])).rowCount, 0);
  });
});

test("RLS: a tenant cannot insert rows into another tenant", opts, async () => {
  await assert.rejects(
    withContext({ org: orgA }, async () => {
      await db.query("INSERT INTO customers (organization_id, name, email) VALUES ($1, 'Evil', 'evil@example.com')", [orgB]);
    }),
    /row-level security/i,
  );
});

test("RLS: system mode (login, public pages, webhooks) can span tenants", opts, async () => {
  await withContext({ system: true }, async () => {
    const n = (await db.query("SELECT count(*)::int AS n FROM invoices WHERE invoice_number IN ('INV-a','INV-b')")).rows[0].n;
    assert.equal(n, 2);
  });
});

test("RLS: the app role cannot change the schema", opts, async () => {
  await assert.rejects(db.query("CREATE TABLE should_not_exist (id int)"), /permission denied/i);
  await assert.rejects(db.query("ALTER TABLE invoices DISABLE ROW LEVEL SECURITY"), /must be owner|permission denied/i);
});
