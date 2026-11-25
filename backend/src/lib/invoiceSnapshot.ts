import prisma from "./prisma";
import { getOrgSettings } from "./orgSettings";
import { computeTotals, type InvoiceDetails, type LineItem, type Totals } from "./invoiceDetails";

/**
 * Invoice snapshots.
 *
 * When an invoice leaves DRAFT, the seller details, the client details and the line items are frozen in
 * `invoice_snapshots`. The PDF, the public pay page and the GST report then read the snapshot, so changing the business
 * GSTIN, logo, UPI ID or a client's name later never rewrites an invoice that was already issued. Drafts have no
 * snapshot and keep following live data.
 *
 * Payment details policy: the pay page's UPI ID and bank details FOLLOW THE SNAPSHOT (so a link the client already holds
 * never silently starts paying a different account). The seller can explicitly pull the current payment details into one
 * unpaid invoice with `refreshPaymentDetails` ("Update payment details on this invoice").
 *
 * There is no seller address field in Paivo yet, so none is captured; add it here and in the backfill when it exists.
 */

export interface SellerSnapshot {
  name: string | null;
  payee_name: string | null;
  gstin: string | null;
  logo_data: string | null;
  brand_color: string | null;
  upi_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
}
export interface ClientSnapshot {
  name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
}
export interface InvoiceSnapshot {
  seller: SellerSnapshot;
  client: ClientSnapshot;
  details: InvoiceDetails | null;
}

export const PAYMENT_FIELDS = ["payee_name", "upi_id", "bank_account_name", "bank_account_number", "bank_ifsc", "bank_name"] as const;

export function withTotals(d: InvoiceDetails): InvoiceDetails & { totals: Totals } {
  const items: LineItem[] = Array.isArray(d.items) ? d.items : [];
  const discount = Number(d.discount) || 0;
  const taxPercent = Number(d.tax_percent) || 0;
  return { ...d, items, discount, tax_percent: taxPercent, totals: computeTotals(items, discount, taxPercent, d.tax_mode) };
}

/** Freezes the current seller, client and line items for an invoice. Never overwrites an existing snapshot. */
export async function takeSnapshot(organizationId: string, invoiceId: string): Promise<void> {
  const invoice = await prisma.invoices.findFirst({ where: { id: invoiceId, organization_id: organizationId }, include: { customers: true, organizations: true } });
  if (!invoice) return;
  const s = await getOrgSettings(organizationId);
  const seller: SellerSnapshot = {
    name: invoice.organizations.name,
    payee_name: s.payee_name, gstin: s.gstin, logo_data: s.logo_data, brand_color: s.brand_color, upi_id: s.upi_id,
    bank_account_name: s.bank_account_name, bank_account_number: s.bank_account_number, bank_ifsc: s.bank_ifsc, bank_name: s.bank_name,
  };
  const client: ClientSnapshot = { name: invoice.customers.name, company_name: invoice.customers.company_name, email: invoice.customers.email, phone: invoice.customers.phone };
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT items, discount::float8 AS discount, tax_percent::float8 AS tax_percent, tax_mode, notes FROM invoice_details WHERE invoice_id = $1::uuid`,
    invoiceId,
  );
  const details = rows[0] ? { items: rows[0].items, discount: rows[0].discount, tax_percent: rows[0].tax_percent, tax_mode: rows[0].tax_mode, notes: rows[0].notes } : null;
  await prisma.$executeRawUnsafe(
    `INSERT INTO invoice_snapshots (invoice_id, organization_id, seller, client, details)
     VALUES ($1::uuid, $2::uuid, $3::jsonb, $4::jsonb, $5::jsonb)
     ON CONFLICT (invoice_id) DO NOTHING`,
    invoiceId, organizationId, JSON.stringify(seller), JSON.stringify(client), details ? JSON.stringify(details) : null,
  );
}

export async function getSnapshot(invoiceId: string): Promise<InvoiceSnapshot | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT seller, client, details FROM invoice_snapshots WHERE invoice_id = $1::uuid`, invoiceId);
  return rows[0] ? { seller: rows[0].seller, client: rows[0].client, details: rows[0].details ?? null } : null;
}

/**
 * The snapshot for an issued invoice, or null for a draft. An issued invoice that somehow has none (for example created
 * before the backfill ran) gets one now from the current data, so every issued invoice is frozen from then on.
 */
export async function snapshotFor(invoice: { id: string; organization_id: string; status: string }): Promise<InvoiceSnapshot | null> {
  if (invoice.status === "DRAFT") return null;
  const existing = await getSnapshot(invoice.id);
  if (existing) return existing;
  await takeSnapshot(invoice.organization_id, invoice.id);
  return getSnapshot(invoice.id);
}

/** Pull the business's CURRENT payment details into one invoice's snapshot. Returns false when there is nothing to update. */
export async function refreshPaymentDetails(organizationId: string, invoiceId: string): Promise<boolean> {
  const s = await getOrgSettings(organizationId);
  const patch: Record<string, string | null> = {};
  for (const f of PAYMENT_FIELDS) patch[f] = s[f];
  const n = await prisma.$executeRawUnsafe(
    `UPDATE invoice_snapshots SET seller = seller || $3::jsonb WHERE invoice_id = $1::uuid AND organization_id = $2::uuid`,
    invoiceId, organizationId, JSON.stringify(patch),
  );
  return n > 0;
}

/** True when the business's current payment details differ from the ones frozen on this invoice. */
export async function paymentDetailsChanged(organizationId: string, snap: InvoiceSnapshot | null): Promise<boolean> {
  if (!snap) return false;
  const s = await getOrgSettings(organizationId);
  return PAYMENT_FIELDS.some((f) => (s[f] ?? null) !== (snap.seller[f] ?? null));
}
