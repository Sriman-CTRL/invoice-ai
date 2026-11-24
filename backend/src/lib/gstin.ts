/**
 * GSTIN and IFSC validation (pure, no dependencies). The GSTIN check digit is the public base-36 weighted
 * modulus-36 scheme: weight 1 on even positions and 2 on odd positions, sum the quotient and remainder of each product
 * by 36, and the 15th character is (36 - sum mod 36) mod 36 in the alphabet 0-9A-Z.
 */
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_SHAPE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

/** Returns a user-facing problem, or null when the GSTIN is valid. Expects the value already trimmed and upper-cased. */
export function gstinProblem(gstin: string): string | null {
  if (gstin.length !== 15) return "GSTIN must be 15 characters, e.g. 29ABCDE1234F1ZW";
  if (!GSTIN_SHAPE.test(gstin)) return "GSTIN format is not right. It looks like 2 digits, 5 letters, 4 digits, a letter, then 3 more characters.";
  const state = Number(gstin.slice(0, 2));
  if (!((state >= 1 && state <= 38) || state === 97 || state === 99)) return "The first two digits of a GSTIN are the state code (01 to 38).";
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return "This GSTIN doesn't pass the check-digit test. Please re-check it for a typo.";
  return null;
}

export function ifscProblem(ifsc: string): string | null {
  return IFSC_SHAPE.test(ifsc) ? null : "IFSC must be 11 characters like HDFC0001234 (4 letters, a zero, then 6 letters or digits).";
}
