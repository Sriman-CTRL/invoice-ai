import prisma from "./prisma";

/**
 * Brute-force protection that survives serverless cold starts (the in-memory limiter does not):
 * failed logins are recorded in Postgres and checked per email and per IP over a sliding window.
 */
const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 30;

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS auth_failures (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        ip VARCHAR(64) NOT NULL,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS auth_failures_email_at ON auth_failures (email, at)`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS auth_failures_ip_at ON auth_failures (ip, at)`);
    })().catch((e) => {
      console.warn("ensureTable(auth_failures): skipped DDL:", (e as Error).message);
    });
  }
  return ready;
}

/** Returns seconds to wait if the caller is currently locked out, else 0. */
export async function loginLockoutSeconds(email: string, ip: string): Promise<number> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ by_email: number; by_ip: number }[]>(
    `SELECT
       count(*) FILTER (WHERE email = $1)::int AS by_email,
       count(*) FILTER (WHERE ip = $2)::int AS by_ip
     FROM auth_failures
     WHERE at > now() - interval '${WINDOW_MINUTES} minutes' AND (email = $1 OR ip = $2)`,
    email,
    ip,
  );
  const r = rows[0] ?? { by_email: 0, by_ip: 0 };
  return r.by_email >= MAX_PER_EMAIL || r.by_ip >= MAX_PER_IP ? WINDOW_MINUTES * 60 : 0;
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRawUnsafe(`INSERT INTO auth_failures (email, ip) VALUES ($1, $2)`, email.slice(0, 255), ip.slice(0, 64));
  // Opportunistic cleanup of old rows.
  if (Math.random() < 0.05) {
    await prisma.$executeRawUnsafe(`DELETE FROM auth_failures WHERE at < now() - interval '1 day'`);
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRawUnsafe(`DELETE FROM auth_failures WHERE email = $1`, email);
}
