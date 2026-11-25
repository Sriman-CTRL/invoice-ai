/**
 * TDS lines for the invoice PDF. They come ONLY from payments that were actually recorded with TDS on that invoice
 * (amount and section exactly as recorded). No rate or section is ever assumed; with no recorded TDS there are no lines
 * and the PDF prints nothing about TDS.
 */
export interface TdsPayment { status: string; tds_amount?: number | string | null; tds_section?: string | null }
export interface TdsLine { section: string | null; amount: number }

export function recordedTdsLines(payments: TdsPayment[] | null | undefined): TdsLine[] {
  const bySection = new Map<string, TdsLine>();
  for (const p of payments ?? []) {
    if (p.status !== "SUCCEEDED") continue;
    const amount = Number(p.tds_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const section = p.tds_section ? String(p.tds_section) : null;
    const key = section ?? "";
    const cur = bySection.get(key);
    if (cur) cur.amount = Math.round((cur.amount + amount) * 100) / 100;
    else bySection.set(key, { section, amount: Math.round(amount * 100) / 100 });
  }
  return [...bySection.values()];
}
