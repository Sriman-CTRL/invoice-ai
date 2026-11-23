# Paivo

Invoicing and payment collection for freelancers, studios and small businesses in India. Live at **https://paivo.in**.

The core loop: a seller adds their UPI/bank details, creates an invoice (line items, GST, optional link to the final
files) and shares a payment page. The client pays by UPI or bank transfer **straight to the seller** (Paivo never holds the
money), submits the transaction reference (UTR), the seller checks their bank and confirms, and the deliverable link unlocks
for the client.

## Features

**Live**
- Sign-up and login, settings (UPI ID, bank details, GSTIN, logo and brand colour)
- Invoices with line items, GST (none / CGST+SGST / IGST), discount and payment terms; PDF download with a UPI QR
- Public payment page per invoice: UPI QR, bank details, UTR and optional screenshot proof
- Files link unlocks on full payment; one-click confirmation; partial payments; credit notes
- Email reminders sent by hand (with unsubscribe link, replies go to the seller) and WhatsApp reminders
- Recurring invoices (created as drafts for approval), client portal, CSV import
- Cash-flow forecast, analytics, GST report, activity feed and notification bell
- Customer data export and erasure, account deletion, platform-admin plan approvals and growth page

**Coming soon (built or partly built, not offered to users yet)**
- AI reading of client replies (inbound email, intent classification, action queue)
- Automatic scheduled reminders
- A billing email address per seller

Paid plans are on a waitlist until the automation they promise works. Product history and roadmap:
[docs/PROJECT-HISTORY.md](docs/PROJECT-HISTORY.md).

## Stack

React 19 + Vite + Tailwind + React Router (`src/`) · Express 5 + Prisma 7 + PostgreSQL on Neon (`backend/`) · one Vercel
deployment serving the SPA and the API as a single serverless function (`api/index.js`, built from `backend/` and git-ignored).

## Local setup

You need Node.js and a PostgreSQL database (a local Docker one is fine).

```bash
# Backend (needs backend/.env with DATABASE_URL and JWT_SECRET; see backend/.env.example)
cd backend && npm install && npx prisma db push && npm run seed && npm run dev   # API on :5000

# Frontend (repo root)
npm install && npm run dev        # UI on :5173, proxies /api to the backend
npm run build                     # bundles the API, type-checks, builds the UI

# Extra tables/columns and row-level security (idempotent; run after db push)
cd backend && DATABASE_URL=<owner url> APP_DB_PASSWORD=<24+ url-safe chars> node scripts/enable-rls.cjs
```

Set `DATABASE_URL_APP` to the restricted `app_user` role to turn row-level security on. Never use a production database
for local work.

## Tests and CI

```bash
cd backend && npm test            # node:test via tsx; integration tests need a LOCAL DATABASE_URL
cd backend && npm run typecheck
npm run test:web                  # small frontend unit tests (UPI link, campaign tags)
```

CI (`.github/workflows/ci.yml`) runs `prisma db push`, `enable-rls.cjs`, the backend tests as the restricted `app_user`
role, and the backend typecheck. gitleaks, Semgrep and a dependency audit also run on the repository.

## Environment variables

Examples live in [`.env.example`](.env.example) (frontend) and [`backend/.env.example`](backend/.env.example). The full list
with explanations is in [AGENTS.md](AGENTS.md#environment-variables). Never commit real values.

## Inbound email

Client replies reach `POST /api/inbound/email` (for example from the Cloudflare Email Worker in
[`cloudflare-worker/`](cloudflare-worker/README.md)). Every request needs two headers:

- `x-inbound-key`: the shared secret (`INBOUND_WEBHOOK_SECRET`); the endpoint returns 503 if it is not configured
- `x-inbound-timestamp`: unix seconds, accepted within 5 minutes of the server clock

The JSON body takes `to` (or `recipient`), `from` (or `sender`), `subject`, `text` (or `textBody`/`body`), optional `html`,
`organization_id`, `invoice_number` and `channel`. Replies are classified by the configured classifier
(`CLASSIFIER=mock|gemini|ollama`) and become suggested actions in the Action Queue; they never change an invoice's status.

## Documentation

- [AGENTS.md](AGENTS.md): rules, conventions and known pitfalls for working in this repo
- [docs/PROJECT-HISTORY.md](docs/PROJECT-HISTORY.md): what was built and why; status and roadmap
- [docs/FIRST-10-USERS.md](docs/FIRST-10-USERS.md): customer-interview plan
- [docs/COMPETITOR-KWILL.md](docs/COMPETITOR-KWILL.md): competitor notes
- `backend/docs/`: AI intent classification, overdue engine, collection actions, n8n integration
- [DEPLOYMENT_SECURITY.md](DEPLOYMENT_SECURITY.md): a target security blueprint (not everything in it is implemented)
