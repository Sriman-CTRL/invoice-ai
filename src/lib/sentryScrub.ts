/**
 * Privacy scrubber for error reports. Every event and breadcrumb passes through here before it leaves the
 * browser (frontend) or the server (backend copy: backend/src/lib/sentryScrub.ts). Keep the two files in step.
 *
 * It removes personal and payment data from text, strips ids and tokens out of URLs, and drops request bodies,
 * cookies and every header except user-agent. It is deliberately over-eager: a report with a little too much
 * "[redacted]" is better than one with a client's email in it.
 */

// Order matters: tokens first (they contain characters the later patterns would partly match), then emails
// before UPI IDs (an email is also "name@something"), then the digit patterns from most to least specific.
const TEXT_RULES: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]"],
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]*)?/g, "[jwt]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, "[email]"],
  [/\b[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}\b/g, "[upi]"],
  [/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, "[gstin]"],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[ifsc]"],
  [/(?<!\d)\d{12}(?!\d)/g, "[utr]"],
  [/(?<!\d)\d{9,18}(?!\d)/g, "[account]"],
];

function scrubPlain(input: string): string {
  let out = input;
  for (const [re, label] of TEXT_RULES) out = out.replace(re, label);
  return out;
}

/** Free text: web addresses inside it get the same treatment as a URL field, then the patterns above. */
export function scrubText(input: string): string {
  return scrubPlain(input.replace(/https?:\/\/[^\s"'<>)\]]+/gi, (m) => scrubUrl(m)));
}

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** Replace ids and tokens in a URL's path, and drop the query string and fragment completely. */
export function scrubUrl(input: string): string {
  let url = input;
  const hadQuery = /[?#]/.test(url);
  url = url.split("#")[0].split("?")[0];
  url = url
    .replace(/\/client\/[^/]+\/[^/]+/g, "/client/[id]/[token]")
    .replace(/\/pay\/[^/]+/g, "/pay/[id]")
    .replace(/\/public\/invoices\/[^/]+/g, "/public/invoices/[id]")
    .replace(/\/unsubscribe\/[^/]+/g, "/unsubscribe/[token]")
    .replace(UUID_SEGMENT, "/[id]");
  return scrubPlain(url) + (hadQuery ? "?[query]" : "");
}

const URL_KEY = /(^|[._-])(url|uri|href|filename|abs_path|transaction|origin|referrer|referer)$|^(from|to)$/i;
const QUERY_KEY = /query/i;
const MAX_DEPTH = 10;

function scrubValue(value: unknown, key: string, depth: number): unknown {
  if (typeof value === "string") {
    if (QUERY_KEY.test(key)) return "[query]";
    return URL_KEY.test(key) ? scrubUrl(value) : scrubText(value);
  }
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, key, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Local variables captured with a stack frame can hold anything; never send them.
    if (k === "vars") continue;
    out[k] = scrubValue(v, k, depth + 1);
  }
  return out;
}

function keepUserAgentOnly(headers: unknown): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (k.toLowerCase() === "user-agent" && typeof v === "string") return { "User-Agent": scrubText(v) };
  }
  return undefined;
}

/** For `beforeSend`. Mutates and returns the event; never returns null (we still want the error). */
export function scrubEvent<T extends Record<string, any>>(event: T): T {
  const e: Record<string, any> = event;

  if (e.request && typeof e.request === "object") {
    const r = e.request;
    const headers = keepUserAgentOnly(r.headers);
    const url = typeof r.url === "string" ? scrubUrl(r.url) : undefined;
    e.request = { ...(url ? { url } : {}), ...(typeof r.method === "string" ? { method: r.method } : {}), ...(headers ? { headers } : {}) };
  }

  // Only the internal user id is allowed. No email, username or IP address.
  const id = e.user && typeof e.user === "object" ? e.user.id : undefined;
  if (id !== undefined && id !== null && id !== "") e.user = { id: String(id) };
  else delete e.user;

  for (const key of ["exception", "message", "logentry", "extra", "contexts", "tags", "breadcrumbs", "transaction", "culprit", "threads"]) {
    if (e[key] !== undefined) e[key] = scrubValue(e[key], key, 0);
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.filter((b: any) => b?.category !== "console");
  } else if (e.breadcrumbs && Array.isArray(e.breadcrumbs.values)) {
    e.breadcrumbs.values = e.breadcrumbs.values.filter((b: any) => b?.category !== "console");
  }
  delete e.server_name;
  return event;
}

/** For `beforeBreadcrumb`. Returns null to drop it (console output is never sent). */
export function scrubBreadcrumb<T extends Record<string, any>>(crumb: T): T | null {
  if (crumb.category === "console") return null;
  const c: Record<string, any> = crumb;
  if (c.message !== undefined) c.message = scrubValue(c.message, "message", 0);
  if (c.data !== undefined) c.data = scrubValue(c.data, "data", 0);
  return crumb;
}
