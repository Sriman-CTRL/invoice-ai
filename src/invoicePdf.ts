import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { InvoiceDetail, OrgSettings } from "./types";
import { amountInWords } from "./amountInWords";
import { PAIVO_BADGE_PNG, PAIVO_BADGE_RATIO } from "./lib/paivoBadgePng";

export const PUBLIC_BASE_URL = "https://paivo.in";

type Rgb = [number, number, number];
const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [226, 232, 240];
const DEFAULT_BRAND: Rgb = [79, 70, 229];
const hexToRgb = (h?: string | null): Rgb | null => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};
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

  const BRAND: Rgb = hexToRgb(st?.brand_color) ?? DEFAULT_BRAND;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const set = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);

  // Letterhead band
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 38, "F");
  let logoDrawn = false;
  if (st?.logo_data) {
    try {
      const props = doc.getImageProperties(st.logo_data);
      const box = 18;
      const scale = Math.min(box / props.width, box / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, 10, box + 2, box + 2, 3, 3, "F");
      doc.addImage(st.logo_data, props.fileType, M + 1 + (box - w) / 2, 11 + (box - h) / 2, w, h);
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc.setFillColor(...BRAND);
    doc.roundedRect(M, 11, 16, 16, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text((org[0] || "P").toUpperCase(), M + 8, 22, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(org, M + (logoDrawn ? 24 : 21), 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(165, 180, 252);
  doc.text(st?.gstin ? `GSTIN: ${st.gstin}` : "Tax invoice", M + (logoDrawn ? 24 : 21), 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", W - M, 21, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`# ${inv.invoice_number}`, W - M, 27, { align: "right" });

  doc.setFillColor(...BRAND);
  doc.rect(0, 38, W, 1.6, "F");

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
  doc.text(fin.settled_by_credit ? (fin.paid_amount > 0 ? "SETTLED (PAYMENT + CREDIT NOTE)" : "SETTLED BY CREDIT NOTE") : inv.status.replace(/_/g, " "), mx + 24, y + 14);

  // Line items
  y = 88;
  doc.setFillColor(248, 250, 252);
  doc.rect(M, y, W - 2 * M, 9, "F");
  label("Description", M + 3, y + 6);
  label("Qty", W - M - 74, y + 6);
  label("Rate", W - M - 46, y + 6);
  label("Amount", W - M - 3, y + 6);
  y += 16;
  const lines = data.details?.items?.length
    ? data.details.items
    : [{ description: `Professional services - ${inv.invoice_number}`, quantity: 1, rate: Number(fin.invoice_amount), amount: Number(fin.invoice_amount) }];
  const H0 = doc.internal.pageSize.getHeight();
  for (const li of lines) {
    const wrapped = doc.splitTextToSize(li.description, W - 2 * M - 100) as string[];
    const rowH = Math.max(7, wrapped.length * 4.6 + 2.4);
    if (y + rowH > H0 - 60) { doc.addPage(); y = 24; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); set(INK);
    doc.text(wrapped, M + 3, y);
    doc.setFont("helvetica", "normal"); set(MUTED);
    doc.text(String(li.quantity), W - M - 74, y);
    doc.text(inr(li.rate, currency), W - M - 46, y);
    set(INK); doc.setFont("helvetica", "bold");
    doc.text(inr(li.amount, currency), W - M - 3, y, { align: "right" });
    y += rowH;
    doc.setDrawColor(...LINE);
    doc.line(M, y - 3.2, W - M, y - 3.2);
  }

  // Totals
  if (y > H0 - 80) { doc.addPage(); y = 24; }
  y += 4;
  const tx = W - M - 78;
  const row = (l: string, v: string, bold = false, color: Rgb = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    set(bold ? color : MUTED);
    doc.text(l, tx, y);
    set(color);
    doc.text(v, W - M - 3, y, { align: "right" });
    y += bold ? 8 : 6.5;
  };
  const dt = data.details?.totals;
  const half = (data.details?.tax_percent ?? 0) / 2;
  row("Subtotal", inr(dt ? dt.subtotal : fin.invoice_amount, currency));
  if (dt && dt.discount > 0) row("Discount", `- ${inr(dt.discount, currency)}`, false, GREEN);
  if (dt && data.details?.tax_mode === "GST_INTRA") {
    row(`CGST ${half}%`, inr(dt.cgst, currency));
    row(`SGST ${half}%`, inr(dt.sgst, currency));
  }
  if (dt && data.details?.tax_mode === "GST_INTER") row(`IGST ${data.details?.tax_percent}%`, inr(dt.igst, currency));
  if (dt && dt.tax > 0) row("Invoice total", inr(dt.total, currency), false, INK);
  if (fin.paid_amount > 0) row("Payments received", `- ${inr(fin.paid_amount, currency)}`, false, GREEN);
  if ((fin.tds_amount ?? 0) > 0) row("TDS deducted by client", `- ${inr(Number(fin.tds_amount), currency)}`, false, GREEN);
  if ((fin.credited_amount ?? 0) > 0) row("Credit notes", `- ${inr(Number(fin.credited_amount), currency)}`, false, GREEN);
  doc.setDrawColor(...INK);
  doc.line(tx, y - 3, W - M, y - 3);
  y += 2;
  row("Balance due", inr(fin.outstanding_amount, currency), true, paid ? GREEN : INK);

  // Invoice total in words (Indian numbering). Only for rupee invoices.
  const totalWords = currency === "INR" ? amountInWords(Number(dt ? dt.total : fin.invoice_amount)) : null;
  if (totalWords) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); set(MUTED);
    const wordLines = doc.splitTextToSize(`Invoice total in words: ${totalWords}`, W - 2 * M) as string[];
    doc.text(wordLines, W - M - 3, y, { align: "right" });
    y += wordLines.length * 4 + 2;
  }

  if (data.details?.notes) {
    y += 2;
    label("Note", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); set(INK);
    const noteLines = doc.splitTextToSize(data.details.notes, W - 2 * M) as string[];
    doc.text(noteLines.slice(0, 5), M, y + 5);
    y += 5 + Math.min(noteLines.length, 5) * 4.4;
  }

  // TDS summary
  const rate = opts.tdsRate ?? 10;
  const section = opts.tdsSection ?? "194J";
  const base = Number(dt ? dt.taxable : fin.invoice_amount); // TDS applies to the amount before GST
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
  let qy = Math.max(y + 36, 170);
  if (qy + 54 > doc.internal.pageSize.getHeight() - 24) { doc.addPage(); qy = 24; }
  doc.setDrawColor(...LINE);
  doc.roundedRect(M, qy, W - 2 * M, 52, 3, 3, "S");
  const cleanOrg = (st?.payee_name || org).replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 25) || "Payee";
  const upiId = st?.upi_id || "";
  const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(cleanOrg)}&am=${Number(fin.outstanding_amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv.invoice_number}`)}`;
  if (!paid && fin.outstanding_amount > 0 && upiId && currency === "INR") {
    const qr = await QRCode.toDataURL(upi, { width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } });
    doc.addImage(qr, "PNG", M + 5, qy + 6, 40, 40);
  } else {
    doc.setFillColor(...(paid ? ([236, 253, 245] as Rgb) : ([241, 245, 249] as Rgb)));
    doc.roundedRect(M + 5, qy + 6, 40, 40, 3, 3, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(paid ? 11 : 8); set(paid ? GREEN : MUTED);
    doc.text(paid ? (fin.settled_by_credit ? "SETTLED" : "PAID") : "Pay via link", M + 25, qy + 27, { align: "center" });
  }
  const px = M + 52;
  label(paid ? (fin.settled_by_credit ? "Settled by credit note" : "Payment received") : "Scan to pay with any UPI app", px, qy + 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); set(MUTED);
  doc.text(paid ? "Thank you. This invoice is settled in full." : upiId && currency === "INR" ? `UPI: ${upiId} (zero fees)` : "Use the link below to pay.", px, qy + 16);
  if (!paid && st?.bank_account_number && st.bank_ifsc) {
    doc.setFontSize(8);
    doc.text(`Bank: ${st.bank_account_name || org} | A/C ${st.bank_account_number} | IFSC ${st.bank_ifsc}`, px, qy + 21);
  }
  label("Pay online / submit UTR", px, qy + 27);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); set(BRAND);
  doc.textWithLink(payUrl, px, qy + 33, { url: payUrl });

  // Final-files badge
  const ext = inv.external_invoice_id || "";
  const hasVault = ext.startsWith("vault:") || ext.startsWith("http");
  if (hasVault) {
    const bx = px;
    const by = qy + 38;
    doc.setFillColor(...(paid ? ([209, 250, 229] as Rgb) : ([254, 243, 199] as Rgb)));
    doc.roundedRect(bx, by, 78, 8, 4, 4, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); set(paid ? GREEN : AMBER);
    doc.text(paid ? "FINAL FILES: UNLOCKED" : "FINAL FILES: LOCKED UNTIL PAID", bx + 39, by + 5.2, { align: "center" });
  }

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE);
  doc.line(M, H - 20, W - M, H - 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); set(MUTED);
  doc.text(`${org} - Deliverables unlock once payment is confirmed.`, M, H - 14);
  doc.text("Computer-generated invoice; no signature required.", M, H - 9.5);
  // Small "Powered by Paivo" badge, bottom right. The seller's details stay primary.
  const badgeH = 5.2, badgeW = badgeH * PAIVO_BADGE_RATIO;
  doc.setFontSize(7);
  doc.text("Powered by", W - M - badgeW - 1.5, H - 9.5, { align: "right" });
  doc.addImage(PAIVO_BADGE_PNG, "PNG", W - M - badgeW, H - 9.5 - badgeH + 1.2, badgeW, badgeH);

  doc.setProperties({ title: `Invoice ${inv.invoice_number}`, subject: `Invoice for ${customer.name}`, creator: "Paivo" });
  return doc;
}

export async function downloadInvoicePdf(data: InvoiceDetail, opts?: InvoicePdfOptions) {
  const doc = await buildInvoicePdf(data, opts);
  doc.save(`${data.invoice.invoice_number}.pdf`);
}
