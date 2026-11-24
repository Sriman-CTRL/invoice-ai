/**
 * Cloudflare Email Routing Worker for Invoice AI
 * 
 * Intercepts incoming emails to custom domain (e.g. billing@yourcompany.com)
 * and forwards them to Invoice AI for real-time Gemini AI intent classification
 * and autonomous ledger reconciliation.
 * 
 * Cost: 100% Free on Cloudflare Free Tier
 */

/**
 * Returns the receiving server's own Authentication-Results header (the topmost one, which our mail server adds before
 * anything else), or "" when it is missing or was not written by the expected server. A sender can put a fake
 * Authentication-Results line in their message, but it sits BELOW the real one, so only the first is read and it must
 * start with the expected server id (AUTHSERV_ID, default "mx.cloudflare.net").
 */
function topAuthenticationResults(rawEmail, expectedId) {
  const headerBlock = rawEmail.split(/\r?\n\r?\n/, 1)[0].replace(/\r?\n[ \t]+/g, " ");
  for (const line of headerBlock.split(/\r?\n/)) {
    const m = /^authentication-results:\s*(.*)$/i.exec(line);
    if (m) return m[1].trim().toLowerCase().startsWith(expectedId.toLowerCase()) ? m[1].trim() : "";
  }
  return "";
}

/** The address in the visible From header (what DMARC protects), not the envelope sender. */
function headerFromAddress(message) {
  const v = message.headers.get("from") || "";
  const m = /<?([^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+)>?\s*$/.exec(v.trim());
  return m ? m[1].toLowerCase() : "";
}

export default {
  async email(message, env, ctx) {
    try {
      const rawEmail = await new Response(message.raw).text();

      const to = message.to;
      const from = message.from;
      const subject = message.headers.get("subject") || "Invoice Response";

      // Extract basic plain text body from MIME if available
      let textBody = rawEmail;
      const textMatch = rawEmail.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:--|\r?\n\r?\nContent-Type:|$)/i);
      if (textMatch && textMatch[1]) {
        textBody = textMatch[1].trim();
      }

      const targetEndpoint = env.INVOICE_AI_URL || "https://invoice-ai-nine-beta.vercel.app/api/inbound/email";
      const webhookSecret = env.INBOUND_WEBHOOK_SECRET || "default_inbound_secret";

      const timestamp = Math.floor(Date.now() / 1000).toString();

      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-inbound-key": webhookSecret,
          "x-inbound-timestamp": timestamp,
          // Lets Paivo tell whether the From domain really sent this (used only for bank-alert suggestions).
          "x-inbound-auth": topAuthenticationResults(rawEmail, env.AUTHSERV_ID || "mx.cloudflare.net").slice(0, 2000),
        },
        body: JSON.stringify({
          to,
          from,
          header_from: headerFromAddress(message),
          subject,
          text: textBody,
          channel: "EMAIL",
        }),
      });

      if (!response.ok) {
        console.error("Invoice AI Ingestion failed:", response.status, await response.text());
      } else {
        console.log("Inbound email successfully ingested into Invoice AI ledger!");
      }
    } catch (error) {
      console.error("Cloudflare Email Worker error:", error);
    }
  },
};
