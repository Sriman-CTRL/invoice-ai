# Paivo: project history, decisions and roadmap

Read this at the start of a new Claude Code session (after `/clear` or on a new machine). It records what was built,
why, and what comes next. Update the "Status" and "Next" sections whenever a piece of work lands.

Last updated: 24 Nov 2026.

## 1. What Paivo is

- **Product:** "Get paid for your work. Every time, without chasing." Invoicing for freelancers, studios and small
  businesses in India.
- **Core loop:** seller adds UPI/bank details → creates an invoice (line items, GST, optional link to the final files) →
  shares `/pay/<uuid>` → client pays by UPI QR / NEFT directly to the seller → client submits UTR (+ optional screenshot)
  → seller checks the bank and confirms → invoice is paid and the files link unlocks for the client.
- **Positioning vs competitors (Kwill, Zoho, Refrens):** UPI with zero gateway fee; files unlock only after payment;
  GSTIN/CGST/SGST/IGST and TDS (194C/194J) built for India.
- **Owner/GitHub:** Sriman-CTRL. Domain `paivo.in` (earlier `invoice-ai-nine-beta.vercel.app`). Hosting Vercel,
  DB Neon (project `curly-butterfly-99508217`), email via Resend, bot checks via Cloudflare Turnstile.

## 2. Timeline (from git history)

| Date | What happened |
|---|---|
| 30 Sep 2026 | Initial commit as "Invoice AI": an AI accounts-receivable workspace (classify customer replies → deterministic collection actions). |
| 1 Oct | Backend server and auth. |
| 21 Nov | Security hardening, compliance engine (opt-out detection, card-number redaction, 3-day reminder cooldown, credit notes), UI modernisation. Vercel + Neon deployment as one project; Gemini classifier; CSV bulk import; overdue scanner, reminder and record-payment modals; **public pay page with UPI QR, UTR submission, deliverable "vault", WhatsApp actions, TDS calculator**. |
| 22 Nov | Deliverable unlock + one-click proof settlement; DPDP/GDPR privacy policy and terms; Cloudflare Email Worker for inbound replies at no cost. |
| 23 Nov (morning) | Split the monolithic `pages.tsx` into `src/pages/*`; client-side branded PDF with UPI QR; cash-flow forecast; toasts, Cmd+K palette. |
| 23 Nov | **Growth pivot:** landing + pricing pages, per-org UPI/bank settings, onboarding checklist, free-plan gate (5 invoices/month), plan upgrades paid by UPI and approved in `/admin`. |
| 23 Nov | Security round: unguessable UUID pay links, partial-payment settlement, proof validation, DB-backed login lockout, strict CORS, CSP headers; tenant-isolation integration tests; gitleaks, Semgrep, dependency audit, Dependabot; removed a leaked debug JWT; **Postgres row-level security** with restricted `app_user` role. |
| 23 Nov | First-party analytics + admin Growth page, payment screenshots, Turnstile; change-password with strength policy. |
| 23 Nov | **Honesty pass:** removed unverifiable compliance/performance claims, removed demo credentials from login, paid plans closed (waitlist) until automation exists, feedback inbox, wrote `docs/FIRST-10-USERS.md`. |
| 23 Nov | **Renamed to Paivo.** Real email reminders via Resend (Reply-To = seller). Self-hosted fonts, 18+/terms consent at signup, unsubscribe link + `List-Unsubscribe`. |
| 23 Nov | Line items, GST and discount, payment terms, AI line-item drafting, branding (logo + colour), client activity feed + notification bell. Recurring invoices (created as drafts, daily cron at 02:30 UTC), analytics and GST report, client portal, "how did you hear about us" at signup. |
| 23 Nov (evening) | CI stability (timeouts, force-exit, failing-test annotations, configurable auth rate limit). Fixed CORS refusing `paivo.in`. Bell: payment-reference events open the Action Queue for settlement. |
| 23 Nov (night) | `e5e6e56` **Security hardening from pre-launch audit**: shared database rate limiting, admin-email sign-up block, org-scoped recurring-invoice edits, account deletion, pinned dependency versions, required inbound-webhook timestamp, `security.txt`, removed stale RLS SQL, build bundle (`api/index.js`) no longer committed. `382f5dc` privacy/security contact moved to `paivo.in`. |
| 24 Nov | Pinned dependency versions: root `package.json` uses caret ranges matching the lockfile instead of `latest`. |
| 24 Nov | Fixed shared rate limiting under the restricted DB role: `rate_limits` is now created by `enable-rls.cjs` (the app role cannot run DDL), the runtime CREATE is tried once per process, and the in-memory fallback logs one warning. Corrected `AGENTS.md` (api/index.js is git-ignored, inbound timestamp, public-repo rule). |
| 24 Nov (night build) | T0: `night-build` branch, local DB set up, green baseline recorded (54/54 integration tests, build OK). |
| 24 Nov (night build) | R1: market research in `docs/research/MARKET-2026-11.md`. |
| 24 Nov (night build) | R4: competitor teardown in `docs/research/TEARDOWN.md`. |
| 24 Nov (night build) | G1: go-to-market pack in `docs/gtm/` (ICP, channels, messages, demo, 14-day plan, content, launch checklist). |
| 24 Nov (night build) | R2: open-source scouting in `docs/research/OSS-INTEGRATIONS.md`. |
| 24 Nov (night build) | T1: SEO tags, link preview image (`og.png`), crawlable fallback, robots.txt and sitemap. |
| 24 Nov (night build) | U1: conversion changes from the teardown (landing, pricing, pay page). |
| 24 Nov (night build) | G2: first-party campaign attribution (utm_*, ref) and sign-ups by source in admin Growth. |
| 24 Nov (night build) | G3: demo screenshots (`scripts/screenshots.mjs`, 16 PNGs in `docs/gtm/assets/`). |
| 24 Nov (night build) | T2: README rewritten for visitors; docs fixes. |
| 24 Nov (night build) | T3: `schema.prisma` now mirrors the real database. |
| 24 Nov (night build) | T4: route code-splitting; first download cut from 632 kB to 251 kB (173 to 79 kB gzip). |
| 24 Nov (night build) | T5: money-path tests (17 new) and two real bugs fixed. |
| 24 Nov (night build) | B1: GSTIN check-digit validation, clearer IFSC errors, inline errors in Settings. |
| 24 Nov (night build) | B2: amount in words (Indian numbering) on the PDF and the pay page. |
| 24 Nov (night build) | T6: automatic overdue reminders (built, off by default; [soon] labels untouched). |
| 24 Nov (night build) | T7: Google sign-in (inert until GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID are set). |
| 24 Nov (night build) | T8: /whats-new page and changelog. |
| 24 Nov (night build) | T9: bank-alert payment suggestions (suggest-only, not advertised). |
| 24 Nov (night build) | R3: proposals doc; Hinglish pay-page explainer built behind `VITE_FEATURE_HINGLISH_PAY` (off by default). |
| 24 Nov (night build) | T10: night report in `docs/NIGHT-REPORT.md`. |
| 24 Nov (night build, phase 2) | P0: review fixes: Google sign-in links on Google's account id (`users.google_sub`), automatic reminders claim each step before sending (`auto_reminder_claims`), bank-alert suggestions need a DMARC-passing sender, pay page and PDF use the balance after credit notes, honest pay-page and legal wording. |
| 24 Nov (night build, phase 2) | P1: market research verified against vendors' own pages; pay-to-unlock and late-payment evidence updated in `docs/research/MARKET-2026-11.md`. |
| 24 Nov (night build, phase 2) | P2: free tools (GST calculator, TDS calculator, payment reminder writer) at `/tools/*`, no login, all in the browser. |
| 24 Nov (night build, phase 2) | P3: five static guides in `public/guides/` (invoicing, TDS, UPI limits, late-payment follow-up, getting paid before sending files) with sitemap and footer link. |
| 24 Nov (night build, phase 2) | P4: end-to-end test of the core money flow (`npm run e2e`, local only, not in CI). |
| 24 Nov (night build, phase 2) | P5: Hindi (हिन्दी) switch on the client pay page; labels only, needs native review. |
| 24 Nov (night build, phase 2) | P6: whole-night review; fixed unsourced claims and UPI-for-non-INR bug. P7: night report updated with phase 2 and review. |
| 24 Nov | `feat/sentry` (PR open, not deployed): privacy-first error reporting (Sentry, errors only) for the web app and the API, with scrubbers, admin test buttons and a privacy-page section. Inert until `SENTRY_DSN` / `VITE_SENTRY_DSN` are set; needs the real ingest host in `vercel.json` first. |
| 24 Nov | `feat/logo` (PR open, not deployed): Paivo logo kit in `brand/` (open-loop P, closed "paid" state) and wired into the site: favicon set + manifest, new link-preview image, header/footer/sidebar/auth/legal/portal logos, "Powered by Paivo" on the pay page and invoice PDF, one-time open→closed animation next to the paid state. |
| 25 Nov | `chore/release-script`: `release.ps1` at the repo root, run by the owner (Windows PowerShell 5.1). Builds `origin/main` in a temp worktree, optional `-Migrate` (owner URL, `enable-rls.cjs`), deploys with `--skip-domain`, probes, asks before promoting, live-checks paivo.in and rolls back on failure. `-DryRun` prints every vercel/database command. Claude Code no longer needs Vercel access. |

## 3. Key decisions (and why)

1. **AI is advisory only.** It classifies intent; a deterministic engine picks actions; only real payments change
   invoice status. Wrong AI output must never move money state.
2. **No payment gateway.** Clients pay the seller directly by UPI/NEFT, so Paivo never holds funds (no RBI payment-aggregator
   licensing) and takes no fee. Cost: confirmation is manual (UTR matching).
3. **Files unlock after payment.** Paivo stores only a link (not files) and controls when it is shown.
4. **Zero-cost infrastructure.** Vercel + Neon free tiers, Cloudflare Email Routing for inbound mail, client-side PDF
   generation, self-hosted fonts.
5. **Defence in depth on tenancy.** App-level JWT scoping *and* Postgres RLS, so a code bug can't leak another org's data.
6. **Truthful marketing.** Every claim on the site must be backed by working code; unbuilt features are labelled "soon",
   and paid plans are closed until the automation they promise works.
7. **Schema extras outside Prisma.** New columns/tables are added additively in `backend/scripts/enable-rls.cjs` so the
   core Prisma schema stays untouched and the restricted DB role never needs DDL.

## 4. Status (24 Nov 2026)

**Live and working:** sign-up/login, settings (UPI, bank, GSTIN, branding), invoices with line items/GST/discount/terms,
pay page with UPI QR + bank details + UTR/screenshot proof, files unlock on full payment, one-click confirmation,
partial payments, credit notes, PDF invoices, email reminders (manual send) + WhatsApp, recurring invoices (draft
approval), client portal, CSV import, cash-flow forecast, analytics, GST report, activity feed + bell, data
export/erasure, account deletion, admin plan approvals, analytics/growth page.

**Added in the night builds (on branch `night-build`, merge pending):** free tools at `/tools/*`, five guides at `/guides/`, Hindi switch on the pay page, Google sign-in (inert until keys), What's new page, credit-note-aware balances.

**Error reporting (Sentry), code complete on `feat/sentry`, off until DSNs are set:** errors only, scrubbed of emails, UPI IDs, UTRs, IFSC, account numbers, GSTINs, tokens and URL ids before sending. Owner must create the Sentry projects, put the ingest origin in `vercel.json` `connect-src`, fill the data region on the privacy page, and add the env vars in Vercel (see the PR).

**Brand (`feat/logo`, PR open):** the primary logo is the wordmark "paivo" whose p is the open-loop mark (a symbol beside the wordmark read as "Ppaivo"); the standalone P mark (bowl open until the money arrives, closed once paid) is for icons, the pay-page credit and the paid animation. Source of truth is `brand/build_kit.py` (SVG masters, icons, link preview, `brand/GUIDELINES.md`); the site uses `src/Brand.tsx` (inline SVG, path data copied from the generator) and static copies in `public/` (favicon set, `site.webmanifest`, `og.png`, `brand/`). Still open: trademark search (classes 9, 36, 42), print colour values.

**Built but not offered to users yet ("soon"):** reading client replies with AI (inbound email → classify → action
queue), automatic scheduled reminders, per-seller billing email address.

**Releases:** the owner runs `.elease.ps1` (add `-Migrate` when `enable-rls.cjs` changed). Claude Code never runs `vercel` and never touches the production database.

**Business stage:** product works; the current priority is **talking to the first 10 users** (see
`docs/FIRST-10-USERS.md`) before building much more.

## 5. Next (candidate roadmap)

Ranked from `docs/COMPETITOR-KWILL.md`, minus what's done. Let the interviews decide.

1. Automatic overdue reminders (scheduled sending with cooldown, suppression and opt-out checks already in place).
2. Turn on AI reply reading for real users (inbound address per org, Action Queue).
3. Auto-confirm payments (bank alert emails or a gateway such as Razorpay) — "did the money arrive?" may be the real pain.
4. Google sign-in; "What's new" changelog; locked-feature previews once paid plans open.
5. Quotes that turn into invoices; lead/enquiry form; custom domain per seller (paid tier).
6. Reconsider Pro price (₹399–499) until automation works; add yearly pricing.
7. Housekeeping: add pre-rendered/meta tags so Google and link previews can read the landing page (meta tags and a static fallback are done in the night build; real pre-rendering is not).

**Not building for now:** e-signed contracts, CRM/pipeline, projects/time tracking, team seats, per-client chat.
