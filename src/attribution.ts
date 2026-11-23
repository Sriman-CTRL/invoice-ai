/**
 * First-touch campaign attribution. Reads utm_source, utm_medium, utm_campaign and ref from the landing URL on the
 * first visit and keeps them in localStorage, so sign-up can say which link brought someone here.
 * First-party only; holds campaign tags, nothing personal. Respects Do Not Track / Global Privacy Control.
 */
export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
}

const KEY = "paivo_attr";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "ref"] as const;

/** Lowercase, keep a-z 0-9 _ . - only, max 40 characters. */
export function cleanTag(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
  return v || undefined;
}

export function parseAttribution(search: string): Attribution | null {
  let params: URLSearchParams;
  try { params = new URLSearchParams(search); } catch { return null; }
  const out: Attribution = {};
  for (const f of FIELDS) {
    const v = cleanTag(params.get(f));
    if (v) out[f] = v;
  }
  return Object.keys(out).length ? out : null;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadAttribution(storage: StorageLike | null = safeStorage()): Attribution | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Attribution = {};
    for (const f of FIELDS) {
      const v = cleanTag(data[f]);
      if (v) out[f] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Stores the attribution from this URL only if nothing is stored yet (first touch wins). Returns what is stored. */
export function captureAttribution(search: string, storage: StorageLike | null = safeStorage()): Attribution | null {
  if (!storage) return null;
  const existing = loadAttribution(storage);
  if (existing) return existing;
  const fresh = parseAttribution(search);
  if (!fresh) return null;
  try { storage.setItem(KEY, JSON.stringify(fresh)); } catch { /* storage unavailable */ }
  return fresh;
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
