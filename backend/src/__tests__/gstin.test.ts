import test from "node:test";
import assert from "node:assert/strict";
import { gstinCheckChar, gstinProblem, ifscProblem } from "../lib/gstin";
import { validateSettingsPatch } from "../lib/orgSettings";

test("GSTIN: valid numbers pass (check digit verified)", () => {
  for (const g of ["27AAPFU0939F1ZV", "29ABCDE1234F1ZW", "07AAGFF2194N1Z1"]) {
    assert.equal(gstinProblem(g), null, g);
  }
  assert.equal(gstinCheckChar("27AAPFU0939F1Z"), "V");
});

test("GSTIN: wrong check digit, length, shape and state code are rejected with a clear message", () => {
  assert.match(gstinProblem("27AAPFU0939F1ZX") ?? "", /check-digit/);
  assert.match(gstinProblem("27AAPFU0939F1Z") ?? "", /15 characters/);
  assert.match(gstinProblem("27AAPFU0939F1ZVV") ?? "", /15 characters/);
  assert.match(gstinProblem("2AAAPFU0939F1ZV1") ?? "", /15 characters/);
  assert.match(gstinProblem("ABAAPFU0939F1ZV") ?? "", /format/);
  assert.match(gstinProblem("27AAPFU0939F1AV") ?? "", /format/, "14th character must be Z");
  assert.match(gstinProblem("00AAPFU0939F1ZV") ?? "", /state code/);
  assert.match(gstinProblem("50AAPFU0939F1ZV") ?? "", /state code/);
});

test("IFSC: format only (4 letters, zero, 6 letters or digits)", () => {
  assert.equal(ifscProblem("HDFC0001234"), null);
  assert.equal(ifscProblem("SBIN0ABC123"), null);
  for (const bad of ["HDFC1001234", "HDF00001234", "HDFC000123", "hdfc0001234", "HDFC0001234X", ""]) {
    assert.ok(ifscProblem(bad), `${bad} rejected`);
  }
});

test("settings: GSTIN and IFSC are normalised and checked on save", () => {
  assert.deepEqual(validateSettingsPatch({ gstin: " 27aapfu0939f1zv ", bank_ifsc: "hdfc0001234" }), { data: { gstin: "27AAPFU0939F1ZV", bank_ifsc: "HDFC0001234" } });
  assert.ok("error" in validateSettingsPatch({ gstin: "27AAPFU0939F1ZX" }));
  assert.ok("error" in validateSettingsPatch({ bank_ifsc: "HDFC1001234" }));
  assert.deepEqual(validateSettingsPatch({ gstin: "", bank_ifsc: null }), { data: { gstin: null, bank_ifsc: null } }, "clearing still works");
});

test("settings: a format-valid GSTIN saved before the check-digit test stays accepted when unchanged", () => {
  const legacy = "29ABCDE1234F1Z5"; // right shape, wrong check digit
  assert.ok("error" in validateSettingsPatch({ gstin: legacy }), "a new save of it is refused");
  assert.deepEqual(validateSettingsPatch({ gstin: legacy }, { gstin: legacy }), { data: { gstin: legacy } });
  assert.ok("error" in validateSettingsPatch({ gstin: "29ABCDE1234F1Z6" }, { gstin: legacy }), "changing it to another bad value is refused");
});
