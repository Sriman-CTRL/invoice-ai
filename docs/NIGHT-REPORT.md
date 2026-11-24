# Night report (24 Nov 2026)

Branch `night-build` (20 commits ahead of `main`, all pushed). Nothing was merged to `main` and nothing touched production.
Final checks on the R3 commit: backend typecheck pass; backend tests **106 run / 106 pass / 0 skip** (local DB, restricted
role); `npm run build` pass; frontend unit tests (`npm run test:web`) 17 pass. No task was blocked.

## Your next 3 days

Details and copy-paste text are in `docs/gtm/` (read `ICP.md`, then `MESSAGES.md`). Pick ONE segment first (suggested:
freelance designers and video editors).

- **Day 1 (today):** open `docs/gtm/PLAN-14-DAYS.md`. Write down 20 people you already know who invoice clients (on paper, not in the repo).
  Read `ICP.md` and `MESSAGES.md`. Join three communities from `CHANNELS.md` and only read; check each one's self-promotion rule first.
- **Day 2:** send **message 1 (warm WhatsApp)** to 10 of those people, one by one, in English or Hinglish as you'd normally talk to them.
  If you share a link, tag it: `https://paivo.in/?utm_source=whatsapp&utm_medium=dm` (tagging only works once this branch is live).
- **Day 3:** send message 1 to the other 10 and post **message 6 (a question, no link)** in one community that allows it.
  Log each contact in `docs/gtm/outreach-tracker.csv` with no personal details.
- Merge first (steps below) so the pay page your contacts see is the new one.

## Five most important findings

1. **"Files unlock after payment" is not unique** (FileDue, FileCheckout, Sentpaid, Invoice Ninja Enterprise). What I did not find is
   the combination: UPI/bank direct to an Indian seller + UTR proof + GST invoice + unlock. Pitch the combination, never "first". (`docs/research/MARKET-2026-11.md`)
2. **Zoho Invoice is free and trusted**, and gateways confirm payments automatically. Pro at ₹799 is hard to defend against that; the existing note
   to reconsider ₹399-499 stands. Competitor prices are "reported", not verified: open their pricing pages before quoting any number.
3. **Manual confirmation is the weak spot.** Bank-alert suggestions (T9) and automatic reminders (T6) address it, but both stay unadvertised
   until you review them.
4. **Constraints:** UPI per-transaction limits differ by account type (the pay page already hints at bank transfer above ₹1 lakh);
   RBI's direction ties licensing to handling funds, which Paivo doesn't, but get a lawyer's opinion before saying "no licence needed"; DPDP main
   duties start around May 2027.
5. **Conversion lessons (`TEARDOWN.md`):** explain the payment steps plainly to the client, show a demo link on the landing page, state free-plan
   limits on pricing, and use no fake proof. U1 applied these. The Kwill domain I found was not an invoicing product, so Kwill notes are unverified.
   Open-source scouting (`OSS-INTEGRATIONS.md`): write GSTIN and amount-in-words ourselves; the IFSC package is old and heavy.

## Per task

| Task | Commit | What changed | Notes |
|---|---|---|---|
| T0 | 98aa02f | Branch, local DB, green baseline | 54/54 baseline |
| R1 | ef75adb | `docs/research/MARKET-2026-11.md` | prices unverified |
| R4 | b8e8627 | `docs/research/TEARDOWN.md` | public pages only |
| G1 | 4af6586 | `docs/gtm/` pack (ICP, channels, messages, demo, plan, content, launch checklist) | no personal data; verify community rules and sizes yourself |
| R2 | 64b8c4c | `docs/research/OSS-INTEGRATIONS.md` | no deps added |
| T1 | 7c54255 | Meta/OG/JSON-LD, crawlable fallback, robots, sitemap, og.png | |
| U1 | 528cb36 | Landing comparison + FAQs, pricing limits, pay-page reassurance and mobile UPI button | "Most popular" badge became "Recommended" (no data to back "popular") |
| G2 | 7fdb27c | utm/ref attribution, sign-ups by source in admin Growth | no schema change; admin counts now only pageviews |
| G3 | d77bcbe | Playwright script + 16 demo screenshots | pay page header clipped at 390px; "256-Bit Encrypted" and "Secure Deliverables Vault" wording predates tonight and needs an honesty review; legal page says "Escrow Charter" |
| T2 | bef4c35 | README rewrite, worker README URL, blueprint note | |
| T3 | cd45cb0 | `schema.prisma` mirrors the real DB | round trip on a fresh DB passed |
| T4 | 5c45077 | Route code-splitting; entry 632 kB to 251 kB (173 to 79 kB gzip) | |
| T5 | 33aaea0 | 17 money-path tests | **Two real bugs fixed:** repeated verify-proof double-recorded a payment; concurrent credit notes could exceed the balance. **Undecided (yours):** credit notes are ignored by the pay page and payment route; a credit note that zeroes the balance marks PAID with no payment |
| B1 | c114f67 | GSTIN check digit, IFSC format, inline errors | IFSC bank lookup not added (heavy, deprecated dependency) |
| B2 | 7044b77 | Amount in words on PDF and pay page | |
| T6 | 24a2d44 | Automatic reminders (+1/+7/+14 days), off per seller | `[soon]` labels untouched |
| T7 | 7f25d30 | Google sign-in, inert without keys | CSP additions in the queue notes; the COOP header may need relaxing |
| T8 | e63742d | `/whats-new` page and changelog | does not mention T6, T7, T9 |
| T9 | b2e8f0d | Bank-alert suggestions (suggest-only) | synthetic fixtures; not advertised |
| R3 | 8b7e0d8 | Proposals doc; Hinglish pay-page explainer behind `VITE_FEATURE_HINGLISH_PAY` | off by default; needs a native-speaker review; no second idea qualified |

Test counts: baseline 54, now 106 backend tests, 0 skipped; 17 frontend unit tests (not in CI yet).

## Before merging (exact steps)

1. **FIRST, BEFORE ANY DEPLOY: run the production database script.** `cd backend && DATABASE_URL=<owner url> APP_DB_PASSWORD=<existing app password> node scripts/enable-rls.cjs`.
   It adds `organizations.auto_reminders` (T6), `users.google_sub` (P0.1) and the `auto_reminder_claims` table (P0.2). **Do this before the new code goes live:** Prisma selects every column of a model, so once the code is deployed without `users.google_sub`, sign-in, login and every page that reads users fail until the column exists. The script is idempotent and safe to run more than once.
2. **Vercel env vars:**
   - Reminders: `RESEND_API_KEY`, `CRON_SECRET` must be set. Optional: `CRON_TIME_BUDGET_MS`, `AUTO_REMINDER_RUN_CAP`. Consider a first run with `AUTO_REMINDERS_DRY_RUN=1`.
   - Google sign-in (optional): the same OAuth web client id in `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`; add `https://paivo.in` as an authorised JavaScript origin; redeploy and test with a real account.
   - Hinglish explainer (optional): `VITE_FEATURE_HINGLISH_PAY=true` after someone fluent reviews the wording.
3. **Dependencies:** `google-auth-library` (both `package.json` files), `@playwright/test` and `@resvg/resvg-js` (dev). Check the Vercel preview build is green before merging.
4. **Labels to flip only after your review:** the `[soon]` items for automatic reminders in `src/plans.ts` and `src/LandingPage.tsx`. Prices, plans, `PAYMENTS_OPEN` and legal pages were not changed.
5. **Decide:** the two credit-note questions under T5; the pay-page "256-Bit Encrypted" / "Secure Deliverables Vault" wording and the "Escrow Charter" heading (AGENTS.md rule 7).
6. Open a PR from `night-build` into `main`, let CI run (it runs `enable-rls.cjs` then the tests as `app_user`), then merge. Search Console and sitemap steps are in `docs/gtm/LAUNCH-CHECKLIST.md` (needs your login).
