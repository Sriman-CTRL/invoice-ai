/**
 * Campaign attribution (utm_source, utm_medium, utm_campaign, ref) sent by the frontend. Tags are sanitised the same
 * way as src/attribution.ts and stored as one short string "source|medium|campaign|ref" in analytics_events.path,
 * so no schema change is needed. Nothing personal is stored.
 */
export function cleanTag(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
}

/** Returns "source|medium|campaign|ref" or null when no usable tag was sent. */
export function encodeAttribution(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const a = input as Record<string, unknown>;
  const parts = [cleanTag(a.utm_source), cleanTag(a.utm_medium), cleanTag(a.utm_campaign), cleanTag(a.ref)];
  return parts.some(Boolean) ? parts.join("|") : null;
}
