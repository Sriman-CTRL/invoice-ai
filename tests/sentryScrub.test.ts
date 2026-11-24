import test from "node:test";
import assert from "node:assert/strict";
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "../src/lib/sentryScrub";

// All samples below are made up. None belongs to a real person, account or token.
// Built at runtime so no token-shaped literal sits in the source. Made-up payload, signature is the text "thisisafakesignature".
const b64 = (s: string | object) => Buffer.from(typeof s === "string" ? s : JSON.stringify(s)).toString("base64url");
const JWT = [b64({ alg: "HS256", typ: "JWT" }), b64({ id: "123", organization_id: "456" }), b64("thisisafakesignature")].join(".");

const SAMPLES: Array<[string, string, string]> = [
  ["email", "Could not email priya.nair+billing@studiofake.co.in about the invoice", "priya.nair"],
  ["UPI id", "Pay to rohan.verma@okhdfcbank now", "rohan.verma"],
  ["UPI id (short handle)", "UPI 9876543210@ybl rejected", "9876543210"],
  ["UTR", "Proof submitted with UTR 412398765432 for INV-12", "412398765432"],
  ["IFSC", "Bank HDFC0001234 branch lookup failed", "HDFC0001234"],
  ["account number", "Account 50100234567890 did not match", "50100234567890"],
  ["GSTIN", "Invalid GSTIN 27AAPFU0939F1ZV for seller", "27AAPFU0939F1ZV"],
  ["JWT", `Request failed with token ${JWT}`, "eyJhbGci"],
  ["Bearer token", "Authorization: Bearer abc123DEF456ghi789JKL012mno345", "abc123DEF456"],
];

for (const [name, input, secret] of SAMPLES) {
  test(`scrubText removes a ${name}`, () => {
    const out = scrubText(input);
    assert.ok(!out.includes(secret), `leaked: ${out}`);
    assert.ok(out.includes("["), `no placeholder: ${out}`);
  });
}

test("labels say what was removed", () => {
  assert.equal(scrubText("a@b.com"), "[email]");
  assert.equal(scrubText("x.y@okaxis"), "[upi]");
  assert.equal(scrubText("utr 412398765432 ok"), "utr [utr] ok");
  assert.equal(scrubText("acct 50100234567890"), "acct [account]");
});

test("ordinary text, short numbers and package versions survive", () => {
  const s = "TypeError: Cannot read properties of undefined (reading 'map') at react@19.3.1 line 42, 3 items, ₹4500";
  assert.equal(scrubText(s), s);
});

test("scrubUrl replaces pay ids, client ids and tokens, and removes query strings and fragments", () => {
  assert.equal(scrubUrl("https://paivo.in/pay/3f2b8c1e-aaaa-4bbb-8ccc-0123456789ab"), "https://paivo.in/pay/[id]");
  assert.equal(scrubUrl("https://paivo.in/client/7b1d2e3f-0000-4000-8000-abcdefabcdef/tok_Zk3j9Q8vXyz"), "https://paivo.in/client/[id]/[token]");
  assert.equal(scrubUrl("https://paivo.in/login?email=a%40b.com&next=/pay/xyz#top"), "https://paivo.in/login?[query]");
  assert.equal(scrubUrl("/api/public/invoices/3f2b8c1e-aaaa-4bbb-8ccc-0123456789ab"), "/api/public/invoices/[id]");
  assert.equal(scrubUrl("/api/invoices/3f2b8c1e-aaaa-4bbb-8ccc-0123456789ab/send"), "/api/invoices/[id]/send");
  assert.equal(scrubUrl("https://paivo.in/pricing"), "https://paivo.in/pricing");
});

test("URLs inside free text are cleaned too", () => {
  const out = scrubText("Failed to fetch https://paivo.in/api/public/client/aaaa1111/secrettoken99?utm=1 (500)");
  assert.ok(!out.includes("secrettoken99") && !out.includes("utm=1"), out);
});

test("scrubEvent drops bodies, cookies and headers except user-agent, and scrubs the URL", () => {
  const event: any = {
    message: "boom for ravi@fakemail.in",
    request: {
      url: "https://paivo.in/pay/3f2b8c1e-aaaa-4bbb-8ccc-0123456789ab?utm_source=x",
      method: "POST",
      data: { upi: "ravi@okicici", utr: "412398765432" },
      cookies: { session: "abc" },
      query_string: "utm_source=x&email=ravi@fakemail.in",
      headers: { Authorization: `Bearer ${JWT}`, Cookie: "a=b", "User-Agent": "Mozilla/5.0 Test", Referer: "https://paivo.in/pay/x?y=1" },
      env: { REMOTE_ADDR: "203.0.113.9" },
    },
    user: { id: "u-1", email: "ravi@fakemail.in", ip_address: "203.0.113.9", username: "ravi" },
    exception: { values: [{ type: "Error", value: "Bad UTR 412398765432", stacktrace: { frames: [{ filename: "https://paivo.in/assets/app.js?v=3", vars: { secret: "x" } }] } }] },
    server_name: "host-1",
  };
  const out = scrubEvent(event);
  const json = JSON.stringify(out);
  assert.equal(out.request.data, undefined);
  assert.equal(out.request.cookies, undefined);
  assert.equal(out.request.query_string, undefined);
  assert.equal(out.request.env, undefined);
  assert.deepEqual(out.request.headers, { "User-Agent": "Mozilla/5.0 Test" });
  assert.equal(out.request.url, "https://paivo.in/pay/[id]?[query]");
  assert.deepEqual(out.user, { id: "u-1" });
  assert.equal(out.server_name, undefined);
  assert.ok(!json.includes("fakemail") && !json.includes("412398765432") && !json.includes("eyJ") && !json.includes("okicici") && !json.includes("203.0.113.9"), json);
  assert.ok(!json.includes('"vars"'));
  assert.equal(out.exception.values[0].stacktrace.frames[0].filename, "https://paivo.in/assets/app.js?[query]");
});

test("scrubEvent removes the user entirely when there is no id", () => {
  assert.equal(scrubEvent({ user: { email: "a@b.com" } } as any).user, undefined);
});

test("scrubEvent removes console breadcrumbs and scrubs the rest", () => {
  const out: any = scrubEvent({
    breadcrumbs: [
      { category: "console", message: "user ravi@fakemail.in typed" },
      { category: "fetch", data: { url: "https://paivo.in/api/public/invoices/3f2b8c1e-aaaa-4bbb-8ccc-0123456789ab?x=1", status_code: 500 } },
    ],
  } as any);
  assert.equal(out.breadcrumbs.length, 1);
  assert.equal(out.breadcrumbs[0].data.url, "https://paivo.in/api/public/invoices/[id]?[query]");
  assert.equal(out.breadcrumbs[0].data.status_code, 500);
});

test("scrubBreadcrumb drops console output and cleans navigation breadcrumbs", () => {
  assert.equal(scrubBreadcrumb({ category: "console", message: "hello" }), null);
  const nav: any = scrubBreadcrumb({ category: "navigation", data: { from: "/pay/abc123?x=1", to: "/client/c1/t0k3n" } });
  assert.deepEqual(nav.data, { from: "/pay/[id]?[query]", to: "/client/[id]/[token]" });
  const click: any = scrubBreadcrumb({ category: "ui.click", message: "button#send" });
  assert.equal(click.message, "button#send");
});
