import { test } from "node:test";
import assert from "node:assert/strict";
import { addPeriod } from "../lib/recurring";

test("monthly clamps to the last day of shorter months", () => {
  assert.equal(addPeriod("2026-01-31", "MONTHLY"), "2026-02-28");
  assert.equal(addPeriod("2028-01-31", "MONTHLY"), "2028-02-29");
  assert.equal(addPeriod("2026-11-15", "MONTHLY"), "2026-12-15");
});
test("month arithmetic rolls over the year", () => {
  assert.equal(addPeriod("2026-12-10", "MONTHLY"), "2027-01-10");
  assert.equal(addPeriod("2026-11-30", "QUARTERLY"), "2027-02-28");
});
test("weekly adds seven days across month and year ends", () => {
  assert.equal(addPeriod("2026-12-28", "WEEKLY"), "2027-01-04");
});
test("yearly handles leap days", () => {
  assert.equal(addPeriod("2028-02-29", "YEARLY"), "2029-02-28");
});
