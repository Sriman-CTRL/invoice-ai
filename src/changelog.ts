// What's new. Plain language, newest first, user-visible changes only. Add an entry whenever something ships.
export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-11-24",
    title: "Clearer payments, fewer typos, faster pages",
    items: [
      "The client's payment page now says who they are paying, that the money goes straight to you, what a UTR is and what happens next.",
      "On a phone, clients get a big \"Pay with UPI app\" button first, plus a button to copy your UPI ID.",
      "Invoices show the total in words (for example, Rupees Forty-Five Thousand Only), on the PDF and on the payment page.",
      "Settings now checks your GSTIN and IFSC as you type and tells you if one looks wrong.",
      "Confirming the same payment twice no longer records it twice.",
      "Pages open faster, especially on phones.",
    ],
  },
  {
    date: "2026-11-23",
    title: "Branding, recurring invoices and a client portal",
    items: [
      "Paivo has its new name. Reminder emails now go out from Paivo and replies land in your own inbox, with an unsubscribe link for your client.",
      "Invoices can have line items, GST (CGST+SGST or IGST), a discount and payment terms. You can also add your logo and brand colour.",
      "Recurring invoices: set one up once and Paivo drafts it each period for you to approve.",
      "Each client gets a portal page showing their invoices. Analytics and a GST report show what is coming in.",
      "An activity feed and a bell tell you when a client views an invoice or submits a payment reference.",
      "You can change your password and delete your account, and clients can be exported or erased.",
      "Fixed: sign-up was being refused on paivo.in.",
    ],
  },
  {
    date: "2026-11-22",
    title: "Files unlock after payment",
    items: [
      "Add a link to your final files on an invoice. Your client sees it is ready but can open it only after you confirm their payment.",
      "One-click confirmation when a client submits their UTR.",
      "Privacy Policy and Terms of Service are now on the site.",
    ],
  },
  {
    date: "2026-11-21",
    title: "The first version of the payment page",
    items: [
      "Every invoice gets its own payment page with a UPI QR for the exact amount, bank details and a place for the client to enter their UTR.",
      "Import many invoices at once from a spreadsheet (CSV).",
      "See which invoices are overdue and send a reminder in one tap, by email or WhatsApp.",
    ],
  },
];
