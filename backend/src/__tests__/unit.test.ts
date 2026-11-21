import { test } from "node:test";
import assert from "node:assert/strict";
import { validateClassificationResult, SUPPORTED_INTENTS } from "../services/ai/types";
import { MockIntentClassifier } from "../services/ai/intentClassifier";

test("validateClassificationResult accepts a well-formed result", () => {
  const result = validateClassificationResult({
    intent: "PAYMENT_PROMISED",
    confidence: 0.91,
    promised_date: "2026-10-01",
    promised_amount: null,
    reason: "Customer will pay",
  });
  assert.equal(result.intent, "PAYMENT_PROMISED");
  assert.equal(result.confidence, 0.91);
  assert.equal(result.promised_date, "2026-10-01");
});

test("validateClassificationResult rejects unknown intent", () => {
  assert.throws(
    () =>
      validateClassificationResult({
        intent: "NOT_A_REAL_INTENT",
        confidence: 0.9,
        promised_date: null,
        promised_amount: null,
        reason: null,
      }),
    /Invalid intent/,
  );
});

test("validateClassificationResult rejects out-of-range confidence", () => {
  assert.throws(
    () =>
      validateClassificationResult({
        intent: "OTHER",
        confidence: 1.5,
        promised_date: null,
        promised_amount: null,
        reason: null,
      }),
    /Invalid confidence/,
  );
});

test("validateClassificationResult rejects non-object input", () => {
  assert.throws(() => validateClassificationResult(null), /not an object/);
  assert.throws(() => validateClassificationResult([]), /not an object/);
});

test("supported intents are the canonical nine", () => {
  assert.deepEqual(SUPPORTED_INTENTS, [
    "PAYMENT_CONFIRMED",
    "PAYMENT_PROMISED",
    "PAYMENT_NOT_RECEIVED",
    "INVOICE_ISSUE",
    "DISPUTE",
    "REQUEST_EXTENSION",
    "PAYMENT_PLAN_REQUEST",
    "WRONG_INVOICE",
    "OTHER",
  ]);
});

test("MockIntentClassifier routes the core intents deterministically", async () => {
  const classifier = new MockIntentClassifier();

  const confirmed = await classifier.classifyMessage({ message: "I have already paid Rs 10000 for this invoice.", context: [] });
  assert.equal(confirmed.intent, "PAYMENT_CONFIRMED");

  const promised = await classifier.classifyMessage({ message: "I will make the payment tomorrow.", context: [] });
  assert.equal(promised.intent, "PAYMENT_PROMISED");

  const dispute = await classifier.classifyMessage({ message: "I don't agree with this invoice, the amount is incorrect.", context: [] });
  assert.equal(dispute.intent, "DISPUTE");

  const plan = await classifier.classifyMessage({ message: "Can I pay this in installments?", context: [] });
  assert.equal(plan.intent, "PAYMENT_PLAN_REQUEST");

  const other = await classifier.classifyMessage({ message: "Thanks, have a nice day.", context: [] });
  assert.equal(other.intent, "OTHER");
});
