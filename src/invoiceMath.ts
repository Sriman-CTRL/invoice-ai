// Mirrors backend/src/lib/invoiceDetails.ts so the form previews exactly what the server will compute.
// The server stays the source of truth; this is only for live feedback while typing.

export type TaxMode = "NONE" | "GST_INTRA" | "GST_INTER";
export interface DraftItem { description: string; quantity: string; rate: string }
export interface Totals { subtotal: number; discount: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number; total: number }

export const GST_RATES = [5, 12, 18, 28];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

export const lineAmount = (i: DraftItem) => r2(num(i.quantity) * num(i.rate));

export function totalsFor(items: DraftItem[], discount: string, taxPercent: number, mode: TaxMode): Totals {
  const subtotal = r2(items.reduce((s, i) => s + lineAmount(i), 0));
  const disc = Math.min(Math.max(r2(num(discount)), 0), subtotal);
  const taxable = r2(subtotal - disc);
  const tax = mode === "NONE" ? 0 : r2((taxable * taxPercent) / 100);
  const half = r2(tax / 2);
  return {
    subtotal, discount: disc, taxable, tax,
    cgst: mode === "GST_INTRA" ? half : 0,
    sgst: mode === "GST_INTRA" ? r2(tax - half) : 0,
    igst: mode === "GST_INTER" ? tax : 0,
    total: r2(taxable + tax),
  };
}

export const emptyItem = (): DraftItem => ({ description: "", quantity: "1", rate: "" });

/** Payment-term presets: days from the issue date. */
export const TERMS: { label: string; days: number }[] = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 7", days: 7 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 60", days: 60 },
];

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
