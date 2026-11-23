import test from "node:test";
import assert from "node:assert/strict";
import { gstinProblem, ifscProblem } from "../src/gstin";

test("frontend GSTIN check matches the server's", () => {
  assert.equal(gstinProblem("27AAPFU0939F1ZV"), null);
  assert.equal(gstinProblem("29ABCDE1234F1ZW"), null);
  assert.ok(gstinProblem("27AAPFU0939F1ZX"));
  assert.ok(gstinProblem("123"));
});

test("frontend IFSC check", () => {
  assert.equal(ifscProblem("HDFC0001234"), null);
  assert.ok(ifscProblem("HDFC1001234"));
});
