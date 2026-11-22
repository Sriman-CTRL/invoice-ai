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
    tagline: "For freelancers sending their first invoices.",
    features: [
      "5 invoices per month",
      "Public pay page with your own UPI QR",
      "Deliverable Escrow Vault",
      "Branded PDF invoices",
      "1-Click proof reconciliation",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 799,
    tagline: "For studios that chase payments every week.",
    highlight: true,
    features: [
      "Unlimited invoices & customers",
      "AI reply classification (Gemini)",
      "Autonomous overdue reminders",
      "Cash-flow forecast & promise tracking",
      "TDS-aware payment recording",
      "CSV bulk import",
    ],
  },
  {
    id: "AGENCY",
    name: "Agency",
    price: 1999,
    tagline: "For teams with many clients and a finance desk.",
    features: [
      "Everything in Pro",
      "Custom inbox address (Cloudflare routing)",
      "GST-ready invoice details",
      "Priority support",
      "Data export & erasure tooling (DPDP)",
    ],
  },
];

/** Set VITE_PLATFORM_UPI_ID in your environment to receive plan payments. Empty = upgrades disabled. */
export const PLATFORM_UPI_ID: string = (import.meta.env.VITE_PLATFORM_UPI_ID as string | undefined) || "";
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || "";

export const inrPlain = (n: number) => new Intl.NumberFormat("en-IN").format(n);
