/**
 * Idempotent database setup for tenant isolation (row-level security).
 *
 *   DATABASE_URL=<owner connection string> APP_DB_PASSWORD=<new role password> node scripts/enable-rls.cjs
 *
 * Creates/updates:
 *   - role `app_user` (LOGIN, NOBYPASSRLS) with DML rights only (no DDL, not an owner)
 *   - fail-closed policies on every tenant table: a row is visible only when its organization_id
 *     equals app.current_org_id, or when the request explicitly runs in system mode (app.system = on)
 * Safe to re-run. The owner role (which bypasses RLS) keeps working, so applying this does not
 * change behaviour until the app is pointed at DATABASE_URL_APP.
 */
require("dotenv").config();
const { Client } = require("pg");

const TENANT_TABLES = ["invoice_details", "invoice_views", "recurring_invoices", "payment_proof_images", "collection_actions", "conversations", "credit_notes", "customers", "invoices", "messages", "payments", "suppressions", "users"];

(async () => {
  const url = process.env.DATABASE_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (!url) throw new Error("DATABASE_URL (owner) is required");
  if (password && (password.length < 24 || !/^[A-Za-z0-9_-]+$/.test(password))) throw new Error("APP_DB_PASSWORD must be 24+ URL-safe chars (letters, digits, _ and -)");

  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await c.connect();
  const run = (sql) => c.query(sql);

  // Additive schema extras the app relies on (the restricted role cannot run DDL itself).
  for (const col of ["upi_id", "payee_name", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_name", "gstin"]) {
    await run(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ${col} VARCHAR(255)`);
  }
  await run(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'FREE'`);
  await run(`CREATE TABLE IF NOT EXISTS plan_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, plan VARCHAR(20) NOT NULL, utr VARCHAR(32) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await run(`CREATE TABLE IF NOT EXISTS auth_failures (id BIGSERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, ip VARCHAR(64) NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await run(`CREATE INDEX IF NOT EXISTS auth_failures_email_at ON auth_failures (email, at)`);
  await run(`CREATE INDEX IF NOT EXISTS auth_failures_ip_at ON auth_failures (ip, at)`);
  await run(`CREATE TABLE IF NOT EXISTS analytics_events (id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(), event VARCHAR(40) NOT NULL, path VARCHAR(200) NOT NULL, referrer VARCHAR(100), visitor VARCHAR(40))`);
  await run(`CREATE INDEX IF NOT EXISTS analytics_events_at ON analytics_events (at)`);
  await run(`CREATE TABLE IF NOT EXISTS leads (id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(), kind VARCHAR(20) NOT NULL, email VARCHAR(255), plan VARCHAR(20), message VARCHAR(1000))`);
  await run(`CREATE TABLE IF NOT EXISTS payment_proof_images (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, payment_id UUID NOT NULL, mime VARCHAR(20) NOT NULL, data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await run(`CREATE INDEX IF NOT EXISTS payment_proof_images_payment ON payment_proof_images (payment_id)`);

  // Branding on the organisation (logo is a small compressed data URL, validated by the API).
  await run(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_color VARCHAR(9)`);
  await run(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_data TEXT`);
  // Automatic overdue reminders are off until the seller switches them on in Settings.
  await run(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_reminders BOOLEAN NOT NULL DEFAULT false`);
  // Line items, discount, GST and notes live beside the invoice so the core table is untouched.
  await run(`CREATE TABLE IF NOT EXISTS invoice_details (
    invoice_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_mode VARCHAR(10) NOT NULL DEFAULT 'NONE',
    notes VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  // When a client opened an invoice's payment page.
  await run(`CREATE TABLE IF NOT EXISTS invoice_views (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL,
    invoice_id UUID NOT NULL,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await run(`CREATE INDEX IF NOT EXISTS invoice_views_org_at ON invoice_views (organization_id, viewed_at DESC)`);
  await run(`CREATE INDEX IF NOT EXISTS invoice_views_invoice ON invoice_views (invoice_id, viewed_at DESC)`);
  // Repeating invoices (retainers). The template is a JSON snapshot; each run creates a DRAFT to review.
  await run(`CREATE TABLE IF NOT EXISTS recurring_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    template JSONB NOT NULL,
    frequency VARCHAR(12) NOT NULL,
    next_run DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_invoice_id UUID,
    runs INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await run(`CREATE INDEX IF NOT EXISTS recurring_invoices_due ON recurring_invoices (active, next_run)`);
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email))`);

  await run(`CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid LANGUAGE plpgsql STABLE AS $$
    BEGIN RETURN NULLIF(current_setting('app.current_org_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN RETURN NULL; END; $$`);
  await run(`CREATE OR REPLACE FUNCTION app_is_system() RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT COALESCE(current_setting('app.system', true), 'off') = 'on' $$`);

  const exists = (await run(`SELECT 1 FROM pg_roles WHERE rolname = 'app_user'`)).rowCount > 0;
  if (!exists && !password) throw new Error("APP_DB_PASSWORD is required the first time (role does not exist yet)");
  // Role attributes are set once at creation (managed Postgres won't let the owner re-alter them).
  // An existing role is only touched when a new password is supplied (rotation).
  if (!exists) {
    await run(`CREATE ROLE app_user LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
  } else if (password) {
    await run(`ALTER ROLE app_user PASSWORD '${password}'`);
  }

  // Shared rate-limit counters (middleware/rateLimit.ts). Not a tenant table: no organization_id, no RLS.
  await run(`CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INT NOT NULL, reset_at TIMESTAMPTZ NOT NULL)`);

  await run(`GRANT USAGE ON SCHEMA public TO app_user`);
  await run(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`);
  await run(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user`);
  await run(`GRANT EXECUTE ON FUNCTION app_current_org_id(), app_is_system() TO app_user`);
  await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user`);
  await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user`);

  for (const t of TENANT_TABLES) {
    await run(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await run(`DROP POLICY IF EXISTS tenant_isolation_${t} ON ${t}`);
    await run(`CREATE POLICY tenant_isolation_${t} ON ${t}
      USING (organization_id = app_current_org_id() OR app_is_system())
      WITH CHECK (organization_id = app_current_org_id() OR app_is_system())`);
  }
  await run(`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY`);
  await run(`DROP POLICY IF EXISTS tenant_isolation_organizations ON organizations`);
  await run(`CREATE POLICY tenant_isolation_organizations ON organizations
    USING (id = app_current_org_id() OR app_is_system())
    WITH CHECK (id = app_current_org_id() OR app_is_system())`);

  const check = await c.query(`SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_user'`);
  console.log("app_user:", JSON.stringify(check.rows[0]));
  console.log("RLS enabled on:", [...TENANT_TABLES, "organizations"].join(", "));
  await c.end();
})().catch((e) => {
  console.error("enable-rls failed:", e.message);
  process.exit(1);
});
