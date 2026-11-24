import { encodeAttribution } from "../lib/attribution";
import { Router, Request, Response } from "express";
import prisma, { runAsSystem } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../lib/config";
import { turnstileGuard } from "../lib/turnstile";
import { authMiddleware } from "../middleware/auth.middleware";
import { passwordProblem } from "../lib/passwordPolicy";
import { clearLoginFailures, loginLockoutSeconds, recordLoginFailure } from "../lib/loginThrottle";
import { googleClientId, verifyGoogleToken } from "../lib/googleAuth";
import { serverError } from "../lib/monitoring";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let dummyHashPromise: Promise<string> | null = null;

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "org";
  return `${base}-${Date.now().toString(36)}`;
}

const SIGNUP_SOURCES = ["friend", "whatsapp", "linkedin", "instagram", "x", "youtube", "reddit", "google", "other"];

/** Consent evidence (who, when, which terms) and, optionally, how they found us. Never blocks sign-up. */
async function recordSignupEvidence(userId: string, heard_from: unknown, attribution: unknown): Promise<void> {
  await prisma
    .$executeRawUnsafe(`INSERT INTO analytics_events (event, path, visitor) VALUES ('consent_terms', 'terms-privacy-2026-11', $1)`, userId)
    .catch((e) => console.warn("consent log skipped:", (e as Error).message));
  if (typeof heard_from === "string" && SIGNUP_SOURCES.includes(heard_from)) {
    await prisma
      .$executeRawUnsafe(`INSERT INTO analytics_events (event, path) VALUES ('signup_source', $1)`, heard_from)
      .catch((e) => console.warn("source log skipped:", (e as Error).message));
  }
  const tags = encodeAttribution(attribution);
  if (tags) {
    await prisma
      .$executeRawUnsafe(`INSERT INTO analytics_events (event, path) VALUES ('signup_attr', $1)`, tags)
      .catch((e) => console.warn("attribution log skipped:", (e as Error).message));
  }
}

const platformAdminEmails = (): string[] => (process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

function sessionFor(user: { id: string; email: string; name: string | null; organization_id: string; password_hash: string | null; google_sub?: string | null }) {
  const token = jwt.sign({ id: user.id, organization_id: user.organization_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
  return { token, user: { id: user.id, email: user.email, name: user.name, organization_id: user.organization_id, has_password: Boolean(user.password_hash), google_linked: Boolean(user.google_sub) } };
}

router.post("/register", turnstileGuard, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, organization_name, accepted_terms, heard_from, attribution } = req.body ?? {};

    if (accepted_terms !== true) {
      res.status(400).json({ error: "Please confirm you are 18 or older and accept the Terms and Privacy Policy." });
      return;
    }

    if (!email || !password || !organization_name) {
      res.status(400).json({ error: "email, password, and organization_name are required" });
      return;
    }

    const emailTrimmed = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(emailTrimmed)) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }
    const weak = passwordProblem(password, emailTrimmed, 10);
    if (weak) {
      res.status(400).json({ error: weak });
      return;
    }

    // Platform-admin emails can never be claimed through public sign-up (there is no email verification yet).
    if (platformAdminEmails().includes(emailTrimmed)) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const existingUser = await prisma.users.findFirst({ where: { email: emailTrimmed } });
    if (existingUser) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const organization = await prisma.organizations.create({
      data: { name: String(organization_name).trim().slice(0, 255), slug: slugify(String(organization_name)) },
    });

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.users.create({
      data: {
        email: emailTrimmed,
        name: name || null,
        password_hash,
        organization_id: organization.id,
      },
    });

    await recordSignupEvidence(user.id, heard_from, attribution);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, organization_id: user.organization_id },
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
    });
  } catch (error) {
    if (String((error as { code?: string })?.code) === "P2002" || /unique|duplicate/i.test(String((error as Error)?.message))) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    console.error("Register error:", error);
    return serverError(res, error, "Internal server error");
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const emailTrimmed = String(email).trim().toLowerCase().slice(0, 255);
    const ip = String(req.ip || "unknown");

    const wait = await loginLockoutSeconds(emailTrimmed, ip);
    if (wait > 0) {
      res.setHeader("Retry-After", String(wait));
      res.status(429).json({ error: "Too many failed sign-in attempts. Please wait 15 minutes and try again." });
      return;
    }

    // Email is globally unique (register enforces it), but findFirst would be
    // ambiguous if that invariant ever breaks. Keep it explicit and cheap.
    const user = await prisma.users.findFirst({ where: { email: emailTrimmed } });

    // Always do a hash comparison so response timing doesn't reveal whether an
    // account exists. The dummy hash is computed once and cached.
    dummyHashPromise ??= bcrypt.hash("invalid-password-probe", 12);
    const hash = user?.password_hash ?? (await dummyHashPromise);
    const isValid = await bcrypt.compare(String(password), hash);

    if (!user || !isValid) {
      await recordLoginFailure(emailTrimmed, ip);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    await clearLoginFailures(emailTrimmed);

    res.json(sessionFor(user));
  } catch (error) {
    console.error("Login error:", error);
    return serverError(res, error, "Internal server error");
  }
});

const GOOGLE_ERRORS: Record<string, [number, string]> = {
  not_configured: [503, "Google sign-in isn't available right now."],
  bad_token: [401, "Google sign-in could not be verified. Please try again."],
  wrong_audience: [401, "Google sign-in could not be verified. Please try again."],
  bad_issuer: [401, "Google sign-in could not be verified. Please try again."],
  email_not_verified: [401, "Your Google email address isn't verified, so we can't sign you in with it."],
};

/**
 * POST /api/auth/google: sign in (or sign up) with a Google ID token. Inert (503) until GOOGLE_CLIENT_ID is set.
 * An existing account with the same email is signed in; a new one is created exactly like /register
 * (new business, free plan, consent evidence, admin-email block), which needs accepted_terms = true.
 */
router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!googleClientId()) {
      res.status(503).json({ error: GOOGLE_ERRORS.not_configured[1] });
      return;
    }
    const { id_token, accepted_terms, heard_from, attribution } = req.body ?? {};
    let identity;
    try {
      identity = await verifyGoogleToken(id_token);
    } catch (e) {
      const [status, message] = GOOGLE_ERRORS[(e as Error).message] ?? GOOGLE_ERRORS.bad_token;
      res.status(status).json({ error: message });
      return;
    }

    const email = identity.email.slice(0, 320);
    const sub = identity.sub as string;
    // 1) A user already linked to this Google account signs in (the email may even have changed since).
    const linked = await prisma.users.findFirst({ where: { google_sub: sub } });
    if (linked) {
      res.json(sessionFor(linked));
      return;
    }
    const existing = await prisma.users.findFirst({ where: { email } });
    if (existing) {
      // Sign-up has no email verification, so a password account with this email may have been created by someone
      // else. Never hand it to whoever holds the matching Google address: they must prove the password first.
      // A user with NO password and no Google link can only be an older Google-created account, so it is safe to link.
      if (existing.password_hash || existing.google_sub) {
        res.status(409).json({
          error: "This email already has a Paivo account. Sign in with your password, then connect Google in Settings.",
          code: "LINK_REQUIRED",
        });
        return;
      }
      const bound = await prisma.users.update({ where: { id: existing.id }, data: { google_sub: sub } });
      res.json(sessionFor(bound));
      return;
    }

    if (accepted_terms !== true) {
      res.status(400).json({ error: "To create an account, first confirm you are 18 or older and accept the Terms and Privacy Policy on the Create account page.", code: "TERMS_REQUIRED" });
      return;
    }
    // Same rule as /register: platform-admin emails can't be claimed through public sign-up.
    if (platformAdminEmails().includes(email)) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const display = (identity.name || email.split("@")[0]).trim().slice(0, 80);
    const orgName = `${display}'s business`;
    const organization = await prisma.organizations.create({ data: { name: orgName.slice(0, 255), slug: slugify(orgName) } });
    const user = await prisma.users.create({
      data: { email, name: identity.name?.slice(0, 255) || null, password_hash: null, google_sub: sub, organization_id: organization.id },
    });
    await recordSignupEvidence(user.id, heard_from, attribution);
    res.status(201).json(sessionFor(user));
  } catch (error) {
    console.error("Google sign-in error:", error);
    return serverError(res, error, "Internal server error");
  }
});

/**
 * Fresh Google re-authentication for accounts without a password: proves the person at the keyboard controls the
 * Google account behind this user. Returns an error message, or null when it checks out.
 */
async function googleReauthProblem(idToken: unknown, user: { id: string; email: string; google_sub: string | null }): Promise<string | null> {
  if (!googleClientId()) return "Google sign-in isn't available right now.";
  try {
    const identity = await verifyGoogleToken(idToken);
    const wrong = "That Google account is not the one this account uses.";
    if (user.google_sub) return identity.sub === user.google_sub ? null : wrong;
    // Older Google-created account that was never linked: same email, then link it now.
    if (identity.email !== user.email.toLowerCase()) return wrong;
    await prisma.users.update({ where: { id: user.id }, data: { google_sub: identity.sub as string } });
    return null;
  } catch {
    return "Please confirm with Google first.";
  }
}

/**
 * POST /api/auth/google/link: connect your Google account to the account you are signed into. The Google email must
 * equal the account email, and a Google account can be linked to one Paivo account only.
 */
router.post("/google/link", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!googleClientId()) {
      res.status(503).json({ error: GOOGLE_ERRORS.not_configured[1] });
      return;
    }
    const user = req.user?.id ? await prisma.users.findFirst({ where: { id: req.user.id } }) : null;
    if (!user) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    let identity;
    try {
      identity = await verifyGoogleToken(req.body?.id_token);
    } catch (e) {
      const [status, message] = GOOGLE_ERRORS[(e as Error).message] ?? GOOGLE_ERRORS.bad_token;
      // 400, not 401: a 401 would sign the user out of the app.
      res.status(status === 401 ? 400 : status).json({ error: message });
      return;
    }
    if (identity.email !== user.email.toLowerCase()) {
      res.status(400).json({ error: "That Google account uses a different email. Choose the Google account with the same email as this Paivo account." });
      return;
    }
    if (user.google_sub && user.google_sub !== identity.sub) {
      res.status(409).json({ error: "A different Google account is already connected to this account." });
      return;
    }
    // Other tenants are invisible under RLS, so look across tenants (uniqueness is global).
    const taken = await runAsSystem(async () => await prisma.users.findFirst({ where: { google_sub: identity.sub as string, NOT: { id: user.id } } }));
    if (taken) {
      res.status(409).json({ error: "That Google account is already connected to another Paivo account." });
      return;
    }
    await prisma.users.update({ where: { id: user.id }, data: { google_sub: identity.sub as string } });
    res.json({ success: true, google_linked: true });
  } catch (error) {
    console.error("Google link error:", error);
    return serverError(res, error, "Internal server error");
  }
});

/**
 * PUT /api/auth/password: change your own password. Requires the current password,
 * is brute-force throttled, and enforces the stronger 12+ character policy.
 */
router.put("/password", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { current_password, new_password, id_token } = req.body ?? {};
    const userId = req.user?.id;
    if (!userId || typeof new_password !== "string") {
      res.status(400).json({ error: "current_password and new_password are required" });
      return;
    }

    const user = await prisma.users.findFirst({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    // Accounts created with Google have no password yet: let them set one after a fresh Google confirmation.
    if (!user.password_hash) {
      const problem = await googleReauthProblem(id_token, user);
      if (problem) {
        res.status(400).json({ error: problem, code: "GOOGLE_REAUTH_REQUIRED" });
        return;
      }
      const weak = passwordProblem(new_password, user.email, 12);
      if (weak) {
        res.status(400).json({ error: weak });
        return;
      }
      await prisma.users.update({ where: { id: user.id }, data: { password_hash: await bcrypt.hash(new_password, 12) } });
      res.json({ success: true, message: "Password set. You can now sign in with your email and password too." });
      return;
    }
    if (typeof current_password !== "string") {
      res.status(400).json({ error: "current_password and new_password are required" });
      return;
    }

    const throttleKey = `pwchange:${user.email}`.slice(0, 255);
    const ip = String(req.ip || "unknown");
    const wait = await loginLockoutSeconds(throttleKey, ip);
    if (wait > 0) {
      res.setHeader("Retry-After", String(wait));
      res.status(429).json({ error: "Too many failed attempts. Please wait 15 minutes and try again." });
      return;
    }

    if (!user.password_hash || !(await bcrypt.compare(current_password, user.password_hash))) {
      await recordLoginFailure(throttleKey, ip);
      res.status(400).json({ error: "Your current password is incorrect" });
      return;
    }

    const problem = passwordProblem(new_password, user.email, 12);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }
    if (new_password === current_password) {
      res.status(400).json({ error: "Your new password must be different from the current one" });
      return;
    }

    await prisma.users.update({ where: { id: user.id }, data: { password_hash: await bcrypt.hash(new_password, 12) } });
    await clearLoginFailures(throttleKey);
    await clearLoginFailures(user.email);
    res.json({ success: true, message: "Password updated. Use your new password the next time you sign in." });
  } catch (error) {
    console.error("Change password error:", error);
    return serverError(res, error, "Internal server error");
  }
});

/**
 * DELETE /api/auth/account: permanently deletes your account. If you are the only user of your
 * organisation, the organisation and all its invoices, customers, payments and messages go too.
 * Requires the current password (brute-force throttled) and the exact text "DELETE".
 */
router.delete("/account", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, confirm, id_token } = req.body ?? {};
    const userId = req.user?.id;
    if (!userId || confirm !== "DELETE") {
      res.status(400).json({ error: "Enter your password and type DELETE to confirm." });
      return;
    }
    const user = await prisma.users.findFirst({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    // Google-only accounts have no password: a fresh Google confirmation takes its place.
    if (!user.password_hash) {
      const problem = await googleReauthProblem(id_token, user);
      if (problem) {
        res.status(400).json({ error: problem, code: "GOOGLE_REAUTH_REQUIRED" });
        return;
      }
      const members = await prisma.users.count({ where: { organization_id: user.organization_id } });
      if (members <= 1) await prisma.organizations.delete({ where: { id: user.organization_id } });
      else await prisma.users.delete({ where: { id: user.id } });
      res.json({ success: true });
      return;
    }
    if (typeof password !== "string") {
      res.status(400).json({ error: "Enter your password and type DELETE to confirm." });
      return;
    }
    const throttleKey = `acctdel:${user.email}`.slice(0, 255);
    const ip = String(req.ip || "unknown");
    const wait = await loginLockoutSeconds(throttleKey, ip);
    if (wait > 0) {
      res.setHeader("Retry-After", String(wait));
      res.status(429).json({ error: "Too many failed attempts. Please wait 15 minutes and try again." });
      return;
    }
    if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      await recordLoginFailure(throttleKey, ip);
      res.status(400).json({ error: "Your password is incorrect" });
      return;
    }
    const members = await prisma.users.count({ where: { organization_id: user.organization_id } });
    if (members <= 1) {
      await prisma.organizations.delete({ where: { id: user.organization_id } }); // cascades to all tenant data
    } else {
      await prisma.users.delete({ where: { id: user.id } });
    }
    await clearLoginFailures(throttleKey);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return serverError(res, error, "Could not delete the account. Please contact support.");
  }
});

export default router;
