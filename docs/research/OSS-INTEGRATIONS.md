# Open-source and API scouting (24 Nov 2026)

Only MIT/Apache/BSD/ISC candidates are listed. Data from the public npm registry and GitHub API on 24 Nov 2026
("modified" = last registry change). GitHub stars were collected only for razorpay/ifsc (unauthenticated API budget);
other star counts are "not collected". No dependency was added by this task.

| Need | Candidate | Licence | Last registry change | Weekly npm downloads | Fit | Effort | Risks | Recommendation |
|---|---|---|---|---|---|---|---|---|
| GSTIN validation | `gstin-validator` | MIT | May 2022 | 113 | Does format + checksum, but unmaintained and tiny | S | Stale, low use, GitLab-hosted | **No: write ~25 lines** (the checksum algorithm is public: base-36 weighted mod-36) |
| GSTIN validation | `gst-validator` | MIT | Sep 2026 | 7 | Same idea | S | Almost no users | No |
| IFSC format | none needed | - | - | - | Regex `^[A-Z]{4}0[A-Z0-9]{6}$` | S | - | **Integrate now** (B1) |
| IFSC bank/branch lookup | [`ifsc`](https://github.com/razorpay/ifsc) (razorpay/ifsc) | MIT | Nov 2025 | 3,521 | npm package includes the dataset and a lookup helper; official Razorpay-maintained list | S-M | Dataset is a few MB; must check package size and that it ships data offline. Bank branches change, data can lag | **Integrate now if the bundled data is small enough** for server-side use only (B1); otherwise format only. Repo: 398 stars, pushed Oct 2026 |
| Amount in words (Indian lakh/crore) | [`to-words`](https://github.com/mastermunj/to-words) | MIT | 22 Nov 2026 | 215,322 | Has an `en-IN` locale with lakh/crore and currency options | S | New dependency in the browser bundle (PDF) | Optional. Our own ~40-line tested function is simpler and keeps the bundle small, so **write our own (B2)** |
| Amount in words | `number-to-words` | MIT | Oct 2026 | 757,927 | English only, no lakh/crore | S | Wrong numbering system for India | No |
| UPI deep link / QR | NPCI UPI Linking Specification (parameters `pa`, `pn`, `am`, `cu`, `tn`, `tr`) | spec | n/a | n/a | Already implemented in `PublicPayPage.tsx` with `qrcode` | - | A small npm "upi-qr-generator" exists (7 downloads/week): don't use | **Nothing to integrate**; add a unit test for the link builder (U1) |
| Bank credit-alert parsing | none found that is permissively licensed and maintained | - | - | - | Formats are bank-specific and change | M | Wrong parses could mislead sellers | **Build our own conservative parser, suggest-only (T9)** |
| Transactional email templates | [`@react-email/components`](https://github.com/resend/react-email) | MIT | 12 Nov 2026 | 11.3 M | Would pair with Resend, but adds React rendering to the serverless API bundle | M | Larger bundle, cold-start cost on Vercel | Later. Current plain templates are enough |
| PDF invoices | `jspdf` (already used) / `pdfmake` (MIT, 5.2 M/wk) / `@react-pdf/renderer` (MIT, 10.3 M/wk) | MIT | Nov 2026 / Aug 2026 | see left | Current client-side PDF works | L to switch | Rewrite risk with no user benefit | **No** (keep jspdf; lazy-load it in T4) |
| Hindi / Indian-language UI | `i18next` | MIT | 23 Nov 2026 | 37.3 M | Standard i18n; the pay page could offer Hindi/Hinglish | M | Translation quality needs native review; extra bundle | Later (idea 6 in MARKET-2026-11.md) |

## Services and APIs (all optional; nothing is integrated by this task)
- **Resend** (already used): `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`.
- **IFSC lookup over HTTP** (Razorpay's public IFSC API) is **not** recommended: it would add a third-party call and CSP change. Use the offline package server-side.
- **Account Aggregator / bank APIs, payment gateway webhooks** (Razorpay, Cashfree): would enable auto-confirmation, need merchant accounts and keys, and change the "Paivo never holds money" story. Out of scope for the night run.
- **GSTN taxpayer lookup**: official API requires GSP registration; not recommended.

## Keys or accounts any recommendation would need
None of the "integrate now" items need a key: GSTIN checksum, IFSC regex/lookup, amount in words and the bank-alert parser are all offline.

## Plan for B1/B2/R3
- B1: write the GSTIN checksum ourselves; IFSC regex; evaluate the `ifsc` package size before adding it (it is the only dependency candidate, and the queue says B1 may add one if it is "vetted").
- B2: write the Indian amount-in-words function ourselves with tests.
