# Night build queue

An unattended work queue for Claude Code. Work through the tasks **in order**, one at a time, without stopping to ask
questions. This file is the source of truth for progress: after a long session or a context compaction, re-read it and
continue from the first task that is not `[x]` or `[!]`.

Status marks: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason written under the task).

---

## Ground rules (apply to every task)

1. **Branch only.** All work happens on branch `night-build`. Never commit to, merge into, or push `main`.
   Push with `git push origin night-build` only.
2. **Never touch production.** Do not run the Vercel CLI or Neon CLI, do not open or use any production connection
   string, do not run `enable-rls.cjs` or `prisma db push` against anything except the local Docker database
   (`localhost:5433`). Never print secrets or `.env` values into the chat, logs or files.
3. **Database guard.** Before any command that touches a database, confirm `DATABASE_URL` in `backend/.env` points to
   `localhost` or `127.0.0.1`. If it doesn't, STOP the whole run and report.
4. **Definition of done for every task:** `cd backend && npm run typecheck` passes, `cd backend && npm test` passes
   against the local DB **as the restricted role** (same env as CI: `DATABASE_URL` owner, `DATABASE_URL_APP` app_user,
   `JWT_SECRET`, `AUTH_RATE_LIMIT_MAX=1000`), and `npm run build` at the repo root passes. Integration tests must run, not
   skip. Record the pass/skip counts in the task's notes.
5. **One commit per task**, message `[night] Tn: <summary>`, then push the branch. Then mark the task `[x]` in this file,
   add a row to the timeline in `docs/PROJECT-HISTORY.md`, and commit those two doc edits with the task (same commit).
6. **If a task fails** after 3 serious attempts: `git stash push -u -m "night Tn failed"`, mark it `[!]` with the reason
   and the stash name, and move on to the next task. Never use `git reset --hard`, `git checkout -- .` or `git clean`.
7. **Follow AGENTS.md** (all mandatory rules). In particular: AI never changes invoice status; every DB call in a tenant
   context; new columns/tables go in `backend/scripts/enable-rls.cjs` *and* `schema.prisma` (once T3 is done); new
   tenant tables go in `TENANT_TABLES`; no new marketing claims; unbuilt features keep `[soon]`.
8. **Do not** change prices, plan contents, `PAYMENTS_OPEN`, legal pages or any `[soon]` label. Do not add a dependency
   unless the task names it.
9. **Keep going.** Do not stop between tasks to summarise or ask. Only stop when every task is `[x]` or `[!]`
   (then do T10), or rule 3 triggers. Nobody is watching: if a command is denied, do not retry it; find another
   safe way or mark the step blocked and continue.
10. **Order:** follow the file from top to bottom: T0, R1, R4, G1, R2, T1, U1, G2, G3, T2, T3, T4, T5, B1, B2, T6, T7,
    T8, T9, R3, T10. If time is short, the go-to-market and research tasks (R1, R4, G1) matter most.
11. **Research hygiene:** paraphrase sources, cite URLs, never copy code from repos with unknown or copyleft licences,
    never paste competitor text or design.

---

## [x] T0. Setup

1. `git fetch origin`, then `git switch -c night-build origin/main` (or `git switch night-build` if it exists).
   Never switch to `main` during the run.
2. Add `.claude/settings.local.json` and `night-logs/` to `.gitignore` if missing.
3. Start the local DB if it isn't running:
   `docker run -d --name paivo-pg -e POSTGRES_USER=invoice_admin -e POSTGRES_PASSWORD=invoice_dev_password -e POSTGRES_DB=invoice_ai -p 5433:5432 postgres:16-alpine`
   (if the container exists, `docker start paivo-pg`).
4. Apply rule 3. Then in `backend/`: `npx prisma db push`, then
   `APP_DB_PASSWORD=local_throwaway_password_123456 node scripts/enable-rls.cjs`.
   Local app URL: `postgresql://app_user:local_throwaway_password_123456@localhost:5433/invoice_ai`.
5. Run the full definition of done on the untouched branch and record the baseline (pass/fail/skip counts).
   If baseline tests fail, fix only what is needed for a green baseline, as its own commit `[night] T0: ...`.

**Notes (T0):** branch `night-build` from origin/main; `.gitignore` updated; local DB `paivo-pg` on :5433 (guard OK).
Baseline on untouched branch: typecheck pass; backend tests **54 run / 54 pass / 0 skip / 0 fail** when the env from
`backend/.env` is exported into the shell (`set -a; . ./.env; set +a; AUTH_RATE_LIMIT_MAX=1000`); without exporting, the
integration tests silently skip (they read `process.env` before dotenv loads). Root `npm run build` passes (one >500 kB
chunk warning, handled by T4). Local re-runs within a few minutes hit stored rate limits (429), so before each test run:
`truncate rate_limits, auth_failures` on the local DB.

## [x] R1. Market research: what is genuinely unique about Paivo

Use WebSearch/WebFetch. Paraphrase; never copy competitor text, code or design. Cite every claim with a URL.
Spend at most ~75 minutes, then write up what you have.

1. Competitors serving Indian freelancers/small studios: Refrens, Zoho Invoice, Vyapar, myBillBook, Kwill, Bonsai,
   Razorpay Payment Links/Invoices, Cashfree Payment Links, Instamojo, and any newer ones you find (search 2026).
   For each: who it targets, price in INR, UPI support and fees, GST/TDS support, reminders (manual/auto), client
   portal, "deliverable locked until paid" or similar, AI features.
2. Check whether "files unlock only after payment" exists elsewhere (freelancer tools, Gumroad-style pay-to-unlock,
   escrow platforms). Be honest if it is not unique.
3. Facts that constrain the product (cite official sources: NPCI, RBI, GST portal, MeitY): UPI per-transaction
   limits for P2P/P2M, NPCI rules affecting UPI collect requests or QR, whether a tool that never touches funds needs
   payment-aggregator licensing, GST e-invoicing thresholds, DPDP Act rules status in 2026.
4. Write `docs/research/MARKET-2026-11.md`: comparison table, what is truly differentiated, what is table stakes,
   threats, pricing benchmarks, and **10 ranked differentiator ideas** (each: user pain, evidence, effort S/M/L,
   needs an API key or not).

**Notes (R1):** about 8 searches; snippets were thin, so competitor prices are marked unverified in the doc. Doc-only task, tests unchanged from T0 baseline.

## [x] R4. Competitor teardown ("reverse engineering" the public products)

Goal: learn *why* competitors convert visitors and get paid faster, then apply the lessons to Paivo in our own words,
code and design. Spend at most ~75 minutes.

**Allowed:** reading competitors' public pages (home, pricing, features, help centre, public docs, changelogs, public
invoice/payment-link demo pages), their public `robots.txt`, `sitemap.xml`, page titles/meta tags/structured data,
and observing public page behaviour. A handful of fetches per site; respect `robots.txt`.
**Not allowed:** logging in, creating accounts, bypassing paywalls or rate limits, automated bulk scraping,
decompiling apps, using leaked code, copying any text, code, images, icons or visual design.

1. Pick the 5–6 closest competitors from R1 (include Kwill, Refrens, Zoho Invoice and at least one payment-link product
   such as Razorpay Payment Links). For each, record:
   - landing structure: hero promise, proof/trust elements, CTA wording and placement, objection handling, FAQ topics;
   - pricing page tactics: free tier limits, anchor plan, annual discount, what is gated;
   - client-side experience on a public invoice/payment page if one is publicly visible: steps to pay, payment
     methods shown, trust cues, mobile layout;
   - onboarding promises (time-to-first-invoice), integrations advertised;
   - SEO basics: title, meta description, OG tags, structured data, sitemap size, blog/guides topics they rank for.
2. Compare with Paivo's current landing (`src/LandingPage.tsx`), pricing (`src/PricingPage.tsx`), pay page
   (`src/PublicPayPage.tsx`) and signup/onboarding (`src/pages/AuthPage.tsx`, `OnboardingChecklist.tsx`).
3. Write `docs/research/TEARDOWN.md`: per-competitor notes (paraphrased, with URLs), then **"Patterns to adopt"**
   (each: what, why it works, evidence, how Paivo would do it honestly, effort) and **"Patterns to avoid"**
   (dark patterns, fake urgency, unverifiable claims).

**Notes (R4):** Zoho, Refrens, Razorpay read from public pages (head tags via one plain curl each). The Kwill domain reachable (kwill.app) is not an invoicing product; flagged in the doc as unverified. Pay page already has a UPI deep link. Doc-only, tests unchanged.

## [x] G1. Go-to-market pack: who to contact, where, and exactly what to send

Goal: everything the owner needs to find and talk to the first 10–30 users, ready to copy-paste. Build on
`docs/FIRST-10-USERS.md` (don't repeat it; extend and update it with fresh research). Use WebSearch/WebFetch and
cite sources. Write in plain, friendly English for Indian freelancers.

**Privacy and anti-spam rules:** do **not** collect, store or list personal data of private individuals (no names,
phone numbers, emails or profile URLs of people). Produce *how-to-find* instructions, search queries and public
communities instead. Messages must be personal, one-to-one, honest about who is writing, and never mass-sent;
cold email templates must say who the sender is and offer an easy opt-out. No fake testimonials, user counts or claims.

Create `docs/gtm/` with:

1. `ICP.md`: 2–3 target segments ranked (e.g. freelance designers, developers, video editors/motion artists, small
   design/dev studios, tutors/consultants who deliver files). For each: their payment pain, how they invoice today,
   where they hang out, what would make them switch, red flags. Cite data on India's freelancer market where possible.
2. `CHANNELS.md`: a verified list of **public** places to find them: subreddits, Discord/Telegram/WhatsApp
   communities with public join pages, LinkedIn/Instagram/X hashtags, Behance/Dribbble/Contra/Upwork India
   discovery methods, college and alumni networks, co-working spaces and meetups (India-wide, note big-city ones),
   freelancer newsletters and podcasts. For each: link, reported size (say where the number comes from), whether
   self-promotion is allowed (quote the rule's gist in your own words), recent-activity check, and how to engage.
   Include ready-to-use **search queries** (LinkedIn, Instagram, X, Google) for finding freelancers who recently posted
   about late payments or clients not paying.
3. `MESSAGES.md`: copy-paste templates with `{slots}`, each with a one-line "when to use" and "don't":
   - warm WhatsApp message to a friend + warm intro request;
   - cold LinkedIn DM, Instagram DM, X DM (short, references something specific they made);
   - community **question** post (no link) and 3 helpful reply templates; how to move to DM politely;
   - cold email (with sender identity + opt-out line);
   - follow-ups (day 3, day 7, final), "thanks, no worries" close;
   - interview booking message and a 15-minute interview script (past behaviour questions, no pitching until the end);
   - after-interview "try it on one real invoice" message, offer to set it up together;
   - feedback ask after first invoice; referral ask; reply to "how much does it cost?";
   - objection replies: "I already use Zoho/Refrens", "my clients pay fine", "locking files feels rude to clients",
     "is my money safe?", "why not Razorpay links?".
   Give each core message in **English** and **Hinglish** (Roman-script Hindi-English mix). Keep DMs under 60 words.
4. `DEMO.md`: how to show Paivo: a 30-second pitch, a 2-minute live demo flow (create invoice → share link → client
   pay page with locked files → UTR → confirm → unlock) using the demo pay page path in `src/marketing.tsx`,
   a screen-recording shot list for a 45-second video, and what to say at each step.
5. `PLAN-14-DAYS.md`: a day-by-day plan with daily targets (messages sent, posts, conversations), what to measure,
   and the decision rule at day 14. `outreach-tracker.csv`: header row only (date, channel, segment, source link,
   message template used, replied?, interview?, tried product?, notes). No personal data rows.
6. `CONTENT.md`: 10 honest post drafts for LinkedIn/X/Instagram (problem stories, build-in-public updates, "how to
   get paid on time" tips for freelancers, a carousel outline). No invented stories presented as real; mark any
   example as an example.
7. `LAUNCH-CHECKLIST.md`: Google Search Console + Bing Webmaster setup and sitemap submission, Google Business Profile
   (if applicable), directories worth listing on (Product Hunt, Indie Hackers, BetaList, Indian startup directories),
   with links and what each requires. Mark anything needing the owner's login/keys.

**Notes (G1):** Community sizes are only what third-party listings reported; most pages could not be opened, so CHANNELS.md says to verify rules/activity first. No personal data stored. G2 will make the UTM tags in MESSAGES.md live. Doc-only, tests unchanged.

## [x] R2. Open-source and API scouting: what can be integrated

Spend at most ~60 minutes. Only consider MIT / Apache-2.0 / BSD / ISC licensed code. Record licence, stars, last
release/commit date and weekly npm downloads for each candidate.

1. Look for maintained libraries/datasets/APIs for: GSTIN format + checksum validation; IFSC validation and bank/branch
   lookup (e.g. razorpay/ifsc); Indian amount-in-words (lakh/crore); UPI deep-link/QR (`upi://pay`) parameters per the
   NPCI spec; Indian bank credit-alert email/SMS parsing; transactional email templates (e.g. react-email);
   PDF invoice generation; Hindi/Indian-language i18n for the client pay page; anything else that serves "get paid
   without chasing" for Indian freelancers.
2. Write `docs/research/OSS-INTEGRATIONS.md`: table of candidates, fit for Paivo, effort, risks, and a
   recommendation (integrate now / later / no). List every API key or account any recommendation would need.
3. Do not add dependencies in this task; B1/B2/R3 use the findings.

**Notes (R2):** Licence/date/downloads from the public npm registry; stars only for razorpay/ifsc. Recommendation: write GSTIN and amount-in-words ourselves, IFSC regex plus the ifsc package only if small. Doc-only, no deps added.

## [x] T1. SEO, link previews and og:image

Problem: paivo.in is a client-rendered SPA; crawlers and WhatsApp/LinkedIn previews see only the `<title>`.

1. `index.html` `<head>`: meta description, canonical `https://paivo.in/`, Open Graph (`og:type` website,
   `og:site_name` Paivo, `og:title`, `og:description`, `og:url`, `og:image` https://paivo.in/og.png with width 1200 and
   height 630, `og:locale` en_IN) and Twitter card `summary_large_image`. Copy comes from `src/LandingPage.tsx`;
   no claims the code doesn't back.
2. JSON-LD `<script type="application/ld+json">` SoftwareApplication (name, BusinessApplication, Web, offers Starter ₹0
   and Pro ₹799/month INR from `src/plans.ts`). No executable inline script (CSP).
3. Static crawlable fallback inside `<div id="root">`: `<h1>` hero headline, hero paragraph, the three feature titles +
   one line each, the 3 steps, plain links to /pricing, /register, /privacy, /terms. Inline style on a wrapper:
   background `#070a13`, light text, so it doesn't flash white. Confirm `src/main.tsx` uses `createRoot`.
4. `public/robots.txt` (allow all; disallow /dashboard, /invoices, /customers, /conversations, /collection-actions,
   /settings, /analytics, /admin, /playground, /pay/, /client/; `Sitemap: https://paivo.in/sitemap.xml`) and
   `public/sitemap.xml` (/, /pricing, /privacy, /terms).
5. `public/og.png` 1200×630: write `scripts/make-og.mjs` that renders an SVG (dark `#070a13` background, indigo→violet
   accent, "Paivo" wordmark, the hero headline, "UPI invoices · files unlock after payment") to PNG using the dev
   dependency `@resvg/resvg-js`. Use only system/self-hosted fonts available locally; if text can't render, draw the
   wordmark as shapes or use plain sans-serif. Commit the script and the PNG. Keep the PNG under 300 KB.
6. Check `vercel.json`: files in `/public` must be served before the SPA rewrite (Vercel checks the filesystem
   first; confirm with docs or by reasoning, and if unsure exclude `robots.txt`, `sitemap.xml`, `og.png` and
   `.well-known/` from the catch-all rewrite). Do not loosen any header.
7. `npm run build`; confirm `dist/index.html` has the tags + fallback, and `dist/robots.txt`, `dist/sitemap.xml`,
   `dist/og.png` exist.

**Notes (T1):** Added meta/OG/Twitter/JSON-LD and a static fallback inside #root (createRoot replaces it on load). robots.txt and sitemap.xml in public/; scripts/make-og.mjs renders public/og.png (45 KB) with devDependency @resvg/resvg-js. vercel.json: catch-all rewrite now excludes robots.txt, sitemap.xml, og.png and .well-known/ (no header changed; Vercel serves files before rewrites anyway). dist has all tags and files. DoD: typecheck pass; tests 54 run/54 pass/0 skip; build pass.

## [x] U1. Conversion improvements from the teardown

Apply the best 4–6 "Patterns to adopt" from `docs/research/TEARDOWN.md` to the landing page, pricing page, signup and
the client pay page, in Paivo's own words and existing visual style.

1. Honesty first: no testimonials, logos, user counts, ratings or "trusted by" claims unless real data exists
   (it doesn't). Allowed: clear how-it-works, honest comparisons ("no gateway fee"), FAQs, security explanations that
   match the code, a visible demo link, reassurance on the client pay page (who is being paid, that money goes straight
   to the seller, what UTR is, what happens next).
2. Mobile first for the pay page (most clients open it from WhatsApp): check tap targets, the QR/UPI button order,
   copy-UPI-ID button, and a "Pay with UPI app" deep link (`upi://pay?...`) shown on mobile only, built from existing
   invoice data per NPCI parameter names (pa, pn, am, cu=INR, tn). Never change amounts client-side.
3. Keep everything typed and tested; add/adjust tests where logic changes (e.g. UPI link builder unit test).
4. Record before/after notes per change in the task notes.

**Notes (U1):** Changes (before -> after): (1) hero: added a plain 'no per-payment fee' line; (2) landing: new side-by-side 'Paivo vs a typical payment link' table (general, names no company) and 3 FAQs (payment link, 'I paid' dispute, sharing UPI ID); (3) final CTA: added 'see what your client sees' demo link; (4) pricing: states the free plan limits in the intro and the 'Most popular' badge on Pro became 'Recommended' because there are no usage numbers to back 'popular' (prices and plan contents untouched); (5) pay page: new 'You are paying X / money goes straight to them / what a UTR is / what happens next' block above the payment tabs; (6) pay page mobile: 'Pay with UPI app' button now first and mobile-only (sm:hidden), 48px tap target, plus a UPI ID row with a 44px copy button; QR stays below. UPI link builder moved to src/upi.ts and unit-tested (npm run test:web, 3 tests; not in CI). Amounts still come from the server's outstanding amount. No testimonials, counts or ratings added. DoD: typecheck pass; backend tests 54/54, 0 skip; build pass.

## [x] G2. Measure where users come from

1. Capture `utm_source`, `utm_medium`, `utm_campaign` and `ref` from the landing URL on first visit (first-party
   only, no cookies beyond what exists; store in `localStorage` with try/catch) and send them with the existing
   first-party analytics events and with sign-up.
2. Show sign-ups by source in the admin Growth page (`src/pages/AdminGrowthPage.tsx`) alongside the existing
   "how did you hear about us" answers.
3. Add to `docs/gtm/MESSAGES.md` how to tag links per channel (e.g. `https://paivo.in/?utm_source=linkedin&utm_medium=dm`).
4. Respect existing consent and privacy pages; update the privacy page text only if it would otherwise be inaccurate.
5. Tests for the parsing and storage helpers.

**Notes (G2):** src/attribution.ts stores first-touch utm_source/medium/campaign/ref in localStorage (try/catch, skipped under Do Not Track/GPC because capture happens after that check); analytics.ts sends one 'attribution' event per tab session; register sends the tags; backend sanitises them (lib/attribution.ts) and stores 'source|medium|campaign|ref' in analytics_events.path under events 'attribution' and 'signup_attr', so NO schema change and nothing to run on production. Admin Growth shows visits and sign-ups per campaign link plus the existing 'how did you hear' answers. Also fixed existing admin queries to count only event='pageview' (previously consent/source events inflated page views and top pages). MESSAGES.md already documents tagged links. Privacy page does not describe analytics storage at all and no personal data is added, so no text change. Tests: tests/attribution.test.ts (4), backend attribution unit tests (3), extended ANALYTICS integration test. DoD: typecheck pass; backend 57 run/57 pass/0 skip; build pass; test:web 7 pass.

## [x] G3. Screenshots and demo assets

1. Install Playwright as a dev dependency (`@playwright/test`) and Chromium (`npx playwright install chromium`).
2. Seed the local DB with clearly fictional demo data (a fictional studio, fictional clients; never real people).
   Start backend + frontend locally.
3. Write `scripts/screenshots.mjs` that captures, at desktop (1440×900) and mobile (390×844): landing, pricing,
   sign-up, dashboard, invoice create, invoice detail, client pay page (files locked), pay page after confirmation
   (files unlocked), PDF preview if reachable. Save to `docs/gtm/assets/` as PNG (each under 500 KB).
4. Reference the images in `docs/gtm/DEMO.md` and `docs/gtm/CONTENT.md` where they fit.
5. If Playwright can't be installed, mark `[!]` with the reason and continue.

**Notes (G3):** Playwright (@playwright/test, dev dependency) + Chromium. The script refuses non-local URLs, seeds a fictional 'Sample Studio (demo)' with a fictional client via the API (register, settings, customer, 3 invoices, a UTR proof and the real one-click confirmation), then captures landing, pricing, sign-up, pay page locked and unlocked, dashboard, invoices, invoice detail and the create-invoice modal at 1440x900 and 390x844. All under 150 KB. PDF preview NOT captured (it is a client-side download, not a page). Observations for the owner: on the 390px pay page the header text 'Sample Studio (demo)' is clipped at the top, and the pay page footer/header carry '256-Bit Encrypted' and 'Secure Deliverables Vault' wording that predates this run and may need an honesty review under AGENTS.md rule 7. DoD: typecheck pass; backend 57/57, 0 skip; build pass.

## [ ] T2. README and doc fixes

1. Rewrite `README.md` for a visitor: intro (Paivo, paivo.in, who it's for, core loop), Features split Live /
   Coming soon (must match `docs/PROJECT-HISTORY.md` section 4), Stack, Local setup (commands from AGENTS.md incl.
   `enable-rls.cjs`), Tests and CI, env vars (point to `.env.example` files and AGENTS.md), inbound email contract
   (verify against `backend/src/routes/inbound.routes.ts`, including `x-inbound-key` and `x-inbound-timestamp`),
   links to `docs/`. Remove the old "Key fixes" and "Real vs simulated" sections, all `ledgerlane` naming and any
   credentials.
2. `cloudflare-worker/README.md`: replace `invoice-ai-nine-beta.vercel.app` with `https://paivo.in/api/inbound/email`.
3. Top of `DEPLOYMENT_SECURITY.md`, add a blockquote: "Note: this is a target security blueprint, partly written
   before the code. Not every control listed here is implemented. Check the code and tests before relying on or
   repeating any claim in this file." Change nothing else there.
4. Remove "rewrite README" from PROJECT-HISTORY section 5 Housekeeping.

## [ ] T3. Make `schema.prisma` match the real database

1. Copy the current `schema.prisma`. Against the local DB (already set up by T0), run `npx prisma db pull`.
2. Keep every existing model, field name, relation name, map and index unchanged. Accept only additions: the extra
   `organizations` columns (`upi_id`, `payee_name`, `bank_*`, `gstin`, `plan`, `brand_color`, `logo_data`, any
   others) and the extra tables (`invoice_details`, `invoice_views`, `recurring_invoices`, `plan_requests`,
   `payment_proof_images`, `auth_failures`, `analytics_events`, `leads`, `rate_limits`, any others). Revert every
   other change `db pull` made.
3. Do not rewrite existing raw-SQL code to use the new models in this task.
4. `npx prisma generate`, then the definition of done.
5. Round trip: drop and recreate the local DB, run only `npx prisma db push`, then `enable-rls.cjs`; it must succeed.
   Then re-run the tests.
6. AGENTS.md: rewrite the "Schema lives in two places" pitfall: schema.prisma now mirrors the database, but
   `enable-rls.cjs` is what applies changes in production, so every new table/column must be added to both.
   Remove the schema item from PROJECT-HISTORY section 5.

## [ ] T4. Smaller first load (route code-splitting)

The build warns about chunks over 500 kB. Landing and `/pay/:id` (the client-facing page) must load fast on phones.

1. Record current `dist/assets` JS sizes (raw and gzip) in the notes.
2. In `src/App.tsx`, load every authenticated page, `/admin*`, `/playground` and the legal pages with `React.lazy`
   + a `Suspense` fallback that matches the dark theme. Keep `LandingPage`, `PricingPage`, `AuthPage` and
   `PublicPayPage` eager only if that keeps their chunk small; otherwise lazy too.
3. Make heavy libraries load only where used: `jspdf` and `qrcode` only when generating a PDF/QR (dynamic `import()`),
   not in the landing chunk.
4. Record new sizes. Goal: no chunk over 500 kB and the landing route's JS under 200 kB gzip. If the goal isn't reached,
   note what remains and why.
5. Click-through check: `npm run dev` with the backend running against the local DB, seed (`npm run seed` in
   backend), then verify by HTTP that `/`, `/pricing`, `/login` return 200 and that the built `dist` has no runtime
   import errors (`npx vite preview` and fetch the routes). Note what was checked.

## [ ] T5. Tests for the money paths

Integration tests (local DB, restricted role, follow the pattern in `backend/src/__tests__/tenant-isolation.test.ts`).
Read the routes first; test current behaviour. If a test exposes a real bug, fix it in the same task and describe it
in the notes.

1. `payment.routes.ts`: only `SUCCEEDED` changes invoice status; partial payment → `PARTIALLY_PAID`; full → `PAID`;
   overpayment rejected; two concurrent payments that together exceed the balance cannot both succeed; another
   org's invoice → 404.
2. Public pay page (`public-invoice.routes.ts`): non-UUID and DRAFT invoices → 404; deliverable URL hidden until fully
   paid and only http(s) URLs ever returned; `submit-proof` validates UTR format and screenshot type/size
   (use `parseScreenshot` cases), and never changes invoice status by itself.
3. Settlement from the Action Queue (`collection-action.routes.ts` `verify-proof`): settles only for the owning org;
   double settlement is idempotent (no double payment).
4. Credit notes: cannot exceed the open balance; another org's invoice rejected.
5. `invoiceDetails.computeTotals`: GST intra/inter split, discount clamp, rounding (unit tests).

## [ ] B1. Validate GSTIN and IFSC properly (from R2 findings)

1. GSTIN: format + checksum validation (pure function, unit-tested with valid/invalid samples). Use a vetted
   permissively-licensed package from R2 if one is good; otherwise write it (algorithm is public). Apply in the
   settings API (`lib/orgSettings.ts`) and show a clear inline error in Settings.
2. IFSC: format validation (4 letters, `0`, 6 alphanumerics) everywhere bank details are saved. If R2 found an offline,
   permissively licensed IFSC dataset/package of reasonable size, show the bank + branch name under the field after
   validation (server-side lookup, no new third-party calls from the browser, no CSP change). Otherwise format only.
3. Tests for both. No behaviour change for already-saved valid data.

## [ ] B2. Amount in words on invoices

Indian numbering (lakh/crore), e.g. "Rupees Forty-Five Thousand Only", with paise when present. Pure function with
unit tests (0, 1, 99.50, 1,00,000, 1,23,45,678.90, 99,99,99,999). Show it on the PDF invoice (`src/invoicePdf.ts`) under
the total and on the pay page. Use an R2-vetted package only if clearly better than ~40 lines of tested code.

## [ ] T6. Automatic overdue reminders (off by default)

Today reminders are sent by hand (`POST /api/invoices/:id/send-reminder`). Build scheduled ones that each seller must
switch on. Keep the pricing/landing `[soon]` labels unchanged; the owner flips them after review.

1. **Setting:** `organizations.auto_reminders BOOLEAN NOT NULL DEFAULT false` (enable-rls.cjs + schema.prisma), exposed
   through the existing settings API/`lib/orgSettings.ts` and a toggle in `src/pages/SettingsPage.tsx` with this
   honest copy: "Email your clients automatically 1, 7 and 14 days after an invoice's due date. Each email has the
   payment link and an unsubscribe link. Replies go to your email." Disable the toggle with an explanation when
   email sending is off or no UPI/bank details exist.
2. **Shared service:** move the guard + send logic out of the manual route into `backend/src/services/reminderService.ts`
   (suppression check, `processing_restricted`, payment details present, status not PAID/CANCELLED/DISPUTED, no
   pending `ESCALATE_DISPUTE`, 24 h per-invoice cooldown, per-org `REMINDER_DAILY_CAP`, unsubscribe URL, Reply-To).
   The manual route must behave exactly as before (existing tests + a new one for it).
3. **Schedule:** steps at due +1, +7, +14 days (constant in the service). For each org with `auto_reminders`, each
   OPEN/PARTIALLY_PAID invoice whose due date is past a step not yet sent: send at most one step per invoice per run
   (the highest due step only, never a burst of three). Idempotency via `collection_actions` `PAYMENT_REMINDER` with
   `metadata {auto: true, step: n, delivered: true}`; never send the same step twice.
4. **Content:** short, polite template per step (gentle → firmer, never threatening), with outstanding amount
   (`en-IN` INR), invoice number, due date, pay link, seller name. No AI-generated text.
5. **Trigger:** call it from the existing daily cron handler (`cronRouter` `/recurring` in `recurring.routes.ts`) after
   recurring invoices, so `vercel.json` keeps one cron. Each job's failure must not stop the other; response reports
   both. Respect a time budget (`CRON_TIME_BUDGET_MS`, default 8000) and a per-run cap (`AUTO_REMINDER_RUN_CAP`, default
   200); the rest waits for tomorrow. `AUTO_REMINDERS_DRY_RUN=1` logs instead of sending.
6. Runs in system context but every query filters by `organization_id` explicitly.
7. **Tests** (mailer injected/mocked, never real email): step selection (pure function), off-by-default, suppressed,
   disputed, cooldown, cap, idempotency across two runs, dry-run, manual route unchanged.
8. Activity feed/bell shows "Automatic reminder sent" events if the feed is driven by `collection_actions`; otherwise
   note it.
9. Add `CRON_TIME_BUDGET_MS`, `AUTO_REMINDER_RUN_CAP`, `AUTO_REMINDERS_DRY_RUN` to `backend/.env.example` and AGENTS.md.
   In the notes, list what must happen on production before release (run enable-rls.cjs for the new column).

## [ ] T7. Google sign-in (inert until keys exist)

1. Frontend: Google Identity Services button on `AuthPage` (login and register), shown only when
   `VITE_GOOGLE_CLIENT_ID` is set. On register, the existing 18+/terms consent must be ticked before the Google
   button works, and the consent evidence recorded the same way as email sign-up.
2. Backend: `POST /api/auth/google` with the ID token; verify with the dependency `google-auth-library`
   (`verifyIdToken`, audience `GOOGLE_CLIENT_ID`); require `email_verified`. Existing user with that email → sign in;
   new → create org + user exactly like `/register` (same plan defaults, admin-email sign-up block, analytics).
   Return 503 when `GOOGLE_CLIENT_ID` is unset. Same rate limit as other auth routes.
3. Google-only users have no password: change-password must let them set one; account deletion (which needs a
   password today) must offer a safe alternative (fresh Google re-auth); login lockout logic unaffected.
4. CSP in `vercel.json`: add only what GIS needs (`https://accounts.google.com/gsi/client` script,
   `https://accounts.google.com/gsi/style` style, `https://accounts.google.com` frame/connect). Note each change.
5. Tests with a mocked verifier: new user, existing user, unverified email rejected, wrong audience rejected,
   unset key → 503, admin-email block.
6. `.env.example` files + AGENTS.md env list: `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`.

## [ ] T8. "What's new" page

`src/changelog.ts` with dated entries written from `git log` (user-visible changes only, plain language, newest first,
since 21 Nov 2026), and a `/whats-new` page in the marketing shell, linked from the footer and the app's help/menu
area. Lazy-loaded. Add it to `sitemap.xml`.

## [ ] T9. Bank-alert payment suggestions (stretch, suggest-only)

Only if T0–T8 are done. Sellers may forward bank credit-alert emails to their inbound address.

1. In the inbound pipeline, detect credit alerts (amount + "credited" + a reference/UTR) with a conservative parser
   `backend/src/lib/bankAlert.ts`. Unit tests use synthetic fixtures only (write them; do not claim bank-specific
   accuracy).
2. Match: an invoice in that org with a pending proof whose UTR equals the alert reference (strong), else exactly one
   open invoice whose outstanding amount equals the credited amount (weak). Create a `PAYMENT_MATCH_SUGGESTED`
   collection action with the evidence; the seller settles it with the existing one-click flow.
3. **Never** create a payment or change invoice status from an alert (AGENTS.md rule 1). Tests prove it.

## [ ] R3. Build from the research (your own judgement, flagged off)

Re-read `docs/research/MARKET-2026-11.md` and `docs/research/OSS-INTEGRATIONS.md`. Pick **up to two** ideas that are:
high value for "get paid without chasing", size S or M, need no new API key (or are fully inert without one), and
don't conflict with AGENTS.md. Write a short spec for each in `docs/research/PROPOSALS.md` first (problem, evidence
with links, design, risks, how to test). Then build each behind a default-off flag (org setting or `VITE_FEATURE_*`
env), with tests, one commit per idea (`[night] R3a: ...`, `[night] R3b: ...`). If nothing qualifies, write why in
PROPOSALS.md and build nothing. Never change pricing, plans or marketing claims.

## [ ] T10. Night report

Write `docs/NIGHT-REPORT.md`: start with **"Your next 3 days"** (exact first outreach actions from `docs/gtm/`, which messages to send first and where), then the 5 most important findings from R1/R4/R2, then one section per task with status, commit hash, what changed, test counts, anything
skipped or uncertain, and **exact steps the owner must do before merging** (production `enable-rls.cjs` run for new
columns, env vars to add in Vercel, keys needed, labels to flip after review). Commit `[night] T10: night report`,
push `night-build`. Then stop and print the report.
