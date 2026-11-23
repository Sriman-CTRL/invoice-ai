# Competitor teardown (24 Nov 2026)

Scope: public home/pricing pages, robots.txt and head tags of a few sites, observed once. No logins, no scraping, nothing
copied. All notes are paraphrased. Limit: the page-reading tool returned text, not raw HTML, so head tags were read with a
single plain `curl` per site where noted. Check each vendor's own page before quoting any figure.

## Per-competitor notes

### Zoho Invoice (India) — https://www.zoho.com/in/invoice/ , https://www.zoho.com/in/invoice/pricing/
- **Hero:** "free GST invoicing software"; the pricing page repeats "free for all Indian businesses, forever". The price *is* the message.
- **CTAs:** "Sign up for free" in header, hero, mid-page and footer; secondary "Explore demo account" (a demo account lowers the fear of committing).
- **Trust:** named customer quotes, an aggregate 4.8/5 rating across app stores/G2/Capterra, free email support hours, "no ads, no selling data".
- **Objection handling (FAQ):** is it really free, what is GST, do I need GST registration, filing, UPI, support, data retention.
- **Free caps (stated in FAQ):** 2 users, 3 projects, 500 invoices a year, vendor branding on invoices.
- **Onboarding promise:** "first invoice in seconds", "set up in minutes".
- **UPI:** via Zoho Payments or another gateway. TDS: not mentioned on the pages read. Reminders and customer portal: yes.
- **SEO:** keyword-rich title ("Free GST invoicing software for Indian businesses"), OG image, JSON-LD with SoftwareApplication, Offer, AggregateRating and Organization.

### Refrens — https://www.refrens.com/ , /pricing , /refrens-premium , /robots.txt
- **Hero:** broad "run your business" promise, big social-proof line (reported business counts that differ between pages, 100,000+ vs 300,000, which is itself a lesson: inconsistent numbers look made up).
- **CTAs:** "Try for Free" plus "Book a Demo". The pricing URL is a try-free landing page; the real tier table lives on a separate premium page.
- **Pricing tactics:** free up to 15 documents; four paid tiers billed yearly (about ₹8,900 to ₹44,900 ex-GST); the middle-upper plan is marked "Recommended"; struck-through list prices; 16% off for 1 year and 25% off for 3 years; refund window of 7 days; pay-per-extra-user add-ons. Most gating is by compliance features (e-invoice, e-way bill, GSTR reports) and users.
- **Trust:** investor/founder names, review-site scores, ISO claim, wall of testimonials, awards, a "recently upgraded" counter.
- **Support:** long human support hours (chat, WhatsApp, phone) and an AI agent after hours; a dedicated account manager on every plan.
- **robots.txt:** blocks account/app areas (dashboard, profile, wallet, app, payments); public marketing pages are crawlable; no Sitemap line.
- **SEO:** a very large set of free template/generator pages; title "Refrens | Accounting Software for India", meta description and OG tags present, JSON-LD present.

### Kwill — https://kwill.app
- The domain I could reach describes an AI meeting-insights product with USD plans ($0, $10, $20, enterprise). It does not look like the invoicing tool the earlier competitor notes in `docs/COMPETITOR-KWILL.md` describe; the invoicing "Kwill" may live on another domain I could not reach (www.kwill.com refused the connection). **Treat Kwill facts as unverified until the owner confirms which site is meant.** Its Capterra listing (cited in R1) says free to start with paid extras, and no GST/UPI.

### Razorpay Payment Links — https://razorpay.com/payment-links/ , https://razorpay.com/pricing/
- **Hero:** links "in seconds", share by SMS/email/WhatsApp; large payment-method count (the page gives two different numbers).
- **CTAs:** a plain sign-up button at the top and again below; no FAQ.
- **Trust:** two named brand case studies with one headline metric each; compliance badges on the pricing page.
- **Pricing:** 2% domestic platform fee plus 18% GST on the fee; no setup fee. UPI is described as free of bank charges but still carrying the 2% platform fee, with a separate QR table at a lower rate (the page itself does not reconcile the two). Extra charges for instant settlement and refunds. The pricing page argues total cost of ownership (a higher success rate beats a lower headline rate).
- **SEO:** descriptive title and meta description, OG title/image/url, Twitter card.
- **What it tells us:** the main alternative charges roughly 2% per payment; Paivo's flat price and no per-payment cut is a real, checkable difference, as long as we state it plainly ("no gateway fee on payments to you").

## Paivo today (for comparison)
- **Landing (`src/LandingPage.tsx`):** clear hero, an honest "what your client sees" mock, a "see what your client sees" demo link, problem section, 3 features, 3 steps, plans, FAQ with UTR, UPI limit, TDS/GST, safety. No fake proof. Gaps: no comparison against "payment link with 2% fee", no "how long to first invoice" promise backed by data, no demo-first path from the hero on mobile beyond one link.
- **Pricing:** waitlist for paid plans, fee FAQ present. Honest, but no "what you get free" caps table like Zoho's FAQ.
- **Pay page (`src/PublicPayPage.tsx`):** already has a UPI deep link button, QR, copy buttons, a ₹1 lakh note. Needs: a short "who you are paying and where the money goes" block and "what happens after you submit the UTR" text near the primary action.
- **Signup:** consent step and a "how did you hear" question exist.

## Patterns to adopt (in our own words)

1. **Put the price promise in the hero sub-line.** Zoho leads with "free"; we lead with "no gateway fee". *Why:* the first thing a visitor compares is cost. *Evidence:* Zoho hero, Razorpay 2% pricing. *Honestly:* "Clients pay you directly by UPI. No per-payment fee." (true; the flat plan price is separate.) *Effort:* S.
2. **A plain "Paivo vs a payment link" comparison.** Three rows we can back: per-payment fee, who holds the money, files lock until confirmed. No rival names needed. *Evidence:* Razorpay's 2% + GST pricing. *Effort:* S.
3. **Reassurance block on the client pay page.** Say who is being paid (seller name, UPI ID), that Paivo never holds the money, what a UTR is, and what happens after submitting. *Why:* clients hesitate to pay a link from WhatsApp; Zoho/Razorpay lean on trust cues, we cannot claim badges, so we explain. *Effort:* S.
4. **Mobile-first pay actions.** UPI app button first on phones, QR below, copy-UPI-ID always available (QR cannot be scanned on the same phone). Already partly built. *Effort:* S.
5. **Demo before signup, stated twice.** Zoho offers a demo account; we already have a demo pay page. Surface it in the hero, the FAQ and the final call to action. *Effort:* S.
6. **Free-plan limits stated in one place.** Zoho spells out caps in its FAQ. We should show "5 invoices a month, all core features" next to the pricing cards. *Effort:* S.
7. **FAQ on the real objections.** Add: "Why not a payment link?", "What if my client says they paid but didn't?", "Is a UPI ID safe to share?". Answers must match the code. *Effort:* S.
8. **SEO groundwork (T1).** Title with the keyword phrase, meta description, OG tags, JSON-LD, crawlable fallback, robots/sitemap that block app pages like Refrens does. *Effort:* S.

## Patterns to avoid

- **Unverifiable or inconsistent social proof** (counts that disagree between pages, "recently upgraded" counters, rating badges we do not have).
- **Fake urgency / struck-through list prices** that were never charged.
- **Hiding the real pricing behind a "free" landing page** (Refrens has two pricing URLs; confusing).
- **Compliance badges or "certified" claims** we cannot show (AGENTS.md rule 7).
- **Named testimonials we did not collect.**
- **Dark patterns on cancel/refund.** Keep export/erasure easy, as already built.
