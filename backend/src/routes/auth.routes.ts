import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../lib/config";
import { turnstileGuard } from "../lib/turnstile";
import { authMiddleware } from "../middleware/auth.middleware";
import { passwordProblem } from "../lib/passwordPolicy";
import { clearLoginFailures, loginLockoutSeconds, recordLoginFailure } from "../lib/loginThrottle";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let dummyHashPromise: Promise<string> | null = null;

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "org";
  return `${base}-${Date.now().toString(36)}`;
}

router.post("/register", turnstileGuard, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, organization_name } = req.body ?? {};

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
    res.status(500).json({ error: "Internal server error" });
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

    const token = jwt.sign(
      { id: user.id, organization_id: user.organization_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, organization_id: user.organization_id },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/auth/password: change your own password. Requires the current password,
 * is brute-force throttled, and enforces the stronger 12+ character policy.
 */
router.put("/password", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { current_password, new_password } = req.body ?? {};
    const userId = req.user?.id;
    if (!userId || typeof current_password !== "string" || typeof new_password !== "string") {
      res.status(400).json({ error: "current_password and new_password are required" });
      return;
    }

    const user = await prisma.users.findFirst({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "Account not found" });
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
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
