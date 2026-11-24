# Night build queue, phase 2

Runs after `docs/NIGHT-QUEUE.md` (phase 1) has finished. **All ground rules in `docs/NIGHT-QUEUE.md` apply here
unchanged** (branch `night-build` only, never touch production, database guard, definition of done, one commit per task
with message `[night] Pn: ...`, stash on failure, follow AGENTS.md, keep going, research hygiene). Read them first.
Work top to bottom; this file holds progress. Status marks: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.

Extra rules for phase 2:
- **Depth over speed.** Phase 1 research used only a handful of searches. Here, open primary sources (vendor pricing
  pages, official government/NPCI/RBI/CBIC/Income Tax pages) and quote figures only from them, with the URL and the
  date you checked.
- **Tax and legal content must be correct.** Every rate, threshold and section number needs an official source link.
  If sources conflict or you are unsure, say so on the page and don't state a number. Add "This is general
  information, not tax advice. Check with a CA." where tax is discussed.
- Content you write must be original. No copying from blogs or competitors.

---

## [~] P0. Fix the review findings on the night's code (do this first)

A reviewer checked every `[night]` commit. Fix these six, each as its own commit with tests:

1. **Google sign-in account pre-hijacking** (`backend/src/routes/auth.routes.ts`, `lib/googleAuth.ts`). Sign-up has no
   email verification, so an attacker can register a victim's email with a password; when the victim later uses
   Google sign-in, `/api/auth/google` signs them into the attacker's account. Fix:
   - Add `users.google_sub VARCHAR(255) UNIQUE NULL` (enable-rls.cjs + schema.prisma, `prisma generate`).
   - Google sign-in succeeds only when (a) a user has that `google_sub`, or (b) a new account is created (store
     `google_sub`). If a user exists with that email but no `google_sub`, return 409 `code: "LINK_REQUIRED"` with
     "This email already has a Paivo account. Sign in with your password, then connect Google in Settings."
   - Add `POST /api/auth/google/link` (authenticated): verify the token, require the Google email to equal the
     signed-in user's email, store `google_sub`. Add a "Connect Google" button in Settings (only when
     `VITE_GOOGLE_CLIENT_ID` is set) and handle `LINK_REQUIRED` on the auth page.
   - Google re-auth for set-password and account deletion must match on `google_sub`, not only email.
   - Tests: pre-registered password account + Google → 409 and no session; link flow; sub mismatch rejected.
2. **Automatic reminders can double-send** (`backend/src/services/reminderService.ts`). Today the record is written
   after sending, so a failed write or two overlapping cron runs resend the same step. Fix: before sending, claim the
   step by inserting the `PAYMENT_REMINDER` action with status `PENDING` and metadata `{auto, step}`, guarded by a
   unique index on `(invoice_id, (metadata->>'step'))` where `metadata->>'auto' = 'true'` (partial unique index in
   enable-rls.cjs; check the action_type/status enums support this, otherwise use a small `auto_reminder_claims`
   table with `UNIQUE(invoice_id, step)`). Only the run that wins the claim sends; then mark `COMPLETED` with
   `delivered: true`, or `FAILED` on error (a FAILED claim may be retried next day). Tests: two concurrent runs →
   one email; record failure → no resend.
3. **Bank-alert suggestions trust a forgeable From header** (`services/bankAlertService.ts`, `cloudflare-worker`).
   Make the Cloudflare worker forward the message's `Authentication-Results` header (as `x-inbound-auth`, within the
   existing signed request), parse `dmarc=pass` (or `spf=pass` + `dkim=pass` for the same domain) in the inbound route,
   and only create a bank-alert suggestion when it passed; otherwise treat the email normally. Every suggestion's
   text must say: "Check your bank app or statement before confirming. Emails can be faked." Tests for both paths.
   Update `cloudflare-worker/README.md`.
4. **Production migration order.** Add to AGENTS.md Known pitfalls: "**Run `enable-rls.cjs` on production before
   deploying** any change that adds a column to a Prisma model (Prisma selects every model column, so pages crash
   until the column exists)." Make sure `docs/NIGHT-REPORT.md` (or T10's report) lists this as step 1 of merging.
5. **Pay page ignores credit notes.** The client pay page (`public-invoice.routes.ts` + `src/PublicPayPage.tsx`), the
   PDF and the UPI QR/deep link must use outstanding = invoice amount − SUCCEEDED payments − issued credit notes, so a
   client is never asked to pay more than they owe. Keep "a credit note that zeroes the balance marks the invoice
   PAID" as is, but show "Settled by credit note" (not "Paid") on the pay page and invoice detail in that case.
   Tests for partial and full credit.
6. **Honest pay-page wording.** Replace "256-Bit Encrypted", "Secure Deliverables Vault", "Escrow Charter" and any
   similar claim with plain, true statements (e.g. "Secure connection (HTTPS)", "Final files unlock after payment",
   "Money goes straight to {seller}; Paivo never holds it"). Paivo is not an escrow. Search the whole `src/` for
   "escrow", "vault", "256", "bank-grade", "military" and fix every user-facing hit the same way.

**Notes (P0):** (1) DONE `[night] P0.1`: users.google_sub (unique) in enable-rls.cjs and schema.prisma; /api/auth/google signs in only by google_sub or creates a new account; an email that already has a password account (or a different Google link) gets 409 LINK_REQUIRED and no session; POST /api/auth/google/link (signed in, Google email must equal account email, one Google account per Paivo account, checked across tenants with runAsSystem); set-password and delete re-auth match on google_sub; tokens without a Google account id are refused; Settings has a Connect Google card; the auth page shows the 409 message. Tests 108 run/108 pass/0 skip, build pass. PRODUCTION: run enable-rls.cjs before deploying (adds users.google_sub). (2) DONE `[night] P0.2`: a PENDING PAYMENT_REMINDER action would have shown up in the seller's Action Queue, so the claim lives in a small table instead: auto_reminder_claims with UNIQUE(invoice_id, step) (enable-rls.cjs, TENANT_TABLES, schema.prisma). A run inserts the claim (ON CONFLICT DO NOTHING) before sending; only the winner sends, then marks it SENT; a send error marks it FAILED, which is retried once it is 20 h old; a run that died mid-send leaves CLAIMED, which is never retried (at most once). The manual cooldown also counts claims. Tests: three overlapping runs send one email, a blocked history write (DB trigger) still never re-sends, a failed send retries only on a later day. 111 run/111 pass/0 skip, build pass. PRODUCTION: enable-rls.cjs creates the table. (3) DONE `[night] P0.3`: new lib/emailAuth.ts reads Authentication-Results (dmarc=pass for the From domain, or spf=pass and dkim=pass both for that domain; fail closed). The worker forwards the topmost Authentication-Results (only if it starts with AUTHSERV_ID, default mx.cloudflare.net) as x-inbound-auth plus the visible From as header_from; /api/inbound/email turns that into authenticated_sender, and bank-alert handling uses ONLY that (the authenticated-ingest route never sets it). No header = normal email, no suggestion. Every suggestion's evidence ends with "Check your bank app or statement before confirming. Emails can be faked." and the Action Queue shows it. Could not test against real Cloudflare: the header format Cloudflare adds must be confirmed with a real test email (cloudflare-worker/README.md says how); until then suggestions stay off. Tests: 13 in bank-alert + email-auth (forged, failed, wrong-domain, spf-only, spf+dkim OK). (4) DONE `[night] P0.4`: AGENTS.md pitfall added; NIGHT-REPORT "Before merging" step 1 now says to run enable-rls.cjs on production BEFORE deploying and lists users.google_sub, auto_reminder_claims and organizations.auto_reminders. Doc-only, tests unchanged (117/117). (5) DONE `[night] P0.5`: new lib/invoiceBalance.ts: outstanding = invoice amount - SUCCEEDED payments - issued credit notes, used by the public pay page (and so the UPI QR/deep link, which read outstanding_amount), proof submission, the invoice detail/PDF summary, the client portal, the manual payment route and the one-click proof settlement (so paying the post-credit remainder marks the invoice PAID). A credit note that zeroes the balance still sets PAID, but the pay page, invoice detail and PDF now say "Settled by credit note" (or "Settled: payment + credit note" when part was paid); the pay page also shows "Credit note applied". Tests: 4 new (partial credit, overpay after credit, full credit, portal). 121 run/121 pass/0 skip, build pass, test:web 17.

## [ ] P1. Verify and deepen the market research

1. Open each competitor's **own** pricing/features page (Zoho Invoice, Refrens, Vyapar, myBillBook, Kwill, Bonsai,
   Razorpay Invoices/Payment Links, Cashfree Payment Links, Instamojo) and replace every "(?)" and "Not found" in
   `docs/research/MARKET-2026-11.md` with what the vendor's page says (with URL + date), or "not stated by vendor".
2. Check the pay-to-unlock claim further: Bonsai, Dubsado, HoneyBook, Gumroad, Pixieset/photography delivery tools,
   escrow services used in India. Update section 2 honestly.
3. Find 3–5 sources that describe Indian freelancers' late-payment problem (surveys, reports, news). Add a short
   "Evidence of the pain" section with figures only from those sources.

## [ ] P2. Free public tools (top-of-funnel, no login)

Build three free tools as public routes inside the marketing shell, lazy-loaded, linked from the footer and added to
`public/sitemap.xml`. Each ends with an honest call to action to try Paivo. No AI, no network calls, everything runs
in the browser.

1. `/tools/gst-invoice-calculator`: line items, discount, GST rate (0/5/12/18/28 or the current official slab set; check
   the latest GST rate rationalisation on the official CBIC/GST Council source and use what is current), intra-state
   (CGST+SGST) vs inter-state (IGST), with the same rounding as `backend/src/lib/invoiceDetails.ts` (share or mirror the
   logic in `src/invoiceMath.ts`; unit-test both give identical results).
2. `/tools/tds-calculator`: TDS on payments to freelancers under sections 194C and 194J. Rates and thresholds **only**
   from official Income Tax Department sources for the current financial year, cited on the page with a "last
   checked" date. If you can't confirm a figure, leave it out and say why.
3. `/tools/payment-reminder-writer`: pick tone (friendly / firm / final), days overdue, amount, invoice number, client
   name → produces an editable reminder text (template-based, from the tone and style of `docs/gtm/MESSAGES.md`),
   copy button, WhatsApp share link. Never threatening; no legal threats.
4. Meta title/description per tool (set `document.title`; plus a static crawlable fallback if T1 set one up). Unit
   tests for the calculation helpers.

## [ ] P3. Guides that Google can read (static HTML)

Write 5 original guides as **static HTML files** in `public/guides/` (served directly by Vercel, so crawlers read them
without JavaScript), with one shared stylesheet `public/guides/guides.css` (dark theme like the landing page), no
inline scripts (CSP), a header link back to https://paivo.in and a CTA to sign up:

1. `how-to-invoice-as-a-freelancer-in-india.html`: what a valid invoice contains, when GST registration is needed
   for services (official threshold), invoice numbering, payment terms.
2. `tds-for-freelancers.html`: 194C vs 194J in plain words, how TDS shows up on payments, Form 26AS/AIS, linking to
   the TDS tool.
3. `upi-limits-for-big-invoices.html`: current UPI limits from NPCI (P2P vs P2M), what to do for big invoices
   (NEFT/RTGS, split payments), linking to the pay page features.
4. `how-to-follow-up-on-late-payments.html`: a polite follow-up schedule, sample messages, linking to the reminder
   writer.
5. `get-paid-before-sending-final-files.html`: advance payments, milestones, delivering after payment, how Paivo's
   locked files work (only what the code does).

Each guide: `<title>`, meta description, canonical, OG tags, an "Updated 24 Nov 2026" line, sources list at the end,
the not-tax-advice note where relevant, 800–1,500 words. Add a `public/guides/index.html` listing them. Add all to
`public/sitemap.xml`, link "Guides" from the marketing footer. Confirm the SPA rewrite in `vercel.json` doesn't
swallow `/guides/*.html` (exclude them if needed, without loosening headers).

## [ ] P4. End-to-end test of the core money flow

Using Playwright (installed in G3; if G3 failed, install `@playwright/test` and Chromium now), write
`e2e/core-flow.spec.ts` against the local stack with fictional data: register → add UPI ID in Settings → create an
invoice with a deliverable link → open the public pay page (link hidden) → submit a UTR → seller confirms in the
Action Queue → pay page shows the files link. Add `npm run e2e` at the root. Do not add it to CI. Make it pass
reliably (run 3 times).

## [ ] P5. Client pay page in Hindi

Add a language switch (English / हिन्दी) to the client pay page only. UI labels and instructions translated; amounts,
names, invoice data and the UPI link unchanged. Simple typed dictionary, no new dependency. Default English; remember
the choice in `localStorage` (try/catch). Keep the translation natural and plain; mark it as "needs native review" in
the report. Tests that every key exists in both languages.

## [ ] P6. Review the whole night's work

Review every `[night]` commit (`git log origin/main..night-build`) as a strict reviewer: tenant isolation (every new
query scoped or in tenant context), AGENTS.md rule 1 (no AI or alert changing invoice status), XSS in new pages and
guides, CSP compatibility of every new page/script, secrets, honest copy (no unverifiable claims, no fake proof),
broken links, accessibility basics (labels, contrast, focus). Fix real issues (one commit per fix theme). Write
findings and fixes into `docs/NIGHT-REPORT.md` under a new "Phase 2 review" section.

## [ ] P7. Update the night report

Add a "Phase 2" section to `docs/NIGHT-REPORT.md` (status and commit per P-task, what to check before merging, any
production steps), and refresh "Your next 3 days" if phase 2 changed what should be done first (e.g. share the free
tools and guides). Commit `[night] P7: report`, push, then stop.
