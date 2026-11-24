# R3 proposals (24 Nov 2026)

Source lists: `MARKET-2026-11.md` section 7 and `OSS-INTEGRATIONS.md`. Filter: high value for "get paid without
chasing", size S/M, no API key, no conflict with AGENTS.md, default-off.

## Already done (so not proposed again)

#1 bank-alert suggestions (T9), #2 automatic reminders (T6), #3 "Pay with UPI app" link and #4 big-amount NEFT/RTGS hint
(already on the pay page; see `src/PublicPayPage.tsx`), #5 amount in words and GSTIN/IFSC checks (B1, B2),
#10 "client viewed" events (already in the activity feed from `invoice_views`).

## Not chosen

- #7 quotes to invoices, #8 milestone partial unlock, #9 TDS tracking: size M or larger, each needs product decisions
  (data model, settlement rules, wording about tax) that the owner should make after interviews. Building them blind
  would risk a second round of money-path bugs like the ones T5 found.

## R3a: Hinglish explainer on the client pay page (idea #6, scoped down)

- **Problem:** many clients opening a pay link from WhatsApp are more comfortable in Hindi-English mix than in formal
  English. The pay page's most important text is the reassurance block (who you are paying, that the money goes straight
  to the seller, what a UTR is, what happens next). If the client doesn't understand it, they hesitate or message the seller.
- **Evidence:** language reach is idea #6 in the market doc; R2 found no maintained i18n dataset worth adding, so this is
  plain hand-written copy, no dependency. No claim about conversion is made.
- **Design:** `src/payCopy.ts` holds the explainer in English and Roman-script Hinglish as a pure function. A small
  "English | Hinglish" switch appears on the pay page only when `VITE_FEATURE_HINGLISH_PAY=true` at build time. Default
  is off, so production is unchanged. Only that block is translated (not the whole page); the amounts, buttons and
  seller data stay as they are. The choice is kept in component state only (nothing stored).
- **Risks:** a half-translated page can look odd (mitigated by limiting it to one clearly labelled block); wording
  must not add claims (both languages say exactly the same things; a test checks that the key facts appear in both).
  A native speaker should review the Hinglish before the flag is turned on.
- **Test:** unit tests that both languages mention the seller name, "UTR", and the unlock sentence only when
  deliverables exist; the flag parser defaults to false.
