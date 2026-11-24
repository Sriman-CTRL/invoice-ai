import test from "node:test";
import assert from "node:assert/strict";
import { LANG_KEY, PAY_TEXT, loadLang, saveLang } from "../src/payI18n";

const en = PAY_TEXT.en as Record<string, unknown>;
const hi = PAY_TEXT.hi as Record<string, unknown>;

test("every key exists in both languages with the same kind of value", () => {
  assert.deepEqual(Object.keys(hi).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.equal(typeof hi[key], typeof en[key], key);
    if (typeof en[key] === "string") assert.ok((hi[key] as string).trim().length > 0 && (en[key] as string).trim().length > 0, key);
  }
});

test("Hindi really is Hindi (Devanagari) for the long instructions", () => {
  const long = ["filesBodyLocked", "filesBodyPaid", "explainDirect", "bankIntro", "utrHint", "footerNote", "bigAmountBank", "bigAmountParts", "enterUtr"];
  for (const k of long) assert.match(hi[k] as string, /[ऀ-ॿ]/, k);
  const same = Object.keys(en).filter((k) => typeof en[k] === "string" && en[k] === hi[k]);
  assert.ok(same.length <= 3, "almost nothing is left in English: " + same.join(","));
});

test("templates keep amounts, currency and names exactly as given in both languages", () => {
  for (const lang of ["en", "hi"] as const) {
    const T = PAY_TEXT[lang];
    assert.ok(T.amountLabel("INR", "12,500.00").includes("INR") && T.amountLabel("INR", "12,500.00").includes("12,500.00"), lang);
    assert.ok(T.creditApplied("INR", "200.00").includes("200.00"), lang);
    assert.ok(T.amountPaid("INR").includes("INR"), lang);
    assert.ok(T.thankYou("Sample Studio").includes("Sample Studio"), lang);
    assert.ok(T.moneyStraight("Sample Studio").includes("Sample Studio"), lang);
    assert.ok(T.explainTitle("Sample Studio").includes("Sample Studio"), lang);
    assert.ok(T.explainNext("Sample Studio", true).includes("Sample Studio"), lang);
    assert.notEqual(T.explainNext("S", true), T.explainNext("S", false), "files sentence only when there are files");
    assert.ok(T.notSetUp(T.whatUpi).length > 0, lang);
  }
});

test("the English wording makes no unverified limit claim", () => {
  assert.ok(!/1 lakh|₹1/.test(PAY_TEXT.en.bigAmountBank + PAY_TEXT.en.bigAmountParts));
  assert.ok(!/1 लाख/.test(PAY_TEXT.hi.bigAmountBank + PAY_TEXT.hi.bigAmountParts));
});

test("language choice: defaults to English, remembers a choice, survives blocked storage", () => {
  const g = globalThis as any;
  const original = g.localStorage;
  try {
    delete g.localStorage;
    assert.equal(loadLang(), "en", "no storage at all");
    saveLang("hi"); // must not throw
    const store = new Map<string, string>();
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    assert.equal(loadLang(), "en", "default");
    saveLang("hi");
    assert.equal(store.get(LANG_KEY), "hi");
    assert.equal(loadLang(), "hi");
    store.set(LANG_KEY, "fr");
    assert.equal(loadLang(), "en", "unknown value ignored");
    g.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(loadLang(), "en");
    saveLang("hi"); // must not throw
  } finally {
    if (original === undefined) delete g.localStorage; else g.localStorage = original;
  }
});
