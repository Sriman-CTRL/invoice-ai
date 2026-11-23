import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { InvoiceDetail, OrgSettings } from "./types";

export const PUBLIC_BASE_URL = "https://invoice-ai-nine-beta.vercel.app";

type Rgb = [number, number, number];
const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [226, 232, 240];
const BRAND: Rgb = [79, 70, 229];
const GREEN: Rgb = [5, 150, 105];
const AMBER: Rgb = [180, 83, 9];

// jsPDF core fonts have no ₹ glyph, so we use the ISO code.
const inr = (value: number | string, currency = "INR") =>
  `${currency} ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`;
const fmtDate = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(v)) : "-";

export interface InvoicePdfOptions {
  organizationName?: string;
  /** Optional TDS rate (percent) to preview in the TDS summary, e.g. 1, 2, 10. */
  tdsRate?: number;
  tdsSection?: string;
  /** The seller's own payment details (UPI ID, bank, GSTIN). */
  settings?: OrgSettings | null;
}

/** Builds a branded A4 invoice PDF entirely in the browser. Returns the jsPDF doc. */
export async function buildInvoicePdf(data: InvoiceDetail, opts: InvoicePdfOptions = {}): Promise<jsPDF> {
  const { invoice: inv, customer, financial_summary: fin } = data;
  const st = opts.settings || null;
  const org = opts.organizationName || "Your Company";
  const currency = fin.currency || inv.currency || "INR";
  const paid = inv.status === "PAID";
  const payUrl = `${PUBLIC_BASE_URL}/pay/${inv.id}`;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const set = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);

  // Letterhead band
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 38, "F");
  doc.setFillColor(...BRAND);
  doc.roundedRect(M, 11, 16, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text((org[0] || "L").toUpperCase(), M + 8, 22, { align: "center" });
  doc.setFontSize(16);
  doc.text(org, M + 21, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(165, 180, 252);
  doc.text(st?.gstin ? `GSTIN: ${st.gstin}` : "Powered by LedgerLane", M + 21, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", W - M, 21, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`# ${inv.invoice_number}`, W - M, 27, { align: "right" });

  // Meta + Bill To
  let y = 50;
  const label = (t: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    set(MUTED);
    doc.text(t.toUpperCase(), x, yy);
  };
  const val = (t: string, x: number, yy: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    set(INK);
    doc.text(t, x, yy);
  };

  label("Billed to", M, y);
  val(customer.company_name || customer.name, M, y + 6, true);
  let cy = y + 11;
  if (customer.company_name && customer.name) { val(customer.name, M, cy); cy += 5; }
  doc.setFontSize(9);
  set(MUTED);
  doc.text(customer.email, M, cy); cy += 4.5;
  if (customer.phone) { doc.text(customer.phone, M, cy); cy += 4.5; }
  const gstin = (customer as unknown as { gstin?: string; tax_id?: string }).gstin || (customer as unknown as { tax_id?: string }).tax_id;
  doc.text(`GSTIN / Tax ID: ${gstin || "Not provided"}`, M, cy);

  const mx = W - M - 62;
  label("Issued", mx, y); val(fmtDate(inv.issued_at || inv.created_at), mx + 24, y);
  label("Due", mx, y + 7); val(fmtDate(inv.due_at), mx + 24, y + 7);
  label("Status", mx, y + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  set(paid ? GREEN : AMBER);
  doc.text(inv.status.replace(/_/g, " "), mx + 24, y + 14);

  // Line items
  y = 88;
  doc.setFillColor(248, 250, 252);
  doc.rect(M, y, W - 2 * M, 9, "F");
  label("Description", M + 3, y + 6);
  label("Qty", W - M - 62, y + 6);
  label("Amount", W - M - 3, y + 6);
  y += 16;
  val(`Professional services - ${inv.invoice_number}`, M + 3, y, true);
  doc.setFontSize(8.5); set(MUTED);
  doc.text(`Billed to ${customer.company_name || customer.name}`, M + 3, y + 5);
  val("1", W - M - 62, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); set(INK);
  doc.text(inr(fin.invoice_amount, currency), W - M - 3, y, { align: "right" });
  y += 11;
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);

  // Totals
  y += 8;
  const tx = W - M - 70;
  const row = (l: string, v: string, bold = false, color: Rgb = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    set(bold ? color : MUTED);
    doc.text(l, tx, y);
    set(color);
    doc.text(v, W - M - 3, y, { align: "right" });
    y += bold ? 8 : 6.5;
  };
  row("Subtotal", inr(fin.invoice_amount, currency));
  if (fin.paid_amount > 0) row("Payments received", `- ${inr(fin.paid_amount, currency)}`, false, GREEN);
  doc.setDrawColor(...INK);
  doc.line(tx, y - 3, W - M, y - 3);
  y += 2;
  row("Balance due", inr(fin.outstanding_amount, currency), true, paid ? GREEN : INK);

  // TDS summary
  const rate = opts.tdsRate ?? 10;
  const section = opts.tdsSection ?? "194J";
  const base = Number(fin.invoice_amount);
  const tds = +(base * (rate / 100)).toFixed(2);
  y += 4;
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(M, y, 98, 28, 2, 2, "F");
  label("TDS deduction summary", M + 4, y + 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); set(INK);
  doc.text(`Section ${section} @ ${rate}%`, M + 4, y + 12.5);
  doc.text(`TDS to be withheld: ${inr(tds, currency)}`, M + 4, y + 18);
  doc.setFont("helvetica", "bold");
  doc.text(`Net bank deposit: ${inr(base - tds, currency)}`, M + 4, y + 23.5);

  // UPI QR + pay link
  const qy = Math.max(y + 36, 170);
  doc.setDrawColor(...LINE);
  doc.roundedRect(M, qy, W - 2 * M, 52, 3, 3, "S");
  const cleanOrg = (st?.payee_name || org).replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 25) || "Payee";
  const upiId = st?.upi_id || "";
  const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(cleanOrg)}&am=${Number(fin.outstanding_amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv.invoice_number}`)}`;
  if (!paid && fin.outstanding_amount > 0 && upiId) {
    const qr = await QRCode.toDataURL(upi, { width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } });
    doc.addImage(qr, "PNG", M + 5, qy + 6, 40, 40);
  } else {
    doc.setFillColor(...(paid ? ([236, 253, 245] as Rgb) : ([241, 245, 249] as Rgb)));
    doc.roundedRect(M + 5, qy + 6, 40, 40, 3, 3, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(paid ? 11 : 8); set(paid ? GREEN : MUTED);
    doc.text(paid ? "PAID" : "Pay via link", M + 25, qy + 27, { align: "center" });
  }
  const px = M + 52;
  label(paid ? "Payment received" : "Scan to pay with any UPI app", px, qy + 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); set(MUTED);
  doc.text(paid ? "Thank you. This invoice is settled in full." : upiId ? `UPI: ${upiId} (zero fees)` : "Use the secure link below to pay.", px, qy + 16);
  if (!paid && st?.bank_account_number && st.bank_ifsc) {
    doc.setFontSize(8);
    doc.text(`Bank: ${st.bank_account_name || org} | A/C ${st.bank_account_number} | IFSC ${st.bank_ifsc}`, px, qy + 21);
  }
  label("Pay online / submit UTR", px, qy + 27);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); set(BRAND);
  doc.textWithLink(payUrl, px, qy + 33, { url: payUrl });

  // Vault badge
  const ext = inv.external_invoice_id || "";
  const hasVault = ext.startsWith("vault:") || ext.startsWith("http");
  if (hasVault) {
    const bx = px;
    const by = qy + 38;
    doc.setFillColor(...(paid ? ([209, 250, 229] as Rgb) : ([254, 243, 199] as Rgb)));
    doc.roundedRect(bx, by, 78, 8, 4, 4, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); set(paid ? GREEN : AMBER);
    doc.text(paid ? "DELIVERABLE VAULT: UNLOCKED" : "DELIVERABLE VAULT: HELD IN ESCROW", bx + 39, by + 5.2, { align: "center" });
  }

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE);
  doc.line(M, H - 20, W - M, H - 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); set(MUTED);
  doc.text(`${org} - Generated with LedgerLane. Deliverables unlock once payment is confirmed.`, M, H - 14);
  doc.text("Computer-generated invoice; no signature required.", M, H - 9.5);

  doc.setProperties({ title: `Invoice ${inv.invoice_number}`, subject: `Invoice for ${customer.name}`, creator: "LedgerLane" });
  return doc;
}

export async function downloadInvoicePdf(data: InvoiceDetail, opts?: InvoicePdfOptions) {
  const doc = await buildInvoicePdf(data, opts);
  doc.save(`${data.invoice.invoice_number}.pdf`);
}
