/**
 * TDS arithmetic for the free TDS calculator. It does the sum only: the rate is typed in by the person using it, because
 * Paivo could not confirm current TDS rates and thresholds from official Income Tax Department pages (checked 24 Nov 2026:
 * incometax.gov.in did not resolve and incometaxindia.gov.in refused automated access). Do not hard-code a rate here
 * until it is confirmed from an official source and given a "last checked" date.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface TdsInput {
  /** Invoice amount before GST. */
  amount: number;
  /** GST charged on the invoice (0 if none). */
  gst: number;
  /** TDS rate in percent, as given by the client's deduction or the official chart. */
  ratePercent: number;
  /** true: TDS on the amount before GST; false: TDS on amount + GST. Ask a CA which applies to you. */
  excludeGst: boolean;
}

export interface TdsResult {
  invoiceTotal: number;
  tdsBase: number;
  tds: number;
  /** What actually reaches the bank: invoice total minus TDS. */
  netReceived: number;
}

export function computeTds({ amount, gst, ratePercent, excludeGst }: TdsInput): TdsResult {
  const a = Math.max(0, r2(Number.isFinite(amount) ? amount : 0));
  const g = Math.max(0, r2(Number.isFinite(gst) ? gst : 0));
  const rate = Math.min(100, Math.max(0, Number.isFinite(ratePercent) ? ratePercent : 0));
  const invoiceTotal = r2(a + g);
  const tdsBase = excludeGst ? a : invoiceTotal;
  const tds = r2((tdsBase * rate) / 100);
  return { invoiceTotal, tdsBase, tds, netReceived: r2(invoiceTotal - tds) };
}
