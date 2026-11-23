import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * Turnstile guard, verified against Cloudflare's official always-pass / always-fail test secrets
 * (https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Needs internet and a local DB.
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1)" };
const ALWAYS_PASS = "1x0000000000000000000000000000000AA";
const ALWAYS_FAIL = "2x0000000000000000000000000000000AA";

let server: Server;
let base = "";
const orgIds: string[] = [];

before(async () => {
  if (!enabled) return;
  const mod: any = await import("../server.js");
  const app = mod.default?.default ?? mod.default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (!enabled) return;
  server?.close();
  delete process.env.TURNSTILE_SECRET;
  const mod: any = await import("../lib/prisma.js");
  const prisma = mod.default?.default ?? mod.default;
  await mod.runAsSystem(async () => {
    for (const org of orgIds) {
      await prisma.$executeRawUnsafe(`DELETE FROM users WHERE organization_id = $1::uuid`, org).catch(() => undefined);
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, org).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

const register = async (token?: string) => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `ts-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`, password: "Turnstile-Check-7391", organization_name: "TS Org", turnstile_token: token }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (json?.organization?.id) orgIds.push(json.organization.id);
  return { status: res.status, json };
};

test("TURNSTILE: with no secret configured, sign-up is not blocked", opts, async () => {
  delete process.env.TURNSTILE_SECRET;
  assert.equal((await register()).status, 201);
});

test("TURNSTILE: with a secret configured, a missing token is rejected", opts, async () => {
  process.env.TURNSTILE_SECRET = ALWAYS_PASS;
  const r = await register();
  assert.equal(r.status, 400);
  assert.match(r.json.error, /human check/i);
});

test("TURNSTILE: a token Cloudflare rejects is refused", opts, async () => {
  process.env.TURNSTILE_SECRET = ALWAYS_FAIL;
  assert.equal((await register("XXXX.DUMMY.TOKEN.XXXX")).status, 400);
});

test("TURNSTILE: a token Cloudflare accepts lets sign-up through", opts, async () => {
  process.env.TURNSTILE_SECRET = ALWAYS_PASS;
  assert.equal((await register("XXXX.DUMMY.TOKEN.XXXX")).status, 201);
});

test("TURNSTILE: the payment-proof form is protected too", opts, async () => {
  process.env.TURNSTILE_SECRET = ALWAYS_FAIL;
  const res = await fetch(`${base}/api/public/invoices/00000000-0000-4000-8000-000000000000/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utr: "ABCDEF123456", turnstile_token: "XXXX.DUMMY.TOKEN.XXXX" }),
  });
  assert.equal(res.status, 400, "blocked before any invoice lookup");
});
