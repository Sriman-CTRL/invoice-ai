# Kwill: competitor study and what to build for Paivo

Sources: Kwill's public pages (getkwill.com), a static look at its public page scripts, and 26 screenshots from a free account (23 Nov 2026).
Rule: ideas and features are fair to build in our own code, words and design. Do not copy their code, text, images or visual design.
Everything below is observed on the Free plan; locked features are known only from their upgrade screens.

## 1. What Kwill is

A client-portal suite for freelancers and agencies: proposals, e-signed contracts, invoices, payments (Stripe/Razorpay), forms, a small CRM pipeline, projects, messaging, analytics, cash flow, branding and custom domains.

## 2. What we saw, screen by screen

| Area | Observation |
|---|---|
| Signup | Google sign-in or email and password (8+ characters, a number, a symbol, with a live checklist). "How did you hear about us?" question. Terms/Privacy by clicking Create account. No age check. |
| Onboarding | 4 steps in about a minute: Business name, Portal address (`name.usekwill.com`), Brand (logo + colour), Clients (start fresh or import from HoneyBook, Bonsai, Dubsado, FreshBooks, QuickBooks, CSV). A live preview shows on the right while you type. |
| Home | Greeting, a 4-step essentials checklist, revenue chart, quick actions, upcoming meetings, open requests, recent client activity (viewed, signed, paid), messages, pipeline, clients, projects, tasks, analytics, cash flow ("expected from unpaid invoices, next 60 days"). Search with Cmd+K. |
| Payments setup | Banner: confirm your business country to set up payments. Until then you can draft invoices but not send them. Money shows in US$ by default. |
| Invoice builder | Client required first. Payment terms: Immediate / Net 15 / Net 30 / Net 60 (due date fills itself). Currency picker. Line items. AI "describe the work, generate line items". Discount and a single Tax %. Note to client. "Repeat this invoice" toggle (each repeat is a draft to review). Save draft / Send. |
| Forms | Public lead form that feeds the pipeline. Name, email and a consent checkbox are always asked. "Write questions with AI". Footer "Powered by Kwill". |
| Projects | Fixed price (free) or Retainer (locked). Steps: basics, client, timeline and budget. |
| Clients | Each client gets their own portal login. 3-step add: contact, business, notes and access. |
| Branding | Logo, colours, ready-made palettes, font pairings. PDFs and emails are styled separately in "Brand Kit". |
| Domains | Free subdomain. Custom domain is Studio-only (CNAME to Vercel). Email-domain setup guide. |
| Billing (India) | Free: 1 client, 3 documents, 500 MB, 5 pipeline deals. Independent ₹799/mo (25 clients, 10 GB). Studio ₹1,699/mo (100 clients, recurring invoices, white-label, dedicated support). Collective ₹3,499/mo (+₹599 a seat past 5). Yearly saves 19%. |
| Locked-feature design | Upgrade screens show a blurred preview plus "Unlock inbox / analytics / automations" with the plan name. |
| Cookies | Banner says Google and Meta advertising cookies run by default unless declined. |

Note: in-app India prices are in rupees. Earlier I quoted $19 from their marketing page, so the real India price is ₹799. That is the same number as our planned Pro price, with far more included.

## 3. Where Kwill is weak for Indian freelancers (our openings)

- No UPI anywhere. Payments go through Stripe/Razorpay, with gateway fees on every payment.
- Tax is one "Tax %" box. No GSTIN, HSN/SAC codes, CGST/SGST/IGST split or TDS.
- Defaults to US dollars, even after choosing India.
- Imports only from Western tools. Nothing from Zoho, Vyapar, Refrens or Tally.
- Free plan allows 1 client. Ours allows 5 invoices a month for any clients.
- Payment-gated file delivery is a Studio feature (₹1,699). We give it on Free.
- It is a broad suite. Many freelancers want one simple thing done well.

## 4. What to build, ranked

### Do first (small, directly serve "get paid without chasing")
1. **Client activity feed.** Record when a client views the invoice or payment page, and show "Viewed 2 hours ago" on the invoice and the dashboard.
2. **Payment-terms quick pick.** Immediate / 15 / 30 / 60 days, auto-filling the due date.
3. **Block sending until payment details exist.** No UPI or bank details means the invoice stays a draft, with a clear message.
4. **"How did you hear about us?" at signup.** Feeds your acquisition numbers during the interview stage.
5. **Live password checklist** on the signup form.
6. **AI line items.** "Describe the work" fills the invoice rows using Gemini, which you already have.
7. **Locked-feature previews.** Blurred preview and "Unlock" button on paid features. Use only after paid plans open.

### Do next (medium effort, strong fit)
8. **Branded invoices and pay page.** Logo and one brand colour on PDF, pay page and emails.
9. **Guided 3-step onboarding.** Business, UPI/payment details, logo and colour. Replaces the checklist.
10. **Recurring invoices (retainers).** Each repeat is created as a draft to review before sending. Common for Indian freelancers.
11. **Import from CSV and from Indian tools** (Zoho Invoice, Vyapar, Refrens, Tally exports). A gap Kwill leaves open.
12. **Client portal page.** One private link where a client sees all invoices and files from one seller.
13. **Analytics.** Monthly revenue and top clients by lifetime value. Keep for the paid plan.
14. **Google sign-in.** Less friction at signup.
15. **Notifications bell** for "client viewed / paid / replied".
16. **Changelog ("What's new").**
17. **Monthly GST summary export** (a small thing Kwill does not have for India).

### Only if the interviews ask for it
18. **Quotes that become invoices.** Client clicks Accept (timestamp and IP stored), and it turns into an invoice. A light version of proposals.
19. **Lead/enquiry form** that creates a customer. Keep the consent checkbox.
20. **Custom domain per seller** (paid tier).
21. **Dark mode.**
22. **Payment-gateway auto-confirm** (Razorpay and similar), so "did the money arrive" is automatic.

### Don't build (for now)
- E-signed contracts: legal complexity (India e-sign rules) and a big build.
- Pipeline/CRM, projects, time tracking, calendar, team seats: a different product, and it would pull you into a fight with a bigger team.
- Per-client chat portal: WhatsApp and email already do this.
- Their ad-cookie approach: stay consent-first.

## 5. Pricing lessons

- Their Independent plan costs ₹799 and includes a portal, branding, forms and automations. Our Pro is also ₹799 with fewer features. Consider ₹399–499 until automatic reminders and auto-confirm work, and ask interviewees what they would pay.
- Keep Starter generous. It is your advantage over a 1-client free plan.
- Put branding, recurring invoices and automatic reminders in Pro. Put team features in Agency.
- Offer a yearly price with about 19% off.

## 6. Limits of this study

- Built from public pages and your free-account screenshots. Locked features and the server side are unknown.
- Marketing claims (such as "46+ countries") are unverified.
- Kwill is a young product and changes. Re-check before major decisions.
