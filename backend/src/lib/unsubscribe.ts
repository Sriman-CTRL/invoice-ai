import crypto from "crypto";
import { JWT_SECRET } from "./config";

// Signed, unguessable unsubscribe links: only someone holding a link we emailed
// can opt that address out of that business's messages.
export function unsubscribeToken(orgId: string, email: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(`unsub:${orgId}:${email.toLowerCase()}`).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(orgId: string, email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(orgId, email));
  const given = Buffer.from(String(token || ""));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function unsubscribeUrl(baseUrl: string, orgId: string, email: string): string {
  const q = new URLSearchParams({ o: orgId, e: email.toLowerCase(), t: unsubscribeToken(orgId, email) });
  return `${baseUrl}/api/unsubscribe?${q.toString()}`;
}
