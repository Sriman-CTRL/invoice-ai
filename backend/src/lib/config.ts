import "dotenv/config";

// Central runtime configuration. Fails closed on missing secrets in
// non-test environments so the app never silently runs insecure.
function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV !== "test") {
    throw new Error(`${name} must be set. See backend/.env.example`);
  }
  return value || "";
}

export const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "test_secret_do_not_use" : requireSecret("JWT_SECRET"));
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const INBOUND_DOMAIN = process.env.INBOUND_DOMAIN || "in.ar.ledgerlane.local";
export const INBOUND_WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET || "";
export const AI_CONFIDENCE_THRESHOLD = Number(process.env.AI_CONFIDENCE_THRESHOLD ?? "0.75");
