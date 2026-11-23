import test from "node:test";
import assert from "node:assert/strict";
import { buildUpiUri } from "../src/upi";

test("UPI link uses NPCI parameter names, INR and a two-decimal amount", () => {
  const url = new URL(buildUpiUri({ upiId: "seller@okbank", payeeName: "Studio One", amount: 45000, invoiceNumber: "INV-0007" }));
  assert.equal(url.protocol, "upi:");
  assert.equal(url.searchParams.get("pa"), "seller@okbank");
  assert.equal(url.searchParams.get("pn"), "Studio One");
  assert.equal(url.searchParams.get("am"), "45000.00");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.equal(url.searchParams.get("tn"), "Invoice INV-0007");
});

test("UPI link strips unsafe characters and caps the payee name at 25 characters", () => {
  const url = new URL(buildUpiUri({ upiId: "a@b", payeeName: "Rao & Sons <script> Design Studio Pvt", amount: 10.5, invoiceNumber: "INV/9 #1" }));
  assert.ok((url.searchParams.get("pn") || "").length <= 25);
  assert.ok(!/[&<>]/.test(url.searchParams.get("pn") || ""));
  assert.equal(url.searchParams.get("am"), "10.50");
  assert.equal(url.searchParams.get("tn"), "Invoice INV91");
});

test("UPI link escapes a hostile UPI ID so it cannot add parameters", () => {
  const url = new URL(buildUpiUri({ upiId: "x@y&am=1", payeeName: "S", amount: 99, invoiceNumber: "1" }));
  assert.equal(url.searchParams.get("am"), "99.00");
  assert.equal(url.searchParams.get("pa"), "x@y&am=1");
});
