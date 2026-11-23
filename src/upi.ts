// Builds the standard NPCI UPI payment link (upi://pay). Parameter names follow the NPCI UPI linking spec:
// pa = payee address, pn = payee name, am = amount, cu = currency, tn = note.
// The amount always comes from the server's outstanding balance; never from user input.
export interface UpiLinkInput {
  upiId: string;
  payeeName: string;
  amount: number;
  invoiceNumber: string;
}

export function buildUpiUri({ upiId, payeeName, amount, invoiceNumber }: UpiLinkInput): string {
  const payee = payeeName.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 25);
  const inv = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "");
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv}`)}`;
}
