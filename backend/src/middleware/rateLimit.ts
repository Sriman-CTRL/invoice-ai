import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let limiterSeq = 0;

/**
 * Fixed-window rate limiter. By default counters live in memory (fine for one instance).
 * With `shared: true` they live in Postgres, so the limit holds across serverless instances;
 * if the database call fails it falls back to the in-memory counter.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
  shared?: boolean;
}) {
  const { windowMs, max, message = "Too many requests. Try again shortly." } = options;
  // Each limiter keeps its own counters, so unrelated routes don't eat each other's budget.
  const limiterId = ++limiterSeq;
  const keyFn = options.keyFn ?? ((req: Request) => req.ip || "unknown");

  function memoryHit(req: Request, res: Response, next: NextFunction): void {
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
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!options.shared) {
      memoryHit(req, res, next);
      return;
    }
    const sharedKey = `${limiterId}:${windowMs}:${keyFn(req)}`.slice(0, 200);
    sharedHit(sharedKey, windowMs)
      .then((r) => {
        if (r.count > max) {
          res.setHeader("Retry-After", String(r.retryAfter));
          res.status(429).json({ error: message });
        } else {
          next();
        }
      })
      .catch(() => memoryHit(req, res, next));
  };
}

let tableReady: Promise<void> | null = null;
function ensureRateTable(): Promise<void> {
  tableReady ??= prisma
    .$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INT NOT NULL,
      reset_at TIMESTAMPTZ NOT NULL
    )`)
    .then(() => undefined)
    .catch((e) => {
      tableReady = null;
      throw e;
    });
  return tableReady;
}

/** Atomic fixed-window counter shared by every server instance. */
async function sharedHit(key: string, windowMs: number): Promise<{ count: number; retryAfter: number }> {
  await ensureRateTable();
  const rows = await prisma.$queryRawUnsafe<{ count: number; retry: number }[]>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now() + ($2::int * interval '1 millisecond'))
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + ($2::int * interval '1 millisecond') ELSE rate_limits.reset_at END
     RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int AS retry`,
    key,
    windowMs,
  );
  if (Math.random() < 0.02) {
    prisma.$executeRawUnsafe(`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`).catch(() => undefined);
  }
  return { count: rows[0].count, retryAfter: rows[0].retry };
}
