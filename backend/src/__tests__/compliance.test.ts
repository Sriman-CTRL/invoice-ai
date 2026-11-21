import { test } from "node:test";
import assert from "node:assert/strict";
import { passesLuhn, redactPaymentCardData } from "../lib/pciSanitizer";
import { checkIsOptOut } from "../services/complianceService";

test("COMPLIANCE [PCI-DSS SAQ A]: passesLuhn accurately validates card checksums", () => {
  // Known valid test card numbers (standard 16-digit test vectors)
  assert.equal(passesLuhn("4111111111111111"), true, "Valid Visa test PAN");
  assert.equal(passesLuhn("4242424242424242"), true, "Valid Stripe test PAN");

  // Invalid card numbers (tampered digit)
  assert.equal(passesLuhn("4111111111111112"), false, "Invalid Luhn check");

  // Too short / invalid
  assert.equal(passesLuhn("12345"), false);
});

test("COMPLIANCE [PCI-DSS SAQ A]: redactPaymentCardData redacts PAN without breaking invoice numbers", () => {
  // Case 1: Inbound debtor email containing a credit card number
  const emailWithCard =
    "Hi, please charge my card 4111 1111 1111 1111 for invoice INV-1042. Thanks!";
  const sanitized = redactPaymentCardData(emailWithCard);

  assert.match(sanitized, /\[CARD_REDACTED_1111\]/);
  assert.equal(sanitized.includes("4111 1111 1111 1111"), false);
  assert.match(sanitized, /INV-1042/, "Invoice number must remain intact");

  // Case 2: Ordinary phone numbers or order numbers must NOT be redacted
  const normalText = "My phone number is 9876543210 and invoice is 9988776655.";
  const untouched = redactPaymentCardData(normalText);
  assert.equal(untouched, normalText, "Non-card numbers should not be redacted");
});

test("COMPLIANCE [CAN-SPAM / Reg F]: checkIsOptOut identifies opt-out and cease-contact phrases", () => {
  assert.equal(checkIsOptOut("Please unsubscribe me from these emails"), true);
  assert.equal(checkIsOptOut("Stop emailing me immediately"), true);
  assert.equal(checkIsOptOut("Do not contact me anymore"), true);
  assert.equal(checkIsOptOut("Cease and desist all communications"), true);
  assert.equal(checkIsOptOut("Remove me from your list"), true);

  // Normal business responses must NOT trigger opt-out
  assert.equal(checkIsOptOut("I will pay tomorrow morning"), false);
  assert.equal(checkIsOptOut("Can you send me the revised invoice PDF?"), false);
  assert.equal(checkIsOptOut("There is a mistake in line item 2"), false);
});
