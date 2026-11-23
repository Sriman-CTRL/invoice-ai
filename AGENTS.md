# Paivo (repo: invoice-ai)

Invoicing + payment collection for Indian freelancers and small studios. Live at **https://paivo.in**.
Client pays by UPI/bank transfer **straight to the seller** (Paivo never holds money), submits the UTR,
seller confirms, and the deliverable link unlocks. An AI layer (reply intent classification → action queue)
is built but marketed as "soon".

Stack: React 19 + Vite + Tailwind + React Router (`src/`) · Express 5 + Prisma 7 + Postgres on Neon (`backend/`)
· one Vercel deployment serving the SPA and the API as a single serverless function (`api/index.js`).

Project history, decisions and roadmap: [docs/PROJECT-HISTORY.md](docs/PROJECT-HISTORY.md). Read it at the start of a new session.

## Commands

```bash
# Backend (needs backend/.env with DATABASE_URL + JWT_SECRET)
cd backend && npm install && npx prisma db push && npm run seed && npm run dev   # API :5000
cd backend && npm test          # node:test via tsx; integration tests need a LOCAL DATABASE_URL
cd backend && npm run typecheck
npm run test:web      # frontend unit tests in tests/ (UPI link, campaign tags); not run in CI yet

# Frontend (repo root)
npm install && npm run dev      # UI :5173, proxies /api to the backend
npm run build                   # esbuild backend -> api/index.js, then tsc -b, then vite build

# Database extras + row-level security (idempotent; run after db push, and on prod when schema changes)
cd backend && DATABASE_URL=<owner url> APP_DB_PASSWORD=<24+ url-safe chars> node scripts/enable-rls.cjs
```

CI (`.github/workflows/ci.yml`) runs: prisma db push → enable-rls.cjs → `npm test` as the restricted `app_user` role
→ backend typecheck. Keep it green; a red CI blocks deploys to main.

## Mandatory rules

1. **AI output never changes money state.** `invoice.status` changes only from a `SUCCEEDED` payment
   (`backend/src/routes/payment.routes.ts`, row-locked `FOR UPDATE`). Classifiers only produce intent; the
   deterministic engine in `services/collectionActionEngine.ts` creates actions. This is the core product invariant.
2. **Every DB call must run in a tenant context.** Authenticated routes get it from `authMiddleware` (`enterTenant`).
   Cross-tenant routes (login, public pay page, inbound webhook, cron, admin) must be mounted with `systemContext`
   in `backend/src/server.ts`. No context = fail closed (zero rows) once `DATABASE_URL_APP` is set.
3. **Use `prisma.$tenantTransaction(...)`, not `prisma.$transaction(async ...)`** for interactive transactions —
   the plain form drops the RLS org setting.
4. **New tables/columns go in `backend/scripts/enable-rls.cjs`** (idempotent `IF NOT EXISTS`), and tenant tables must be
   added to its `TENANT_TABLES` list. The production app role cannot run DDL, so `prisma db push` alone is not enough.
   `lib/extraSchema.ts` is only a dev fallback.
5. **Do not hand-edit or commit `api/index.js` or edit `backend/src/generated/**`.**
   `api/index.js` is build output (`npm run build`) and is git-ignored; Vercel builds it on deploy.
6. **Public links use the invoice's random UUID** (`/pay/:uuid`, `/client/:customerId/:token`), never invoice numbers
   (guessable, unique only per org).
7. **Every marketing claim must be true.** Unbuilt features carry `[soon]` in `src/plans.ts`; paid plans stay waitlist-only
   until `VITE_PAYMENTS_OPEN=true`. Don't add compliance/performance claims the code doesn't back.
8. **Never commit secrets or real credentials.** gitleaks runs in CI; a debug JWT already leaked once and was removed.
   No demo credentials on the public login page.
9. **Server computes all invoice totals** (`backend/src/lib/invoiceDetails.ts` `computeTotals`) — never trust client amounts.
   Money is `Decimal(14,2)`, default currency INR, GST modes `NONE | GST_INTRA (CGST+SGST) | GST_INTER (IGST)`.

## Conventions

- Copy is plain, honest English for non-technical Indian freelancers ("files unlock after payment", not "escrow vault").
  Dates `en-IN`, money `Intl.NumberFormat("en-IN")`.
- Frontend calls the API through `src/api.ts` with relative `/api` in production.
- New public endpoints: add a rate limit in `server.ts`, and Turnstile (`lib/turnstile.ts`) if a form is involved.
- Commit messages: short imperative summary of the user-visible change (see `git log`).

## Known pitfalls

- **Schema lives in two places, keep them in sync**: `prisma/schema.prisma` now mirrors the whole database (org settings
  columns, `invoice_details`, `invoice_views`, `recurring_invoices`, `plan_requests`, `payment_proof_images`,
  `auth_failures`, `analytics_events`, `leads`, `rate_limits`), but `enable-rls.cjs` is what applies changes in
  production (the app role has no DDL). Every new table or column must be added to **both**. Existing code still reads the
  extra tables with raw SQL (see `lib/orgSettings.ts`); regenerate the client with `npx prisma generate` after schema edits.
- **Deliverable link is stored in `invoices.external_invoice_id` with a `vault:` prefix.** Only plain http(s) URLs are
  shown (`safeDeliverableUrl` in `public-invoice.routes.ts`).
- **CORS**: allowed = `CORS_ORIGIN` env + hard-coded `paivo.in`/`www.paivo.in` + this project's Vercel preview URLs
  (`server.ts`). `paivo.in` was once missing and sign-up broke in production. Any new domain must be added. Blocked → 403.
- **Neon cold starts** take seconds; Prisma transaction timeouts are raised in `lib/prisma.ts` — don't lower them.
- **CSP in `vercel.json`** only allows self + `challenges.cloudflare.com` + the Google Identity Services endpoints (`accounts.google.com/gsi/*`). Any new third-party script/font/API
  must be added there or it silently fails in production. Fonts are self-hosted (`@fontsource`).
- **Tests can hang CI** on lingering connections — `--test-force-exit` and per-test timeouts are deliberate.
  CI sets `AUTH_RATE_LIMIT_MAX=1000`; prod default is 20/min.
- **Root `package.json` duplicates backend deps** because Vercel bundles the API from the root. Add backend
  runtime deps to both `package.json` files.
- **`DEPLOYMENT_SECURITY.md` is an aspirational blueprint**, partly written before the code (mentions AWS, Postmark,
  quiet hours, AI-Act footer). Verify against code before repeating any claim from it.
- **Inbound webhook requires `x-inbound-timestamp`** (unix seconds, ±5 min) as well as `x-inbound-key`; the Cloudflare worker sends both.
- **Public repo**: never commit audit/security notes (AUDIT.md, SECURITY-TODO.md are git-ignored).
- **One daily cron, two jobs**: `/api/cron/recurring` (`vercel.json`, 02:30 UTC) runs recurring invoices and then automatic
  overdue reminders (`services/reminderService.ts`, steps +1/+7/+14 days, off per seller until `organizations.auto_reminders`
  is switched on). Each job's failure must not stop the other. Reminder guards are shared with the manual send button.
- **Bank alerts only suggest**: a credit-alert email forwarded by one of the business's own users (inbound pipeline,
  `lib/bankAlert.ts`, `services/bankAlertService.ts`) can only create a `PAYMENT_MATCH_SUGGESTED` action; the seller settles it
  with the normal one-click confirmation. Never create a payment or change invoice status from an alert. Not advertised to users.
- **Shared rate limits** (`shared: true` in middleware/rateLimit.ts) use the `rate_limits` table, created by enable-rls.cjs.

## Environment variables

Backend: `DATABASE_URL` (owner), `DATABASE_URL_APP` (restricted `app_user`; turns RLS on), `JWT_SECRET`, `JWT_EXPIRES_IN`,
`CORS_ORIGIN`, `PUBLIC_APP_URL`, `CLASSIFIER` (`mock|gemini|ollama`), `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`,
`OLLAMA_*`, `AI_CONFIDENCE_THRESHOLD` (default 0.75 → below goes to MANUAL_REVIEW), `INBOUND_WEBHOOK_SECRET`,
`INBOUND_DOMAIN`, `RESEND_API_KEY`, `MAIL_FROM_ADDRESS` (default `reminders@paivo.in`), `REMINDER_DAILY_CAP`,
`CRON_TIME_BUDGET_MS` (default 8000), `AUTO_REMINDER_RUN_CAP` (default 200), `AUTO_REMINDERS_DRY_RUN` (`1` = log, don't send),
`GOOGLE_CLIENT_ID` (enables `POST /api/auth/google`; 503 while unset), `TURNSTILE_SECRET`, `CRON_SECRET`, `PLATFORM_ADMIN_EMAILS`, `AUTH_RATE_LIMIT_MAX`, `INTEGRATION_TESTS`.

Frontend (Vite): `VITE_API_BASE_URL`, `VITE_PAYMENTS_OPEN`, `VITE_PLATFORM_UPI_ID`, `VITE_SUPPORT_EMAIL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_GOOGLE_CLIENT_ID` (shows the Google button).

## Related documentation

- [docs/PROJECT-HISTORY.md](docs/PROJECT-HISTORY.md) — what was built, when, why; current status; roadmap
- [docs/FIRST-10-USERS.md](docs/FIRST-10-USERS.md) — customer-interview plan (current priority)
- [docs/COMPETITOR-KWILL.md](docs/COMPETITOR-KWILL.md) — competitor teardown and ranked feature list
- `backend/docs/` — AI intent classification, overdue engine, collection actions, n8n integration
- `cloudflare-worker/README.md` — inbound email routing setup
