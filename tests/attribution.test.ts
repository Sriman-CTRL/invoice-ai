import test from "node:test";
import assert from "node:assert/strict";
import { captureAttribution, cleanTag, loadAttribution, parseAttribution } from "../src/attribution";

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

test("parseAttribution reads the four tags and ignores everything else", () => {
  assert.deepEqual(parseAttribution("?utm_source=LinkedIn&utm_medium=dm&utm_campaign=first10&ref=Asha&foo=bar"), {
    utm_source: "linkedin", utm_medium: "dm", utm_campaign: "first10", ref: "asha",
  });
  assert.equal(parseAttribution("?foo=bar"), null);
  assert.equal(parseAttribution(""), null);
});

test("cleanTag strips unsafe characters and caps length", () => {
  assert.equal(cleanTag("<b>Hi there</b>"), "bhithereb");
  assert.equal(cleanTag("a".repeat(100))?.length, 40);
  assert.equal(cleanTag("   "), undefined);
  assert.equal(cleanTag(42), undefined);
});

test("first touch wins: a later visit does not overwrite stored attribution", () => {
  const s = memoryStorage();
  assert.deepEqual(captureAttribution("?utm_source=reddit", s), { utm_source: "reddit" });
  assert.deepEqual(captureAttribution("?utm_source=x&utm_medium=dm", s), { utm_source: "reddit" });
  assert.deepEqual(loadAttribution(s), { utm_source: "reddit" });
});

test("storage failures and corrupt values never throw", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(captureAttribution("?utm_source=x", broken), { utm_source: "x" }); // parsed even if it cannot be stored
  assert.equal(loadAttribution(memoryStorage({ paivo_attr: "{not json" })), null);
  assert.equal(captureAttribution("?utm_source=x", null), null);
});
