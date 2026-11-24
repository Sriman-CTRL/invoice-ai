/**
 * Conservative parser for bank "amount credited" alert emails that a seller forwards to their Paivo inbound address.
 *
 * It only says "this text looks like ONE credit of this amount with this reference". It never decides anything about
 * money: the caller turns a match into a *suggestion* in the Action Queue that the seller settles by hand
 * (AGENTS.md rule 1). Formats differ by bank and change, so anything ambiguous returns null: a missed alert costs
 * nothing, a wrong one would waste the seller's trust. No bank-specific accuracy is claimed.
 */
export interface BankAlert {
  /** Credited amount in rupees (two decimals). */
  amount: number;
  /** UTR / RRN / reference as printed in the alert, upper-cased. */
  reference: string;
}

const AMOUNT = /(?:INR|Rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
const REFERENCE = /(?:UTR|RRN|Ref(?:erence)?(?:\s*(?:No|Number|ID|#))?\.?|IMPS|NEFT|RTGS)\s*[:#-]?\s*([A-Z0-9]{9,22})\b/gi;

export function parseBankAlert(text: string, subject = ""): BankAlert | null {
  const body = `${subject}\n${text}`.replace(/\s+/g, " ").trim();
  if (body.length < 20 || body.length > 5000) return null;

  // It must say credited, must not also say debited, and must not be a future or failed credit.
  if (!/\bcredited\b/i.test(body)) return null;
  if (/\bdebited\b/i.test(body)) return null;
  if (/(?:will be|to be|not|un|yet to be)\s*credited|credit(?:ing)?\s*(?:failed|reversed|pending)/i.test(body)) return null;

  // Exactly one amount, ignoring balance figures ("Avl Bal INR 98,765.43").
  const amounts = new Set<number>();
  for (const m of body.matchAll(AMOUNT)) {
    const before = body.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
    if (/bal(?:ance)?\.?\s*(?:is|:|-)?\s*$/i.test(before)) continue;
    const value = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) amounts.add(Math.round(value * 100) / 100);
  }
  if (amounts.size !== 1) return null;

  // A reference with enough digits to be a real transaction reference.
  const refs = new Set<string>();
  for (const m of body.matchAll(REFERENCE)) {
    const ref = m[1].toUpperCase();
    if ((ref.match(/\d/g) ?? []).length >= 6) refs.add(ref);
  }
  if (refs.size !== 1) return null;

  return { amount: [...amounts][0], reference: [...refs][0] };
}
