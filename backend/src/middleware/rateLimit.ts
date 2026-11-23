import { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let limiterSeq = 0;

/**
 * Minimal in-memory fixed-window rate limiter. Good enough to blunt login
 * brute-force and webhook spam on a single instance. Swap for Redis when you
 * scale horizontally.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const { windowMs, max, message = "Too many requests. Try again shortly." } = options;
  // Each limiter keeps its own counters. Without this prefix every limiter shared one bucket per IP,
  // so unrelated routes (page-view tracking, public pages) ate the budget of the strictest limiter.
  const limiterId = ++limiterSeq;
  const keyFn = options.keyFn ?? ((req: Request) => req.ip || "unknown");

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${limiterId}:${keyFn(req)}`;

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: message });
      return;
    }

    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }

    next();
  };
}
