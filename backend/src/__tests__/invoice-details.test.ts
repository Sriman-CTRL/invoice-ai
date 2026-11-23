import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, parseDetails } from "../lib/invoiceDetails";

const items = [
  { description: "Design", quantity: 3, rate: 5000, amount: 15000 },
  { description: "Revisions", quantity: 2, rate: 1250.5, amount: 2501 },
];

test("totals: no tax", () => {
  const t = computeTotals(items, 0, 0, "NONE");
  assert.equal(t.subtotal, 17501);
  assert.equal(t.total, 17501);
  assert.equal(t.tax, 0);
});

test("totals: intra-state GST splits into CGST and SGST", () => {
  const t = computeTotals(items, 1000, 18, "GST_INTRA");
  assert.equal(t.taxable, 16501);
  assert.equal(t.tax, 2970.18);
  assert.equal(t.cgst + t.sgst, t.tax);
  assert.equal(t.igst, 0);
  assert.equal(t.total, 19471.18);
});

test("totals: inter-state GST is all IGST", () => {
  const t = computeTotals(items, 0, 18, "GST_INTER");
  assert.equal(t.igst, t.tax);
  assert.equal(t.cgst, 0);
});

test("totals: discount can never exceed the subtotal", () => {
  const t = computeTotals(items, 999999, 18, "GST_INTRA");
  assert.equal(t.discount, 17501);
  assert.equal(t.total, 0);
});

test("parseDetails: server computes amounts, ignoring client amounts", () => {
  const r: any = parseDetails({ items: [{ description: "Logo", quantity: 2, rate: 100, amount: 1 }], tax_mode: "NONE" });
  assert.equal(r.details.items[0].amount, 200);
});

test("parseDetails: rejects bad input", () => {
  assert.ok("error" in (parseDetails({ items: [] }) as any));
  assert.ok("error" in (parseDetails({ items: [{ description: "", quantity: 1, rate: 1 }] }) as any));
  assert.ok("error" in (parseDetails({ items: [{ description: "x", quantity: -1, rate: 1 }] }) as any));
  assert.ok("error" in (parseDetails({ items: [{ description: "x", quantity: 1, rate: 1 }], tax_mode: "GST_INTRA", tax_percent: 99 }) as any));
  assert.equal(parseDetails({ amount: 5 }), null);
});
