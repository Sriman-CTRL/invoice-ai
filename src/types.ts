export type User = { id: string; email: string; name: string | null; organization_id: string; has_password?: boolean; google_linked?: boolean };
export type Customer = { id: string; name: string; email: string; company_name: string | null; phone: string | null; created_at: string };
export type Invoice = { id: string; customer_id: string; invoice_number: string; amount: number | string; currency: string; issued_at: string | null; due_at: string | null; status: string; created_at: string; external_invoice_id?: string | null; customers?: Customer };
export type Payment = { id: string; invoice_id: string; amount: number | string; tds_amount?: number | string; tds_section?: string | null; currency: string; status: string; paid_at: string | null; created_at: string };
export type Conversation = { id: string; customer_id: string; invoice_id: string | null; channel: string; status: string; created_at: string; updated_at: string };
export type Message = { id: string; direction: "INBOUND" | "OUTBOUND"; channel: string; sender: string | null; recipient: string | null; subject: string | null; body: string | null; ai_intent: string | null; ai_confidence: number | string | null; created_at: string };
export type CollectionAction = { id: string; customer_id: string | null; invoice_id: string | null; conversation_id: string | null; action_type: string; status: string; scheduled_at: string | null; executed_at: string | null; created_at: string; metadata?: Record<string, unknown>; customers?: Customer; invoices?: Invoice };
export type Dashboard = { invoice_summary: Record<string, number>; financial_summary: { total_invoiced: number; total_paid: number; total_outstanding: number; overdue_outstanding: number; currency: string }; customer_summary: { total_customers: number; customers_with_outstanding: number; customers_with_overdue: number }; collection_summary: Record<string, number>; recent_activity: { invoices: Invoice[]; payments: Payment[]; collection_actions: CollectionAction[] } };
export type InvoiceDetail = { invoice: Invoice; customer: Customer; financial_summary: { invoice_amount: number; paid_amount: number; tds_amount?: number; credited_amount?: number; settled_by_credit?: boolean; outstanding_amount: number; currency: string }; payments: Payment[]; conversation: Conversation | null; conversations: Conversation[]; collection_actions: CollectionAction[]; details: InvoiceExtras | null; views: { count: number; last_viewed_at: string | null } };
export type InvoiceLine = { description: string; quantity: number; rate: number; amount: number };
export type InvoiceTotals = { subtotal: number; discount: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number; total: number };
export type InvoiceExtras = { items: InvoiceLine[]; discount: number; tax_percent: number; tax_mode: "NONE" | "GST_INTRA" | "GST_INTER"; notes: string | null; totals: InvoiceTotals };
export type ActivityEvent = { type: "viewed" | "paid" | "proof"; invoice_id: string; invoice_number: string; customer_name: string; at: string; amount: number | null; currency: string };
export type CustomerDetail = { customer: Customer; summary: { total_invoices: number; total_invoiced: number; total_paid: number; total_outstanding: number; overdue_amount: number }; invoices: Invoice[]; payments: Payment[]; conversations: Conversation[]; collection_actions: CollectionAction[] };
export type ConversationDetail = { conversation: Conversation; customer: Customer; invoice: Invoice | null; messages: Message[]; collection_actions: CollectionAction[] };
export type PublicInvoiceDetail = {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  /** TDS the client deducted on confirmed payments; it counts toward what is paid. */
  tds_amount?: number;
  /** Credit notes issued against this invoice; they reduce what is owed. */
  credited_amount?: number;
  /** True when the invoice is settled because credit notes covered the rest (show "Settled by credit note", not "Paid"). */
  settled_by_credit?: boolean;
  outstanding_amount: number;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  status: string;
  customer: { name: string; company_name: string | null; email: string | null; phone: string | null };
  organization: { name: string; slug: string; brand_color?: string | null; logo_data?: string | null; gstin?: string | null };
  details?: { items: InvoiceLine[]; notes: string | null; tax_mode: "NONE" | "GST_INTRA" | "GST_INTER"; tax_percent: number; totals: InvoiceTotals } | null;
  payment: {
    upi_id: string | null;
    payee_name: string;
    bank: { account_name: string; account_number: string; ifsc: string; bank_name: string | null } | null;
  };
  has_deliverable: boolean;
  deliverable_url: string | null;
  deliverable_locked: boolean;
  pending_verification: boolean;
  pending_utr: string | null;
};

export type OrgSettings = {
  upi_id: string | null;
  payee_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  gstin: string | null;
  brand_color?: string | null;
  logo_data?: string | null;
  plan: "FREE" | "PRO" | "AGENCY";
  auto_reminders?: boolean;
};
