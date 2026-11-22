export interface Plan {
  id: "FREE" | "PRO" | "AGENCY";
  name: string;
  price: number; // INR / month
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "Starter",
    price: 0,
    tagline: "For freelancers sending their first few invoices.",
    features: [
      "5 invoices a month",
      "Payment page with your own UPI QR",
      "Files unlock only after payment",
      "PDF invoices",
      "Confirm payments in one click",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 799,
    tagline: "For freelancers and studios who invoice every week.",
    highlight: true,
    features: [
      "Unlimited invoices and clients",
      "Automatic reminders for overdue invoices",
      "AI reads client replies and notes promised dates",
      "Cash-flow forecast: see what's coming in",
      "TDS calculator when recording payments",
      "Import invoices from a spreadsheet (CSV)",
    ],
  },
  {
    id: "AGENCY",
    name: "Agency",
    price: 1999,
    tagline: "For agencies with many clients and a finance person.",
    features: [
      "Everything in Pro",
      "Your own billing email address for client replies",
      "GSTIN printed on every invoice",
      "Priority support",
      "Customer data export and erasure (DPDP Act)",
    ],
  },
];

/** Feature matrix for the pricing page: [label, starter, pro, agency]. true/false or a short text. */
export const COMPARISON: Array<[string, boolean | string, boolean | string, boolean | string]> = [
  ["Invoices per month", "5", "Unlimited", "Unlimited"],
  ["Client payment page with UPI QR", true, true, true],
  ["Bank transfer (NEFT/RTGS) details on payment page", true, true, true],
  ["Files unlock only after payment", true, true, true],
  ["PDF invoices with UPI QR", true, true, true],
  ["Confirm client payments in one click", true, true, true],
  ["WhatsApp & email reminder links", true, true, true],
  ["Automatic overdue reminders", false, true, true],
  ["AI reads client replies", false, true, true],
  ["Cash-flow forecast", true, true, true],
  ["TDS (194C / 194J) calculator", true, true, true],
  ["Spreadsheet (CSV) import", true, true, true],
  ["Own billing email address", false, false, true],
  ["Priority support", false, false, true],
  ["Fee on each payment you receive", "None", "None", "None"],
];

/** Set VITE_PLATFORM_UPI_ID in your environment to receive plan payments. Empty = upgrades disabled. */
export const PLATFORM_UPI_ID: string = (import.meta.env.VITE_PLATFORM_UPI_ID as string | undefined) || "";
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || "";

export const inrPlain = (n: number) => new Intl.NumberFormat("en-IN").format(n);
