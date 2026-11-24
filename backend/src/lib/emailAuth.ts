/**
 * Reads the Authentication-Results header (RFC 8601) that the receiving mail server adds, to tell whether the visible
 * "From" address of an inbound email was really sent by that domain. Used to decide whether a forwarded bank alert may
 * even create a payment suggestion. It never proves the alert is true; the seller still checks the bank.
 *
 * The Cloudflare worker forwards the header as `x-inbound-auth` (see cloudflare-worker/email-router.js). Fail closed:
 * anything missing, odd or unaligned counts as "not authenticated".
 */

interface MethodResult {
  method: string;
  result: string;
  props: Record<string, string>;
}

function parseResults(header: string): MethodResult[] {
  const parts = header.replace(/\r?\n[ \t]+/g, " ").split(";").map((p) => p.trim()).filter(Boolean);
  // parts[0] is the server id (authserv-id); the rest are "method=result (comment) prop.name=value ...".
  const out: MethodResult[] = [];
  for (const part of parts.slice(1)) {
    const cleaned = part.replace(/\([^)]*\)/g, " ");
    const m = /^([a-z0-9-]+)\s*=\s*([a-z]+)\b(.*)$/i.exec(cleaned.trim());
    if (!m) continue;
    const props: Record<string, string> = {};
    for (const p of m[3].matchAll(/([a-z0-9]+\.[a-z0-9-]+)\s*=\s*("[^"]*"|\S+)/gi)) {
      props[p[1].toLowerCase()] = p[2].replace(/^"|"$/g, "").toLowerCase();
    }
    out.push({ method: m[1].toLowerCase(), result: m[2].toLowerCase(), props });
  }
  return out;
}

const domainOf = (addrOrDomain: string): string => addrOrDomain.replace(/^.*@/, "").replace(/^<|>$/g, "").trim().toLowerCase();

/**
 * True when the header shows the From address's own domain passed authentication:
 *  - `dmarc=pass` for that From domain, or
 *  - `spf=pass` AND `dkim=pass`, both for that same domain.
 */
export function senderDomainAuthenticated(authResults: string | undefined | null, fromAddress: string | undefined | null): boolean {
  if (typeof authResults !== "string" || !authResults || authResults.length > 4000) return false;
  const fromDomain = domainOf(String(fromAddress || ""));
  if (!fromDomain || !fromDomain.includes(".")) return false;

  const results = parseResults(authResults);
  const dmarc = results.find((r) => r.method === "dmarc" && r.result === "pass" && r.props["header.from"] === fromDomain);
  if (dmarc) return true;

  const spf = results.some((r) => r.method === "spf" && r.result === "pass" && domainOf(r.props["smtp.mailfrom"] || r.props["smtp.helo"] || "") === fromDomain);
  const dkim = results.some((r) => r.method === "dkim" && r.result === "pass" && domainOf(r.props["header.d"] || "") === fromDomain);
  return spf && dkim;
}

/** The bare address from a "Name <a@b.com>" style value, lower-cased, or null. */
export function bareAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /<?([^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+)>?\s*$/.exec(value.trim());
  return m ? m[1].toLowerCase() : null;
}
