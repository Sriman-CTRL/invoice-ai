import prisma from "./prisma";

// Line items, discount, GST and notes for an invoice. The server computes every total,
// so a client can never send an amount that disagrees with the items.

export type TaxMode = "NONE" | "GST_INTRA" | "GST_INTER";
export interface LineItem { description: string; quantity: number; rate: number; amount: number }
export interface InvoiceDetails {
  items: LineItem[];
  discount: number;
  tax_percent: number;
  tax_mode: TaxMode;
  notes: string | null;
}
export interface Totals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const GST_RATES = [0, 5, 12, 18, 28];

export function computeTotals(items: LineItem[], discount: number, taxPercent: number, mode: TaxMode): Totals {
  const subtotal = r2(items.reduce((s, i) => s + i.amount, 0));
  const disc = Math.min(Math.max(r2(discount), 0), subtotal);
  const taxable = r2(subtotal - disc);
  const tax = mode === "NONE" ? 0 : r2((taxable * taxPercent) / 100);
  const half = r2(tax / 2);
  return {
    subtotal,
    discount: disc,
    taxable,
    tax,
    cgst: mode === "GST_INTRA" ? half : 0,
    sgst: mode === "GST_INTRA" ? r2(tax - half) : 0,
    igst: mode === "GST_INTER" ? tax : 0,
    total: r2(taxable + tax),
  };
}

/** Validate untrusted input. Returns details, or an error message fit to show the user. */
export function parseDetails(body: any): { details: InvoiceDetails } | { error: string } | null {
  if (!Array.isArray(body?.items)) return null;
  if (body.items.length === 0 || body.items.length > 50) return { error: "Add between 1 and 50 line items." };
  const items: LineItem[] = [];
  for (const raw of body.items) {
    const description = String(raw?.description ?? "").trim().slice(0, 300);
    const quantity = Number(raw?.quantity);
    const rate = Number(raw?.rate);
    if (!description) return { error: "Every line item needs a description." };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return { error: "Quantity must be a positive number." };
    if (!Number.isFinite(rate) || rate < 0 || rate > 1_000_000_000) return { error: "Rate must be zero or more." };
    items.push({ description, quantity: r2(quantity), rate: r2(rate), amount: r2(quantity * rate) });
  }
  const mode: TaxMode = ["NONE", "GST_INTRA", "GST_INTER"].includes(body.tax_mode) ? body.tax_mode : "NONE";
  const taxPercent = mode === "NONE" ? 0 : Number(body.tax_percent);
  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 28) return { error: "GST rate must be between 0 and 28." };
  const discount = Number(body.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0) return { error: "Discount can't be negative." };
  const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;
  return { details: { items, discount: r2(discount), tax_percent: taxPercent, tax_mode: mode, notes: notes || null } };
}

export async function saveDetails(organizationId: string, invoiceId: string, d: InvoiceDetails): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO invoice_details (invoice_id, organization_id, items, discount, tax_percent, tax_mode, notes)
     VALUES ($1::uuid, $2::uuid, $3::jsonb, $4, $5, $6, $7)
     ON CONFLICT (invoice_id) DO UPDATE SET items = EXCLUDED.items, discount = EXCLUDED.discount,
       tax_percent = EXCLUDED.tax_percent, tax_mode = EXCLUDED.tax_mode, notes = EXCLUDED.notes`,
    invoiceId, organizationId, JSON.stringify(d.items), d.discount, d.tax_percent, d.tax_mode, d.notes,
  );
}

export async function getDetails(invoiceId: string): Promise<(InvoiceDetails & { totals: Totals }) | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT items, discount::float8 AS discount, tax_percent::float8 AS tax_percent, tax_mode, notes FROM invoice_details WHERE invoice_id = $1::uuid`,
    invoiceId,
  );
  const row = rows[0];
  if (!row) return null;
  const items: LineItem[] = Array.isArray(row.items) ? row.items : [];
  return {
    items,
    discount: row.discount,
    tax_percent: row.tax_percent,
    tax_mode: row.tax_mode,
    notes: row.notes,
    totals: computeTotals(items, row.discount, row.tax_percent, row.tax_mode),
  };
}
