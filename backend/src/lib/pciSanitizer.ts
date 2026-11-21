/**
 * PCI-DSS Data Sanitizer (SAQ A Scope Preservation)
 *
 * Scans text for primary account numbers (PAN) / credit card numbers.
 * Validates candidates against the Luhn algorithm (mod 10) so ordinary
 * invoice numbers, phone numbers, and timestamps are NOT falsely redacted.
 *
 * If a valid card number is found, it is redacted to [CARD_REDACTED_XXXX]
 * (preserving only the last 4 digits) before storage in PostgreSQL,
 * exposure in log streams, or transmission to LLM prompts.
 */

/**
 * Standard Luhn Algorithm check.
 * Returns true if digits pass the ISO/IEC 7812 checksum.
 */
export function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Redacts any credit/debit card numbers in the input string.
 * Supports numbers with spaces, dashes, or plain digit strings.
 */
export function redactPaymentCardData(text: string): string {
  if (!text || typeof text !== "string") return text;

  // Match 13 to 19 digits, possibly separated by single spaces or dashes
  const cardRegex = /\b(?:\d[ -]*?){13,19}\b/g;

  return text.replace(cardRegex, (match) => {
    const rawDigits = match.replace(/[\s-]/g, "");

    // Must be between 13 and 19 digits and start with common IIN prefixes (Visa: 4, MC: 5/2, Amex: 3, RuPay/Discover: 6)
    if (!/^[3-6]\d{12,18}$/.test(rawDigits)) {
      return match;
    }

    if (passesLuhn(rawDigits)) {
      const last4 = rawDigits.slice(-4);
      return `[CARD_REDACTED_${last4}]`;
    }

    return match;
  });
}
