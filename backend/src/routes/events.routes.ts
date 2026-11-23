import { Request, Response, Router } from "express";
import prisma from "../lib/prisma";
import { ensureExtraSchema } from "../lib/extraSchema";
import { encodeAttribution } from "../lib/attribution";

const router = Router();

const UUID_SEG = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const VISITOR_RE = /^[A-Za-z0-9_-]{8,40}$/;

/**
 * POST /api/events: privacy-friendly first-party page-view counter.
 * No cookies, no IP stored, no user agent, no personal data. `visitor` is a random per-tab-session id.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { event, path, referrer, visitor, attribution } = req.body ?? {};
    if (event === "attribution") {
      const tags = encodeAttribution(attribution);
      const who = typeof visitor === "string" && VISITOR_RE.test(visitor) ? visitor : null;
      if (tags && who) {
        await ensureExtraSchema();
        await prisma.$executeRawUnsafe("INSERT INTO analytics_events (event, path, visitor) VALUES ('attribution', $1, $2)", tags, who);
      }
      res.status(204).end();
      return;
    }
    if (event !== "pageview" || typeof path !== "string" || !path.startsWith("/") || path.length > 200) {
      res.status(204).end();
      return;
    }
    const cleanPath = path.split("?")[0].split("#")[0].replace(UUID_SEG, ":id").slice(0, 200);
    let ref: string | null = null;
    if (typeof referrer === "string" && referrer) {
      try { ref = new URL(referrer).hostname.slice(0, 100); } catch { ref = null; }
    }
    const vis = typeof visitor === "string" && VISITOR_RE.test(visitor) ? visitor : null;
    await ensureExtraSchema();
    await prisma.$executeRawUnsafe(
      "INSERT INTO analytics_events (event, path, referrer, visitor) VALUES ($1, $2, $3, $4)",
      "pageview", cleanPath, ref, vis,
    );
    res.status(204).end();
  } catch (error) {
    console.error("events error:", error);
    res.status(204).end(); // analytics must never break the page
  }
});

export default router;
