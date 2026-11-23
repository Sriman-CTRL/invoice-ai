import prisma from "./prisma";

/**
 * Lazily-created extras (analytics events, payment screenshots). The restricted app role cannot run DDL,
 * so in production these are created by scripts/enable-rls.cjs; this only helps local/dev databases
 * and is a harmless no-op (warning) when permission is denied.
 */
let ready: Promise<void> | null = null;
export function ensureExtraSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        event VARCHAR(40) NOT NULL,
        path VARCHAR(200) NOT NULL,
        referrer VARCHAR(100),
        visitor VARCHAR(40)
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS analytics_events_at ON analytics_events (at)`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS payment_proof_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        payment_id UUID NOT NULL,
        mime VARCHAR(20) NOT NULL,
        data TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS payment_proof_images_payment ON payment_proof_images (payment_id)`);
    })().catch((e) => {
      console.warn("ensureExtraSchema: skipped DDL:", (e as Error).message);
    });
  }
  return ready;
}

/** Decode and validate a screenshot data URL. Only PNG/JPEG/WebP, verified by magic bytes, max ~400 KB. */
export function parseScreenshot(input: unknown): { mime: string; base64: string } | { error: string } | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string") return { error: "Invalid screenshot." };
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if (!m) return { error: "Screenshot must be a PNG, JPEG or WebP image." };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > 400 * 1024) return { error: "Screenshot is too large. Please use an image under 400 KB." };
  const isPng = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const expected = m[1] === "image/png" ? isPng : m[1] === "image/jpeg" ? isJpeg : isWebp;
  if (!expected) return { error: "That file doesn't look like a valid image." };
  return { mime: m[1], base64: m[2] };
}
