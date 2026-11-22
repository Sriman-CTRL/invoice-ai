import prisma from "./prisma";

/**
 * Per-organisation payment details and plan. Stored as additive nullable columns on
 * `organizations`, created lazily with IF NOT EXISTS so no destructive migration is needed.
 */
export interface OrgSettings {
  upi_id: string | null;
  payee_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  gstin: string | null;
  plan: "FREE" | "PRO" | "AGENCY";
}

export const SETTING_FIELDS = ["upi_id", "payee_name", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_name", "gstin"] as const;
type Field = (typeof SETTING_FIELDS)[number];

let ready: Promise<void> | null = null;
export function ensureOrgSettingsSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const col of SETTING_FIELDS) {
        await prisma.$executeRawUnsafe(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ${col} VARCHAR(255)`);
      }
      await prisma.$executeRawUnsafe(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'FREE'`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS plan_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        plan VARCHAR(20) NOT NULL,
        utr VARCHAR(32) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const EMPTY: OrgSettings = {
  upi_id: null, payee_name: null, bank_account_name: null, bank_account_number: null,
  bank_ifsc: null, bank_name: null, gstin: null, plan: "FREE",
};

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  await ensureOrgSettingsSchema();
  const rows = await prisma.$queryRawUnsafe<OrgSettings[]>(
    `SELECT upi_id, payee_name, bank_account_name, bank_account_number, bank_ifsc, bank_name, gstin, plan FROM organizations WHERE id = $1::uuid`,
    organizationId,
  );
  return rows[0] ?? EMPTY;
}

const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,31}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ACCT_RE = /^[0-9]{6,20}$/;

/** Validates & normalises a settings patch. Returns cleaned values or an error message. */
export function validateSettingsPatch(body: Record<string, unknown>): { data: Partial<Record<Field, string | null>> } | { error: string } {
  const data: Partial<Record<Field, string | null>> = {};
  for (const field of SETTING_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === "") { data[field] = null; continue; }
    if (typeof raw !== "string") return { error: `${field} must be text` };
    let v = raw.trim().slice(0, 255);
    if (field === "upi_id") { v = v.toLowerCase(); if (!UPI_RE.test(v)) return { error: "Enter a valid UPI ID, e.g. yourname@okhdfcbank" }; }
    if (field === "bank_ifsc") { v = v.toUpperCase(); if (!IFSC_RE.test(v)) return { error: "IFSC must look like HDFC0001234" }; }
    if (field === "gstin") { v = v.toUpperCase(); if (!GSTIN_RE.test(v)) return { error: "GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5" }; }
    if (field === "bank_account_number") { v = v.replace(/\s+/g, ""); if (!ACCT_RE.test(v)) return { error: "Account number must be 6-20 digits" }; }
    data[field] = v;
  }
  return { data };
}

export async function updateOrgSettings(organizationId: string, patch: Partial<Record<Field, string | null>>): Promise<OrgSettings> {
  await ensureOrgSettingsSchema();
  const keys = (Object.keys(patch) as Field[]).filter((k) => (SETTING_FIELDS as readonly string[]).includes(k));
  if (keys.length) {
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", "); // column names come from the fixed whitelist
    await prisma.$executeRawUnsafe(
      `UPDATE organizations SET ${sets}, updated_at = now() WHERE id = $1::uuid`,
      organizationId,
      ...keys.map((k) => patch[k] ?? null),
    );
  }
  return getOrgSettings(organizationId);
}

export const FREE_INVOICES_PER_MONTH = 5;

/** Returns an error message if creating `adding` more invoices would exceed the org's plan, else null. */
export async function checkPlanLimit(organizationId: string, adding = 1): Promise<string | null> {
  const { plan } = await getOrgSettings(organizationId);
  if (plan !== "FREE") return null;
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM invoices WHERE organization_id = $1::uuid AND created_at >= date_trunc('month', now())`,
    organizationId,
  );
  const used = rows[0]?.n ?? 0;
  if (used + adding > FREE_INVOICES_PER_MONTH) {
    return `Free plan allows ${FREE_INVOICES_PER_MONTH} invoices per month (${used} used). Upgrade to Pro for unlimited invoices.`;
  }
  return null;
}
