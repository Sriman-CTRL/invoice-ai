import { test } from "node:test";
import assert from "node:assert/strict";
import { bareAddress, senderDomainAuthenticated } from "../lib/emailAuth";

const ok = (h: string | undefined, from = "seller@example.com") => senderDomainAuthenticated(h, from);

test("senderDomainAuthenticated: dmarc=pass for the From domain", () => {
  assert.equal(ok("mx.cloudflare.net; dmarc=pass (p=none) header.from=example.com"), true);
  assert.equal(ok("MX.Cloudflare.net; DMARC=PASS header.from=Example.COM"), true);
  assert.equal(ok("mx.example.net;\r\n dkim=pass header.d=other.org;\r\n dmarc=pass header.from=example.com"), true, "folded header");
});

test("senderDomainAuthenticated: spf and dkim must both pass for that same domain", () => {
  assert.equal(ok("mx.x; spf=pass smtp.mailfrom=bounce@example.com; dkim=pass header.d=example.com"), true);
  assert.equal(ok("mx.x; spf=pass smtp.mailfrom=seller@example.com"), false, "spf alone");
  assert.equal(ok("mx.x; dkim=pass header.d=example.com"), false, "dkim alone");
  assert.equal(ok("mx.x; spf=pass smtp.mailfrom=a@other.org; dkim=pass header.d=example.com"), false, "spf for another domain");
  assert.equal(ok("mx.x; spf=pass smtp.mailfrom=a@example.com; dkim=pass header.d=other.org"), false, "dkim for another domain");
});

test("senderDomainAuthenticated: fails closed on anything missing or wrong", () => {
  assert.equal(ok(undefined), false);
  assert.equal(ok(""), false);
  assert.equal(ok("mx.x; dmarc=fail header.from=example.com"), false);
  assert.equal(ok("mx.x; dmarc=none header.from=example.com"), false);
  assert.equal(ok("mx.x; dmarc=pass header.from=evil.example"), false);
  assert.equal(ok("mx.x; dmarc=pass"), false, "no header.from to align with");
  assert.equal(ok("mx.x; dmarc=pass header.from=example.com", ""), false);
  assert.equal(ok("mx.x; dmarc=pass header.from=example.com", "not-an-address"), false);
  assert.equal(ok("x".repeat(5000)), false);
});

test("bareAddress", () => {
  assert.equal(bareAddress("Gita Rao <Gita@Example.com>"), "gita@example.com");
  assert.equal(bareAddress("gita@example.com"), "gita@example.com");
  assert.equal(bareAddress("no at sign"), null);
  assert.equal(bareAddress(undefined), null);
});
