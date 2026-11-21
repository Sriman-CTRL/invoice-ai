import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../lib/config";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let dummyHashPromise: Promise<string> | null = null;

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "org";
  return `${base}-${Date.now().toString(36)}`;
}

router.post("/register", async (req: Request, res: Response): Promise<void> => {
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
    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
      res.status(400).json({ error: "Password must be between 8 and 72 characters" });
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

    const emailTrimmed = String(email).trim().toLowerCase();

    // Email is globally unique (register enforces it), but findFirst would be
    // ambiguous if that invariant ever breaks. Keep it explicit and cheap.
    const user = await prisma.users.findFirst({ where: { email: emailTrimmed } });

    // Always do a hash comparison so response timing doesn't reveal whether an
    // account exists. The dummy hash is computed once and cached.
    dummyHashPromise ??= bcrypt.hash("invalid-password-probe", 12);
    const hash = user?.password_hash ?? (await dummyHashPromise);
    const isValid = await bcrypt.compare(String(password), hash);

    if (!user || !isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

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

export default router;
