/**
 * What is still owed on an invoice: the invoice amount minus what SUCCEEDED payments settled (cash received PLUS tax the
 * client deducted at source, TDS) minus credit notes issued.
 * Credit notes reduce the amount owed, so a client is never asked to pay more than they really owe. Used by the pay
 * page, the UPI QR/link, the PDF, the client portal and the money routes so they all agree.
 */

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function outstandingOf(amount: number, paid: number, credited: number): number {
  return Math.max(0, round2(Number(amount) - Number(paid) - Number(credited)));
}

/**
 * True when the invoice is PAID because credit notes covered what payments did not (so the screen must say
 * "Settled by credit note", not "Paid").
 */
export function settledByCredit(status: string, amount: number, paid: number, credited: number): boolean {
  return status === "PAID" && Number(credited) > 0 && round2(Number(paid)) + 0.005 < Number(amount);
}

// Accepts the Prisma client or a transaction client (their generated types differ, so keep this loose).
type CreditReader = { credit_notes: any };

/** Sum of credit notes issued against one invoice (works with the client or a transaction client). */
export async function creditedTotal(db: CreditReader, organizationId: string, invoiceId: string): Promise<number> {
  const r = await db.credit_notes.aggregate({ where: { invoice_id: invoiceId, organization_id: organizationId }, _sum: { amount: true } });
  return Number(r._sum.amount ?? 0);
}

type PaymentReader = { payments: any };

export interface SettledTotals {
  /** Money actually received. */
  cash: number;
  /** Tax the client deducted at source and deposits with the government (a claim for the seller, not cash). */
  tds: number;
  /** cash + tds: what counts toward settling the invoice. */
  settled: number;
}

/** Sum of SUCCEEDED payments on one invoice, split into cash and TDS (works with the client or a transaction client). */
export async function settledTotals(db: PaymentReader, organizationId: string, invoiceId: string): Promise<SettledTotals> {
  const r = await db.payments.aggregate({
    where: { invoice_id: invoiceId, organization_id: organizationId, status: "SUCCEEDED" },
    _sum: { amount: true, tds_amount: true },
  });
  const cash = round2(Number(r._sum?.amount ?? 0));
  const tds = round2(Number(r._sum?.tds_amount ?? 0));
  return { cash, tds, settled: round2(cash + tds) };
}
