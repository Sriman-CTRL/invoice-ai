import { gstinProblem, ifscProblem } from "./gstin";
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
  brand_color: string | null;
  logo_data: string | null;
  plan: "FREE" | "PRO" | "AGENCY";
  /** Automatic overdue reminders (1, 7 and 14 days after the due date). Off by default. */
  auto_reminders: boolean;
}

export const SETTING_FIELDS = ["upi_id", "payee_name", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_name", "gstin", "brand_color", "logo_data"] as const;
type Field = (typeof SETTING_FIELDS)[number];

let ready: Promise<void> | null = null;
export function ensureOrgSettingsSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const col of ["upi_id", "payee_name", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_name", "gstin"]) {
        await prisma.$executeRawUnsafe(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ${col} VARCHAR(255)`);
      }
      await prisma.$executeRawUnsafe(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'FREE'`);
      await prisma.$executeRawUnsafe(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS auto_reminders BOOLEAN NOT NULL DEFAULT false`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS plan_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        plan VARCHAR(20) NOT NULL,
        utr VARCHAR(32) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    })().catch((e) => {
      // The restricted app role cannot run DDL. That's fine when the owner already applied it
      // (scripts/enable-rls.cjs does); only fail loudly if the columns are genuinely missing.
      console.warn("ensureOrgSettingsSchema: skipped DDL:", (e as Error).message);
    });
  }
  return ready;
}

const EMPTY: OrgSettings = {
  upi_id: null, payee_name: null, bank_account_name: null, bank_account_number: null,
  bank_ifsc: null, bank_name: null, gstin: null, brand_color: null, logo_data: null, plan: "FREE", auto_reminders: false,
};

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  await ensureOrgSettingsSchema();
  const base = "upi_id, payee_name, bank_account_name, bank_account_number, bank_ifsc, bank_name, gstin, brand_color, logo_data, plan";
  let rows: OrgSettings[];
  try {
    rows = await prisma.$queryRawUnsafe<OrgSettings[]>(`SELECT ${base}, auto_reminders FROM organizations WHERE id = $1::uuid`, organizationId);
  } catch (e) {
    // Deployed before scripts/enable-rls.cjs added the auto_reminders column: keep the pay page and settings working.
    if (!/auto_reminders|42703/.test(String((e as Error)?.message) + String((e as { code?: string })?.code))) throw e;
    rows = (await prisma.$queryRawUnsafe<Omit<OrgSettings, "auto_reminders">[]>(`SELECT ${base} FROM organizations WHERE id = $1::uuid`, organizationId)).map((r) => ({ ...r, auto_reminders: false }));
  }
  return rows[0] ?? EMPTY;
}

const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,31}$/;
const ACCT_RE = /^[0-9]{6,20}$/;

/** A logo must be a small PNG/JPEG/WebP data URL whose bytes really are that format. */
function logoProblem(raw: unknown): string | null {
  if (typeof raw !== "string") return "Logo must be an image.";
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(raw);
  if (!m) return "Logo must be a PNG, JPEG or WebP image.";
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > 150 * 1024) return "Logo is too large. Please use an image under 150 KB.";
  const png = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const ok = m[1] === "image/png" ? png : m[1] === "image/jpeg" ? jpg : webp;
  return ok ? null : "That file doesn't look like a valid image.";
}

/** Validates & normalises a settings patch. Returns cleaned values or an error message. */
export type SettingsPatch = Partial<Record<Field, string | null>> & { auto_reminders?: boolean };

export function validateSettingsPatch(body: Record<string, unknown>, existing: Partial<Record<Field, string | null>> = {}): { data: SettingsPatch } | { error: string } {
  const data: SettingsPatch = {};
  if ("auto_reminders" in body) {
    if (typeof body.auto_reminders !== "boolean") return { error: "auto_reminders must be true or false" };
    data.auto_reminders = body.auto_reminders;
  }
  for (const field of SETTING_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === "") { data[field] = null; continue; }
    if (typeof raw !== "string") return { error: `${field} must be text` };
    if (field === "logo_data") { const bad = logoProblem(raw); if (bad) return { error: bad }; data[field] = raw; continue; }
    let v = raw.trim().slice(0, 255);
    if (field === "brand_color") { v = v.toLowerCase(); if (!/^#[0-9a-f]{6}$/.test(v)) return { error: "Pick a valid colour." }; }
    if (field === "upi_id") { v = v.toLowerCase(); if (!UPI_RE.test(v)) return { error: "Enter a valid UPI ID, e.g. yourname@okhdfcbank" }; }
    if (field === "bank_ifsc") { v = v.toUpperCase(); const bad = ifscProblem(v); if (bad) return { error: bad }; }
    if (field === "gstin") {
      v = v.toUpperCase();
      // A GSTIN already saved before the check-digit test existed stays accepted when it is saved again unchanged.
      const unchanged = existing.gstin != null && existing.gstin.toUpperCase() === v;
      const bad = unchanged ? (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ? null : gstinProblem(v)) : gstinProblem(v);
      if (bad) return { error: bad };
    }
    if (field === "bank_account_number") { v = v.replace(/\s+/g, ""); if (!ACCT_RE.test(v)) return { error: "Account number must be 6-20 digits" }; }
    data[field] = v;
  }
  return { data };
}

export async function updateOrgSettings(organizationId: string, patch: SettingsPatch): Promise<OrgSettings> {
  await ensureOrgSettingsSchema();
  const keys = (Object.keys(patch) as Array<Field | "auto_reminders">).filter((k) => k === "auto_reminders" || (SETTING_FIELDS as readonly string[]).includes(k));
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
