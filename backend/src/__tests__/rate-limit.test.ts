import { after, test } from "node:test";
import assert from "node:assert/strict";

/**
 * Proves the shared rate limiter counts in Postgres when running as the restricted `app_user` role
 * (which cannot run DDL, so rate_limits must come from enable-rls.cjs). Skipped unless
 * DATABASE_URL_APP is set and the DB is local (or INTEGRATION_TESTS=1).
 */
const appUrl = process.env.DATABASE_URL_APP || "";
const enabled = Boolean(appUrl) && (/localhost|127\.0\.0\.1/.test(appUrl) || process.env.INTEGRATION_TESTS === "1");
const opts = { skip: enabled ? false : "set DATABASE_URL_APP (and a local DB or INTEGRATION_TESTS=1) to run this test" };

const key = `test-rate-limit-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

after(async () => {
  if (!enabled) return;
  const prismaModule: any = await import("../lib/prisma.js");
  const prisma = prismaModule.default?.default ?? prismaModule.default;
  await prisma.$executeRawUnsafe(`DELETE FROM rate_limits WHERE key = $1`, key).catch(() => undefined);
  await prisma.$disconnect?.();
});

test("sharedHit counts 1 then 2 from the database as the restricted role", opts, async () => {
  const mod: any = await import("../middleware/rateLimit.js");
  const sharedHit = mod.sharedHit ?? mod.default?.sharedHit;
  const first = await sharedHit(key, 60_000);
  const second = await sharedHit(key, 60_000);
  assert.equal(first.count, 1);
  assert.equal(second.count, 2);
});
