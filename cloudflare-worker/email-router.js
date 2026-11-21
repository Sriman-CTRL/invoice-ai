/**
 * Cloudflare Email Routing Worker for Invoice AI
 * 
 * Intercepts incoming emails to custom domain (e.g. billing@yourcompany.com)
 * and forwards them to Invoice AI for real-time Gemini AI intent classification
 * and autonomous ledger reconciliation.
 * 
 * Cost: 100% Free on Cloudflare Free Tier
 */

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
        },
        body: JSON.stringify({
          to,
          from,
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
