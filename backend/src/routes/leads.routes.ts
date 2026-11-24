import { Request, Response, Router } from "express";
import prisma from "../lib/prisma";
import { ensureExtraSchema } from "../lib/extraSchema";
import { serverError } from "../lib/monitoring";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/leads: public waitlist sign-ups and product feedback.
 * Spam protection: strict rate limit (mounted in server.ts), a hidden honeypot field, length caps,
 * and idempotent waitlist entries (same email + plan is stored once).
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { kind, email, message, plan, website } = req.body ?? {};
    if (website) {
      res.status(204).end(); // honeypot: real people never fill this in
      return;
    }
    if (kind !== "waitlist" && kind !== "feedback") {
      res.status(400).json({ error: "Invalid request." });
      return;
    }
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase().slice(0, 255) : "";
    if ((kind === "waitlist" || cleanEmail) && !EMAIL_RE.test(cleanEmail)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const cleanMessage = typeof message === "string" ? message.trim().slice(0, 1000) : "";
    if (kind === "feedback" && cleanMessage.length < 3) {
      res.status(400).json({ error: "Please write a few words so we understand." });
      return;
    }
    const cleanPlan = ["PRO", "AGENCY"].includes(String(plan ?? "").toUpperCase()) ? String(plan).toUpperCase() : null;

    await ensureExtraSchema();
    if (kind === "waitlist") {
      const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
        "SELECT id FROM leads WHERE kind = 'waitlist' AND email = $1 AND COALESCE(plan, '') = COALESCE($2, '') LIMIT 1",
        cleanEmail, cleanPlan,
      );
      if (existing.length) {
        res.status(200).json({ success: true, message: "You're already on the list. We'll email you." });
        return;
      }
    }
    await prisma.$executeRawUnsafe(
      "INSERT INTO leads (kind, email, plan, message) VALUES ($1, $2, $3, $4)",
      kind, cleanEmail || null, cleanPlan, cleanMessage || null,
    );
    res.status(201).json({
      success: true,
      message: kind === "waitlist" ? "You're on the list. We'll email you when it's ready." : "Thank you. Your feedback goes straight to the founder.",
    });
  } catch (error) {
    console.error("leads error:", error);
    return serverError(res, error, "Something went wrong. Please try again.");
  }
});

export default router;
