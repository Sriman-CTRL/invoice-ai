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
