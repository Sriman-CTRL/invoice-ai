# Zero-Cost Cloudflare Email Routing for Invoice AI

Route custom domain emails (e.g. `billing@youragency.com`) directly into Invoice AI for **$0/month** using Cloudflare's free Email Routing & Workers.

---

### Why Use Cloudflare Email Routing?
- **$0 Cost**: Avoid paying \$7–\$14/user/month for Google Workspace or Microsoft 365.
- **Instant Autonomous Parsing**: Client replies (*"We will pay on Friday"* or *"We dispute item 2"*) are instantly classified by Gemini AI.
- **Zero Server Setup**: Fully serverless on Cloudflare's global edge network.

---

### 3-Minute Setup Guide

#### Step 1: Add your Domain to Cloudflare
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) (Free plan).
2. Add your domain and update your domain nameservers as instructed by Cloudflare.

#### Step 2: Create the Email Worker
1. Go to **Workers & Pages** -> **Create Application** -> **Create Worker**.
2. Name it `invoice-ai-email-router`.
3. Click **Quick Edit**, paste the code from `cloudflare-worker/email-router.js`, and click **Deploy**.
4. In Worker **Settings** -> **Variables**, add:
   - `INVOICE_AI_URL`: `https://paivo.in/api/inbound/email`
   - `INBOUND_WEBHOOK_SECRET`: (Your secret from your `.env` / Vercel environment variables)

#### Step 3: Enable Email Routing
1. In your domain dashboard on Cloudflare, click **Email Routing**.
2. Enable Email Routing (Cloudflare will automatically configure the MX, SPF, and DKIM DNS records).
3. Under **Routing Rules**, click **Create rule**:
   - Custom address: `billing@youragency.com` (or catch-all `*@youragency.com`)
   - Action: **Send to a Worker**
   - Destination Worker: Select `invoice-ai-email-router`
4. Click **Save**.

---

### Testing Your Setup
Send an email from your personal address to `billing@youragency.com` with:
- **Subject**: `Re: Invoice INV-1042 reminder`
- **Body**: `Hi! We had a temporary issue, but we have scheduled the payment for this Friday.`

Check your **Invoice AI Dashboard** -> **Conversations**:
- You will see the message ingested in real-time.
- Gemini 2.5 Flash will automatically classify it as `PAYMENT_PROMISED` with high confidence.
- Autonomous collection chasing will automatically halt until Friday.

---

### Bank-alert emails and sender checks

If a seller forwards a bank "amount credited" alert to their Paivo address, Paivo can suggest which invoice it might
settle. Because anyone can fake a From line, **a suggestion is only created when the email's From domain passed email
authentication.** The worker helps like this:

- It copies the **first** `Authentication-Results` header (the one your own receiving server adds on top, which a
  sender cannot put above) into the `x-inbound-auth` header, and only when it starts with the expected server id.
  The default id is `mx.cloudflare.net`; set the Worker variable `AUTHSERV_ID` if your header shows a different one.
- It sends the address from the visible `From:` header as `header_from` (the address DMARC protects).
- Paivo accepts the sender only when that header says `dmarc=pass` for the same domain, or `spf=pass` and `dkim=pass`
  both for that domain. Otherwise the email is handled like any normal message and no suggestion is made.

Fail-closed: if the header is missing or looks different from what is expected, bank-alert suggestions simply never appear.
After deploying, send a test alert from your own mailbox and check that the Worker log shows an `Authentication-Results`
value; if suggestions never appear, compare that value with the rules above. Every suggestion also tells the seller:
"Check your bank app or statement before confirming. Emails can be faked."
