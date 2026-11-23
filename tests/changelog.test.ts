import test from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG } from "../src/changelog";

test("changelog is newest first, dated, and every entry has items", () => {
  assert.ok(CHANGELOG.length > 0);
  for (const e of CHANGELOG) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.title.length > 0 && e.items.length > 0);
    assert.ok(e.date >= "2026-11-21", "starts from 21 Nov 2026");
  }
  const dates = CHANGELOG.map((e) => e.date);
  assert.deepEqual([...dates].sort().reverse(), dates);
});

test("changelog makes no claims about unbuilt features", () => {
  const text = JSON.stringify(CHANGELOG).toLowerCase();
  for (const word of ["automatic reminder", "ai reads", "google sign", "trusted by", "guarantee"]) assert.ok(!text.includes(word), word);
});
