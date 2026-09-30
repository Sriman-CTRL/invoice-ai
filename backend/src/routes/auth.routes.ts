import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
}
const SECRET = JWT_SECRET || "fallback_secret_for_development";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

router.post("/register", async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name, organization_name } = req.body;

        if (!email || !password || !organization_name) {
            res.status(400).json({ error: "email, password, and organization_name are required" });
            return;
        }

        // Check if user already exists
        const existingUser = await prisma.users.findFirst({
            where: { email }
        });

        if (existingUser) {
            res.status(400).json({ error: "Email already in use" });
            return;
        }

        // Create organization
        // Since slug is unique, we create a basic slug from the name + timestamp
        const slug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
        
        const organization = await prisma.organizations.create({
            data: {
                name: organization_name,
                slug
            }
        });

        const password_hash = await bcrypt.hash(password, 10);

        const user = await prisma.users.create({
            data: {
                email,
                name: name || null,
                password_hash,
                organization_id: organization.id
            }
        });

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organization_id: user.organization_id
            },
            organization: {
                id: organization.id,
                name: organization.name
            }
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: "email and password are required" });
            return;
        }

        const user = await prisma.users.findFirst({
            where: { email }
        });

        if (!user || !user.password_hash) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const token = jwt.sign(
            { id: user.id, organization_id: user.organization_id },
            SECRET,
            { expiresIn: JWT_EXPIRES_IN as any }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organization_id: user.organization_id
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
