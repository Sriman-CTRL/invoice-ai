import test from "node:test";
import assert from "node:assert/strict";
import { cleanTag, encodeAttribution } from "../lib/attribution";

test("encodeAttribution lowercases, strips unsafe characters and joins four fields", () => {
  assert.equal(encodeAttribution({ utm_source: "LinkedIn", utm_medium: "DM", utm_campaign: "first 10", ref: "Asha" }), "linkedin|dm|first10|asha");
  assert.equal(encodeAttribution({ utm_source: "x" }), "x|||");
});

test("encodeAttribution returns null for empty, hostile or non-object input", () => {
  assert.equal(encodeAttribution(null), null);
  assert.equal(encodeAttribution("utm_source=x"), null);
  assert.equal(encodeAttribution({ utm_source: "<>" }), null);
  assert.equal(encodeAttribution({ foo: "bar" }), null);
});

test("cleanTag caps at 40 characters and ignores non-strings", () => {
  assert.equal(cleanTag("a".repeat(80)).length, 40);
  assert.equal(cleanTag(123), "");
});
