import test from "node:test";
import assert from "node:assert/strict";
import { hinglishEnabled, payExplainer } from "../src/payCopy";

test("Hinglish flag is off unless exactly 'true'", () => {
  assert.equal(hinglishEnabled(undefined), false);
  assert.equal(hinglishEnabled(""), false);
  assert.equal(hinglishEnabled("1"), false);
  assert.equal(hinglishEnabled("true"), true);
});

test("English explainer matches the original pay page wording", () => {
  const e = payExplainer("en", "Sample Studio", true);
  assert.equal(e.title, "You're paying Sample Studio");
  assert.match(e.direct, /never holds the money/);
  assert.match(e.next, /files unlock on this page/);
});

test("both languages name the seller, mention UTR, and mention unlock only with files", () => {
  for (const lang of ["en", "hinglish"] as const) {
    const withFiles = payExplainer(lang, "Sample Studio", true);
    const without = payExplainer(lang, "Sample Studio", false);
    assert.ok(withFiles.title.includes("Sample Studio"));
    assert.ok(withFiles.next.includes("UTR"));
    assert.ok(withFiles.next.includes("Sample Studio"));
    assert.ok(/unlock/.test(withFiles.next));
    assert.ok(!/unlock/.test(without.next));
  }
});
