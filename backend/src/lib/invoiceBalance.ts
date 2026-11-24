/**
 * What is still owed on an invoice: the invoice amount minus payments that SUCCEEDED minus credit notes issued.
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
