import { OAuth2Client } from "google-auth-library";

/**
 * Google sign-in: verifies a Google Identity Services ID token. Inert until GOOGLE_CLIENT_ID is set.
 * The verifier is injectable so tests never call Google.
 */
export interface GoogleIdentity {
  email: string;
  email_verified: boolean;
  name?: string;
  aud: string;
  iss?: string;
  sub?: string;
}

export type GoogleVerifier = (idToken: string, audience: string) => Promise<GoogleIdentity>;

export const googleClientId = (): string => (process.env.GOOGLE_CLIENT_ID || "").trim();

let client: OAuth2Client | null = null;
const realVerifier: GoogleVerifier = async (idToken, audience) => {
  client ??= new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken, audience });
  const p = ticket.getPayload();
  if (!p || !p.email) throw new Error("No email in Google token");
  return { email: p.email, email_verified: p.email_verified === true, name: p.name, aud: String(p.aud), iss: p.iss, sub: p.sub };
};

let verifier: GoogleVerifier = realVerifier;
export function setGoogleVerifier(fn: GoogleVerifier | null): void {
  verifier = fn ?? realVerifier;
}

const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/**
 * Verifies the token and applies our own checks on top of the library's: audience must be our client id, issuer must be
 * Google and the email must be verified. Throws a short message safe to log; callers answer 401.
 */
export async function verifyGoogleToken(idToken: unknown): Promise<GoogleIdentity & { email: string }> {
  const audience = googleClientId();
  if (!audience) throw new Error("not_configured");
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 4096) throw new Error("bad_token");
  let identity: GoogleIdentity;
  try {
    identity = await verifier(idToken, audience);
  } catch {
    throw new Error("bad_token");
  }
  if (identity.aud !== audience) throw new Error("wrong_audience");
  if (identity.iss && !ISSUERS.includes(identity.iss)) throw new Error("bad_issuer");
  if (identity.email_verified !== true) throw new Error("email_not_verified");
  return { ...identity, email: identity.email.trim().toLowerCase() };
}
