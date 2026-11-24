# Night report (24 Nov 2026)

Branch `night-build` (36 commits ahead of `main`, all pushed; phase 1 first, phase 2 below). Nothing was merged to `main` and nothing touched production.
Final checks after phase 2: backend typecheck pass; backend tests **121 run / 121 pass / 0 skip** (local DB, restricted
role); `npm run build` pass; frontend unit tests (`npm run test:web`) **31 pass**; end-to-end tests (`npm run e2e`, local only) **3 pass**. No task was blocked.

## Your next 3 days

Details and copy-paste text are in `docs/gtm/` (read `ICP.md`, then `MESSAGES.md`). Pick ONE segment first (suggested:
freelance designers and video editors).

- **Day 1 (today):** open `docs/gtm/PLAN-14-DAYS.md`. Write down 20 people you already know who invoice clients (on paper, not in the repo).
  Read `ICP.md` and `MESSAGES.md`. Join three communities from `CHANNELS.md` and only read; check each one's self-promotion rule first.
- **Day 2:** send **message 1 (warm WhatsApp)** to 10 of those people, one by one, in English or Hinglish as you'd normally talk to them.
  If you share a link, tag it: `https://paivo.in/?utm_source=whatsapp&utm_medium=dm` (tagging only works once this branch is live).
- **Day 3:** send message 1 to the other 10 and post **message 6 (a question, no link)** in one community that allows it.
  Log each contact in `docs/gtm/outreach-tracker.csv` with no personal details.
- Merge first (steps below) so the pay page your contacts see is the new one. **Do step 1 below (the production database script) BEFORE the deploy.**
- **Updated after phase 2:** once it is live, you now have three free tools and five guides to share instead of only asking for interviews.
  On day 2 or 3, post one in a community that allows links, tagged for counting: `https://paivo.in/tools/payment-reminder-writer?utm_source=<community>&utm_medium=post` (the reminder writer is the easiest to share) and
  `https://paivo.in/guides/how-to-follow-up-on-late-payments.html`. Open Google Search Console once and submit the sitemap (it now lists the tools and the guides).
  Still send the one-to-one messages first: people who say yes to a conversation tell you more than page views do.

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
4. **Labels to flip only after your review:** the `[soon]` items for automatic reminders in `src/plans.ts` and `src/LandingPage.tsx`. Prices, plans and `PAYMENTS_OPEN` were not changed. **The privacy and terms pages WERE edited in P0.6, only to remove claims the code cannot back (see phase 2 below); have them read by you or a lawyer.**
5. **Decide:** whether a credit note that zeroes a balance should keep marking the invoice PAID (kept as is; the screens now say "Settled by credit note"); whether the old GST rate list on the invoice form (5, 12, 18, 28) should become 0, 5, 18, 40 (not changed); and have a native speaker check the Hindi pay page (and the Hinglish one). The earlier wording questions are fixed (P0.6).
6. Open a PR from `night-build` into `main`, let CI run (it runs `enable-rls.cjs` then the tests as `app_user`), then merge. Search Console and sitemap steps are in `docs/gtm/LAUNCH-CHECKLIST.md` (needs your login).

---

# Phase 2 (`docs/NIGHT-QUEUE-2.md`)

All tasks are `[x]`. Each runs the full check before its commit: backend typecheck, backend tests as the restricted role with integration tests really running (no skips), root build. Counts after phase 2: **121 backend tests, 31 web unit tests, 3 end-to-end tests**.

| Task | Commit | What it did | Check before you rely on it |
|---|---|---|---|
| P0.1 | 0a2abc8 | Google sign-in now matches on Google's account id (`users.google_sub`), never on email alone; existing password accounts get `LINK_REQUIRED`; new "Connect Google" in Settings | production: run `enable-rls.cjs` first |
| P0.2 | c39053d | Automatic reminders claim each step in `auto_reminder_claims` (unique per invoice and step) before sending, so overlapping runs or a failed write cannot double-send | new table, created by `enable-rls.cjs` |
| P0.3 | 91c6a23 | Bank-alert suggestions need a sender whose domain passed DMARC (or SPF + DKIM); the Cloudflare worker forwards the header; every suggestion says "Emails can be faked" | **redeploy the worker** and send one real test alert: I could not test against real Cloudflare, so until the header looks as expected, suggestions simply never appear |
| P0.4 | f808bd1 | AGENTS.md pitfall and step 1 above: run `enable-rls.cjs` on production before deploying | |
| P0.5 | b9166ad | Pay page, UPI QR/link, PDF, client portal and money routes use "amount minus payments minus credit notes"; credit-settled invoices say "Settled by credit note" | |
| P0.6 / 6b | 3cebcef / dd3a26b | Removed "256-Bit Encrypted", "Secure Deliverables Vault", "Escrow Charter", "held in escrow", AES-256/TLS 1.3, quiet hours and similar claims everywhere; a test blocks them returning. 6b fixed two tests (see below) | **legal pages edited: have them reviewed** |
| P1 | 9cbe083 | Market research re-done from vendors' own pages (24 Nov 2026), pay-to-unlock check widened, late-payment evidence | Kwill: no vendor page found; Cashfree pricing blocked; Vyapar pricing empty; Instamojo/myBillBook pages contradict themselves (written as found) |
| P2 | ff11499 | Free tools at `/tools/gst-invoice-calculator`, `/tools/tds-calculator`, `/tools/payment-reminder-writer` | **TDS: no rates are shown** (see below) |
| P3 | 6510176 | Five static guides plus an index in `public/guides/`; sitemap and footer link | **no GST threshold, UPI limit or TDS rate is printed** (see below) |
| P4 | 7d50a88 | `npm run e2e`: register → UPI ID → invoice with files link → client sees it locked → UTR → seller confirms → files unlock; ran 3 of 3 | local only, not in CI |
| P5 | 472270c | English / हिन्दी switch on the client pay page (labels only; amounts, names and the UPI link never change) | **Hindi needs a native speaker's review** |
| P6 | 78d4d80 / 366afe8 | The review below | |

## What I could not verify (so it is not on the site)

Official pages were read through a fetch tool; several refused it (HTTP 403, DNS failure, empty JavaScript shells) on 24 Nov 2026.

- **GST slabs: verified** from the GST Council's own 56th-meeting press release (standard 18%, merit 5%, special 40%, effective 22 Sep 2025; the 57th meeting of Oct 2026 listed only clarifications). The GST calculator uses 0, 5, 18, 40 plus an "other rate" box.
- **Not verified, so left out:** the GST registration limit, every TDS rate and threshold (194C / 194J for FY 2026-27, and whether the Income-tax Act 2025 renumbered them), and every UPI limit. The TDS calculator makes the person type the rate and explains why; the guides say "check here" and link the official site. When you can open incometax.gov.in, gst.gov.in and npci.org.in in a browser, add the figures with a source and a "last checked" date (`tests/guides.test.ts` currently fails if a lakh/crore figure appears in a guide; remove that assertion when you add them).

## Phase 2 review (every `[night]` commit)

Checked as a strict reviewer: tenant isolation, AGENTS.md rule 1, injection, CSP, secrets, honest copy, links, accessibility basics.

**Passed with no change**
- *Rule 1 (AI/alerts never change money state):* the only code that writes `invoices.status` is payment, one-click proof settlement, credit notes (balance reaches zero) and draft approval. Reminders, bank-alert matching and Google sign-in never write it; tests assert it for alerts.
- *Tenant isolation:* every new query is scoped (`organization_id` filter, or the tenant context from the auth middleware). The cross-tenant ones are on purpose and on system-context routes: Google link uniqueness (`runAsSystem`), the cron's organisation list, and the public pay page. Found and fixed during P0: a lazy Prisma promise escaped `runAsSystem`; the helper now awaits inside the callback.
- *Injection / XSS:* no `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in `src/` or `public/`; new pages render text through React; the guides are static HTML with no scripts or inline styles, so the CSP in `vercel.json` needs no change (only the `guides/` path was excluded from the SPA rewrite).
- *Secrets:* no keys, tokens or non-local database URLs in any added line; no `.env` tracked (only `.env.example`). Test passwords are throwaway fixtures.
- *Links:* every in-app link points to a real route; every sitemap URL exists.
- *Personal data:* no names, emails or phone numbers in `docs/gtm` or `docs/research`.
- *Accessibility basics:* tools and pay-page controls have labels, visible focus, `aria-pressed` on the language switch, a `lang` attribute that follows the language; guides are a single column with visible focus outlines. I did not run a contrast checker or a screen reader, so do that once on the pay page and the guides.

**Fixed in P6**
1. *Unsourced UPI claim:* the landing FAQ and the pay page said "most UPI apps allow up to about ₹1 lakh per payment". Now: "UPI apps and banks set a limit on each payment…", no figure (P6a, P0.6/P5).
2. *Unsourced behaviour claims:* "Most late payments are forgetfulness" (GTM messages) and similar wording in two guides; "one business can never see another's records" softened (P6a).
3. *A real bug: UPI for non-rupee invoices.* The UPI link always says `cu=INR`, but the pay page and PDF offered the QR for any currency, so a USD 500 invoice would have asked for ₹500. UPI is now INR-only on the pay page and PDF, with a clear message and a test (P6b).
4. *Resilience:* the manual reminder button now keeps working if production has not created `auto_reminder_claims` yet (P6b).
5. *Test hygiene (found while running the gate):* the P0.6 commit was made with one local-only test failing (the admin "sources" report shows only the top 20 and was crowded out by leftovers from earlier local runs) and a timing-sensitive assertion in the new race test. Both fixed in P0.6b; two full runs in a row were green. I should have stopped the chain on that failure; later steps gate on the result.

**Left for you (not changed on purpose)**
- Invoice form GST list (5, 12, 18, 28): 12% and 28% are no longer slabs after 22 Sep 2025 (changing it changes what sellers can put on invoices).
- Credit notes that zero a balance still mark the invoice PAID (screens now say so honestly).
- Landing FAQ says TDS is recorded "under Section 194C or 194J": confirm the section names for FY 2026-27 when you can read the official chart.
- Legal pages still say "Invoice AI" in many places (old product name); the privacy page still lists Google Gemini processing and a DPDP section that need a proper legal pass before the DPDP duties start (about May 2027).
- Cloudflare worker: confirm the `Authentication-Results` header format with a real test email (P0.3).
- Windows only: after `npm run e2e` the backend process may stay running on port 5000; stop it.

## What to do before merging, in order

1. **Run `enable-rls.cjs` on production first** (adds `users.google_sub`, `organizations.auto_reminders`, table `auto_reminder_claims`). Then deploy. (Details in the first list above.)
2. Env vars as listed above; phase 2 adds none. Google sign-in stays inert until you set the keys.
3. Redeploy the Cloudflare worker (`cloudflare-worker/email-router.js`) and send one test email to see whether bank-alert suggestions can appear.
4. Read the terms and privacy pages once; get the Hindi checked; decide the "Left for you" items.
5. PR `night-build` → `main`, let CI pass (it runs `enable-rls.cjs`, then tests as `app_user`), merge, then submit the sitemap in Search Console.
