import { Router, Request, Response } from "express";
import crypto from "crypto";
import { INBOUND_WEBHOOK_SECRET } from "../lib/config";
import { processInboundEmail } from "../services/inboundService";
import { rateLimit } from "../middleware/rateLimit";
import { bareAddress, senderDomainAuthenticated } from "../lib/emailAuth";

const router = Router();

/**
 * Constant-time string comparison to prevent timing attacks on webhook secrets.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Accept a canonical JSON payload from any forwarder (Postmark/SendGrid/Resend/
// Cloudflare Email Worker) that you adapt to this shape with a tiny shim.
router.post(
  "/email",
  rateLimit({ windowMs: 60_000, max: 60, message: "Inbound rate limit exceeded", shared: true }),
  async (req: Request, res: Response): Promise<void> => {
    // Require a shared secret. If it isn't configured, inbound is disabled.
    if (!INBOUND_WEBHOOK_SECRET) {
      res.status(503).json({ error: "Inbound webhook is not configured (INBOUND_WEBHOOK_SECRET unset)" });
      return;
    }

    const key = req.headers["x-inbound-key"];
    if (typeof key !== "string" || !safeCompare(key, INBOUND_WEBHOOK_SECRET)) {
      res.status(401).json({ error: "Invalid inbound key" });
      return;
    }

    // Replay attack prevention: if timestamp header is provided, enforce a 5-minute tolerance window
    const timestamp = Number(req.headers["x-inbound-timestamp"]);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300) {
      res.status(401).json({ error: "Webhook timestamp missing, expired or outside 5-minute tolerance window" });
      return;
    }

    try {
      const payload = req.body ?? {};
      // Only a From address whose own domain passed DMARC (or SPF + DKIM) can be trusted as "the seller" for bank alerts.
      // The worker forwards the receiving server's Authentication-Results as x-inbound-auth; missing or odd = not trusted.
      const headerFrom = bareAddress(payload.header_from);
      const authHeader = typeof req.headers["x-inbound-auth"] === "string" ? (req.headers["x-inbound-auth"] as string) : undefined;
      const authenticatedSender = headerFrom && senderDomainAuthenticated(authHeader, headerFrom) ? headerFrom : undefined;
      const result = await processInboundEmail({
        to: payload.to || payload.recipient,
        from: payload.from || payload.sender,
        subject: payload.subject,
        text: payload.text || payload.textBody || payload.body,
        html: payload.html || payload.htmlBody,
        organization_id: payload.organization_id,
        invoice_number: payload.invoice_number,
        channel: payload.channel || "EMAIL",
        authenticated_sender: authenticatedSender,
      });

      res.status(200).json(result);
    } catch (error) {
      console.error("Inbound webhook processing error:", error);
      res.status(422).json({
        error: "Unable to process inbound email. Verify recipient mailbox format.",
        code: "INBOUND_PROCESS_FAILED",
      });
    }
  },
);

export default router;
