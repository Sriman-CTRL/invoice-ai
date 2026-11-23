import "dotenv/config";
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/client";

/**
 * Tenant-aware Prisma client.
 *
 * Postgres row-level security (RLS) policies compare each row's organization_id with the
 * `app.current_org_id` setting. Every query below runs in a short transaction that first sets that
 * value from the request's tenant context, so the database itself refuses cross-tenant access even
 * if application code has a bug.
 *
 * Enforcement turns on when DATABASE_URL_APP (a restricted role that cannot bypass RLS) is set.
 * Without it the same code runs on DATABASE_URL (the owner, which bypasses RLS); remove the
 * variable to roll back instantly.
 */
const appUrl = process.env.DATABASE_URL_APP;
export const RLS_ENFORCED = Boolean(appUrl);

const base = new PrismaClient({
  adapter: new PrismaPg({ connectionString: appUrl || process.env.DATABASE_URL! }),
  // Neon cold starts can take a few seconds; the 2s default would fail the first query of a cold instance.
  transactionOptions: { maxWait: 15_000, timeout: 20_000 },
});

// Open the first connection outside any transaction, once, so tenant transactions never pay the cold-start cost.
let warm: Promise<unknown> | null = null;
function ensureWarm(): Promise<unknown> {
  warm ??= base.$queryRaw`SELECT 1`.catch((e) => {
    warm = null;
    throw e;
  });
  return warm;
}

interface TenantContext {
  orgId?: string;
  system?: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

/** Run code with cross-tenant access (login, public pay page, inbound webhook, platform admin). */
export function runAsSystem<T>(fn: () => T): T {
  return tenantContext.run({ system: true }, fn);
}

/** Express middleware: everything downstream runs in system mode. Use only on routes that must span tenants. */
export function systemContext(_req: Request, _res: Response, next: NextFunction): void {
  tenantContext.run({ system: true }, next);
}

/** Express helper: bind the authenticated tenant to the rest of this request. */
export function enterTenant(orgId: string): void {
  tenantContext.enterWith({ orgId });
}

function currentSettings(): { org: string; system: string } {
  const ctx = tenantContext.getStore();
  // No context = fail closed: empty org id matches no rows under the RLS policies.
  return { org: ctx?.orgId ?? "", system: ctx?.system ? "on" : "off" };
}

const prisma = base.$extends({
  query: {
    async $allOperations({ args, query, __internalParams }: any) {
      // Already inside a transaction that set its own context.
      if (__internalParams?.transaction || !RLS_ENFORCED) return query(args);
      await ensureWarm();
      const { org, system } = currentSettings();
      const [, result] = await base.$transaction([
        base.$executeRaw`SELECT set_config('app.current_org_id', ${org}, true), set_config('app.system', ${system}, true)`,
        query(args),
      ]);
      return result;
    },
  },
  client: {
    /** Interactive transaction that carries the tenant context (use instead of $transaction(async ...)). */
    async $tenantTransaction<T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
    ): Promise<T> {
      await ensureWarm();
      return base.$transaction(async (tx) => {
        if (RLS_ENFORCED) {
          const { org, system } = currentSettings();
          await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org}, true), set_config('app.system', ${system}, true)`;
        }
        return fn(tx);
      }, options);
    },
  },
});

export default prisma;
