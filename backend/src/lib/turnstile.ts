import type { NextFunction, Request, Response } from "express";

/**
 * Cloudflare Turnstile (free, privacy-friendly CAPTCHA alternative).
 * Enabled when TURNSTILE_SECRET is set; when unset the guard is a no-op so the app works before keys exist.
 * Once enabled it fails closed: a missing/invalid token, or Cloudflare being unreachable, blocks the request.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET);
}

export async function verifyTurnstileToken(token: unknown, ip?: string): Promise<{ ok: boolean; reason?: "missing" | "invalid" | "unavailable" }> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true };
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return { ok: false, reason: "missing" };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { success?: boolean };
    return data.success ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function turnstileGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!turnstileEnabled()) return next();
  const result = await verifyTurnstileToken(req.body?.turnstile_token, req.ip);
  if (result.ok) return next();
  if (result.reason === "unavailable") {
    res.status(503).json({ error: "We couldn't verify you're human right now. Please try again in a moment." });
    return;
  }
  res.status(400).json({ error: "Please complete the human check and try again." });
}
