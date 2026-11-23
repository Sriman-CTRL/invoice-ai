import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { setGoogleVerifier, verifyGoogleToken } from "../lib/googleAuth";

/**
 * Google sign-in with a mocked verifier: no test ever contacts Google.
 * The fake "ID token" is just JSON describing what Google would have said.
 */
const dbUrl = process.env.DATABASE_URL || "";
const enabled = /localhost|127\.0\.0\.1/.test(dbUrl) || process.env.INTEGRATION_TESTS === "1";
const opts = { skip: enabled ? false : "set a local DATABASE_URL (or INTEGRATION_TESTS=1) to run integration tests" };

const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
let server: Server;
let base = "";
let prismaModule: any;
let prisma: any;
const createdEmails: string[] = [];

const token = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ email: `g-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`, email_verified: true, name: "Gita Rao", aud: CLIENT_ID, iss: "https://accounts.google.com", ...over });

async function call(method: string, path: string, body?: unknown, bearer?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}
const sys = (fn: () => Promise<any>): Promise<any> => prismaModule.runAsSystem(async () => await fn());

before(async () => {
  setGoogleVerifier(async (idToken) => {
    const p = JSON.parse(idToken);
    if (p.throw) throw new Error("invalid signature");
    return p;
  });
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  if (!enabled) return;
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const serverModule: any = await import("../server.js");
  const app = serverModule.default?.default ?? serverModule.default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  prismaModule = await import("../lib/prisma.js");
  prisma = prismaModule.default?.default ?? prismaModule.default;
});

after(async () => {
  setGoogleVerifier(null);
  delete process.env.GOOGLE_CLIENT_ID;
  if (!enabled) return;
  server?.close();
  await sys(async () => {
    const users = await prisma.users.findMany({ where: { email: { in: createdEmails } } });
    for (const u of users) {
      for (const table of ["payments", "collection_actions", "messages", "conversations", "invoices", "customers", "suppressions", "credit_notes", "users"]) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id = $1::uuid`, u.organization_id).catch(() => undefined);
      }
      await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE id = $1::uuid`, u.organization_id).catch(() => undefined);
    }
  });
  await prisma.$disconnect();
});

test("verifyGoogleToken: audience, issuer and verified email are all enforced on top of the library", async () => {
  assert.equal((await verifyGoogleToken(token())).aud, CLIENT_ID);
  await assert.rejects(() => verifyGoogleToken(token({ aud: "someone-elses-client-id" })), /wrong_audience/);
  await assert.rejects(() => verifyGoogleToken(token({ iss: "https://evil.example.com" })), /bad_issuer/);
  await assert.rejects(() => verifyGoogleToken(token({ email_verified: false })), /email_not_verified/);
  await assert.rejects(() => verifyGoogleToken(token({ throw: true })), /bad_token/);
  await assert.rejects(() => verifyGoogleToken("short"), /bad_token/);
  await assert.rejects(() => verifyGoogleToken(undefined), /bad_token/);
  const prev = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  await assert.rejects(() => verifyGoogleToken(token()), /not_configured/);
  process.env.GOOGLE_CLIENT_ID = prev;
});

test("GOOGLE: unset client id answers 503 and nothing else happens", opts, async () => {
  const prev = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    assert.equal((await call("POST", "/api/auth/google", { id_token: token(), accepted_terms: true })).status, 503);
  } finally {
    process.env.GOOGLE_CLIENT_ID = prev;
  }
});

test("GOOGLE: a new user needs the terms ticked, then gets a business on the free plan and no password", opts, async () => {
  const email = `new-${Date.now()}@example.com`;
  createdEmails.push(email);
  const idToken = token({ email });
  const noTerms = await call("POST", "/api/auth/google", { id_token: idToken });
  assert.equal(noTerms.status, 400);
  assert.equal(noTerms.json.code, "TERMS_REQUIRED");
  assert.equal(await sys(() => prisma.users.count({ where: { email } })), 0, "nothing was created without consent");

  const ok = await call("POST", "/api/auth/google", { id_token: idToken, accepted_terms: true, heard_from: "linkedin", attribution: { utm_source: "linkedin" } });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.equal(ok.json.user.email, email);
  assert.equal(ok.json.user.has_password, false);
  assert.ok(ok.json.token);
  const settings = await call("GET", "/api/organizations/settings", undefined, ok.json.token);
  assert.equal(settings.json.plan, "FREE");
  assert.equal(settings.json.auto_reminders, false);
  assert.equal((await call("POST", "/api/auth/login", { email, password: "anything-at-all-123" })).status, 401, "no password login for a Google-only account");
  const consent = await sys(() => prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM analytics_events WHERE event = 'consent_terms' AND visitor = $1`, ok.json.user.id));
  assert.equal(consent[0].n, 1, "consent evidence recorded like email sign-up");
});

test("GOOGLE: an existing account with the same email is signed in, not duplicated", opts, async () => {
  const email = `existing-${Date.now()}@example.com`;
  createdEmails.push(email);
  const reg = await call("POST", "/api/auth/register", { email, password: "Existing-Pass-8642-xy", organization_name: "Existing Co", accepted_terms: true });
  assert.equal(reg.status, 201);
  const before = await sys(() => prisma.organizations.count());
  const res = await call("POST", "/api/auth/google", { id_token: token({ email: email.toUpperCase() }) });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.id, reg.json.user.id);
  assert.equal(res.json.user.has_password, true);
  assert.equal(await sys(() => prisma.organizations.count()), before, "no new business");
});

test("GOOGLE: unverified email, wrong audience and bad tokens are refused", opts, async () => {
  const email = `refused-${Date.now()}@example.com`;
  createdEmails.push(email);
  assert.equal((await call("POST", "/api/auth/google", { id_token: token({ email, email_verified: false }), accepted_terms: true })).status, 401);
  assert.equal((await call("POST", "/api/auth/google", { id_token: token({ email, aud: "other-app" }), accepted_terms: true })).status, 401);
  assert.equal((await call("POST", "/api/auth/google", { id_token: token({ email, throw: true }), accepted_terms: true })).status, 401);
  assert.equal((await call("POST", "/api/auth/google", { accepted_terms: true })).status, 401);
  assert.equal(await sys(() => prisma.users.count({ where: { email } })), 0);
});

test("GOOGLE: a platform-admin email cannot be claimed through sign-up", opts, async () => {
  const email = `boss-${Date.now()}@example.com`;
  createdEmails.push(email);
  const prev = process.env.PLATFORM_ADMIN_EMAILS;
  process.env.PLATFORM_ADMIN_EMAILS = email;
  try {
    const res = await call("POST", "/api/auth/google", { id_token: token({ email }), accepted_terms: true });
    assert.equal(res.status, 409);
    assert.equal(await sys(() => prisma.users.count({ where: { email } })), 0);
  } finally {
    if (prev === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = prev;
  }
});

test("GOOGLE-ONLY ACCOUNT: can set a password after a fresh Google confirmation", opts, async () => {
  const email = `setpw-${Date.now()}@example.com`;
  createdEmails.push(email);
  const created = await call("POST", "/api/auth/google", { id_token: token({ email }), accepted_terms: true });
  const bearer = created.json.token as string;

  const none = await call("PUT", "/api/auth/password", { new_password: "A-Fresh-Passphrase-2468" }, bearer);
  assert.equal(none.status, 400);
  assert.equal(none.json.code, "GOOGLE_REAUTH_REQUIRED");
  const other = await call("PUT", "/api/auth/password", { new_password: "A-Fresh-Passphrase-2468", id_token: token({ email: `someone-else-${Date.now()}@example.com` }) }, bearer);
  assert.equal(other.status, 400, "a different Google account does not count");
  const weak = await call("PUT", "/api/auth/password", { new_password: "short", id_token: token({ email }) }, bearer);
  assert.equal(weak.status, 400);

  const ok = await call("PUT", "/api/auth/password", { new_password: "A-Fresh-Passphrase-2468", id_token: token({ email }) }, bearer);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const login = await call("POST", "/api/auth/login", { email, password: "A-Fresh-Passphrase-2468" });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.has_password, true);
});

test("GOOGLE-ONLY ACCOUNT: deleting the account needs fresh Google confirmation instead of a password", opts, async () => {
  const email = `delete-${Date.now()}@example.com`;
  createdEmails.push(email);
  const created = await call("POST", "/api/auth/google", { id_token: token({ email }), accepted_terms: true });
  const bearer = created.json.token as string;
  const orgId = created.json.user.organization_id as string;

  assert.equal((await call("DELETE", "/api/auth/account", { confirm: "DELETE" }, bearer)).status, 400, "no confirmation");
  assert.equal((await call("DELETE", "/api/auth/account", { confirm: "DELETE", id_token: token({ email: `nope-${Date.now()}@example.com` }) }, bearer)).status, 400, "wrong Google account");
  assert.equal((await call("DELETE", "/api/auth/account", { id_token: token({ email }) }, bearer)).status, 400, "must type DELETE");
  assert.equal(await sys(() => prisma.users.count({ where: { email } })), 1, "still there after the failed attempts");

  const ok = await call("DELETE", "/api/auth/account", { confirm: "DELETE", id_token: token({ email }) }, bearer);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(await sys(() => prisma.users.count({ where: { email } })), 0);
  assert.equal(await sys(() => prisma.organizations.count({ where: { id: orgId } })), 0);
});

test("PASSWORD ACCOUNTS: change-password and delete still need the password", opts, async () => {
  const email = `pwuser-${Date.now()}@example.com`;
  createdEmails.push(email);
  const reg = await call("POST", "/api/auth/register", { email, password: "Violet-Harbor-1357-xy", organization_name: "Pw Co", accepted_terms: true });
  assert.equal(reg.status, 201);
  const login = await call("POST", "/api/auth/login", { email, password: "Violet-Harbor-1357-xy" });
  const bearer = login.json.token as string;
  assert.equal((await call("PUT", "/api/auth/password", { new_password: "Copper-Lantern-9753-q" }, bearer)).status, 400);
  assert.equal((await call("PUT", "/api/auth/password", { current_password: "wrong", new_password: "Copper-Lantern-9753-q", id_token: token({ email }) }, bearer)).status, 400, "a Google token cannot replace the password here");
  assert.equal((await call("DELETE", "/api/auth/account", { confirm: "DELETE", id_token: token({ email }) }, bearer)).status, 400, "Google token does not replace the password either");
  assert.equal((await call("DELETE", "/api/auth/account", { confirm: "DELETE", password: "Violet-Harbor-1357-xy" }, bearer)).status, 200);
});
