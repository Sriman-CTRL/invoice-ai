import type { ActivityEvent, OrgSettings, CollectionAction, Conversation, ConversationDetail, Customer, CustomerDetail, Dashboard, Invoice, InvoiceDetail, Payment, PublicInvoiceDetail, User } from "./types";

const BASE_URL = import.meta.env.PROD ? "/api" : (import.meta.env.VITE_API_BASE_URL || "/api");
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => { onUnauthorized = handler; };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("ledgerlane_token");
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      throw new ApiError(response.status, body.error || (response.status === 403 ? "You do not have access to this resource." : "We could not complete that request."));
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "Unable to reach the service. Check your connection and try again.");
  }
}

export const authApi = {
  register: (data: { email: string; password: string; name: string; organization_name: string; accepted_terms?: boolean; heard_from?: string; attribution?: object; turnstile_token?: string }) => request<{ user: User; organization: { id: string; name: string } }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  google: (data: { id_token: string; accepted_terms?: boolean; heard_from?: string; attribution?: object }) => request<{ token: string; user: User }>("/auth/google", { method: "POST", body: JSON.stringify(data) }),
};
export const accountApi = {
  linkGoogle: (id_token: string) => request<{ success: boolean; google_linked: boolean }>("/auth/google/link", { method: "POST", body: JSON.stringify({ id_token }) }),
  deleteAccount: (data: { password?: string; confirm: string; id_token?: string }) => request<{ success: boolean }>("/auth/account", { method: "DELETE", body: JSON.stringify(data) }),
  changePassword: (data: { current_password?: string; new_password: string; id_token?: string }) => request<{ success: boolean; message: string }>("/auth/password", { method: "PUT", body: JSON.stringify(data) }),
};
export type AnalyticsData = {
  months: Array<{ month: string; received: number; invoiced: number }>;
  top_clients: Array<{ id: string; name: string; company_name: string | null; paid: number; invoices: number }>;
  kpi: { lifetime_received: number; outstanding: number; overdue: number; avg_days_to_pay: number | null; paid_count: number; sent_count: number };
};
export type GstRow = { invoice_number: string; date: string; customer: string; currency: string; status: string; taxable: number; cgst: number; sgst: number; igst: number; total: number; gst_rate: number };
export const analyticsApi = {
  get: () => request<AnalyticsData>("/dashboard/analytics"),
  gstReport: (from: string, to: string) => request<{ from: string; to: string; rows: GstRow[] }>(`/dashboard/gst-report?from=${from}&to=${to}`),
};
export const dashboardApi = { get: () => request<Dashboard>("/dashboard") };
export const invoicesApi = {
  list: (status?: string) => request<Invoice[]>(`/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  detail: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
  create: (data: { customer_id: string; invoice_number: string; amount?: number; currency?: string; issued_at: string; due_at: string; external_invoice_id?: string; status?: string; items?: Array<{ description: string; quantity: number; rate: number }>; discount?: number; tax_mode?: string; tax_percent?: number; notes?: string }) => request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  approve: (id: string) => request<{ ok: boolean }>(`/invoices/${id}/approve`, { method: "POST" }),
  aiItems: (prompt: string, currency: string) => request<{ items: Array<{ description: string; quantity: number; rate: number }> }>("/invoices/meta/ai-items", { method: "POST", body: JSON.stringify({ prompt, currency }) }),
  activity: () => request<{ events: ActivityEvent[]; views: Record<string, { last_viewed_at: string; count: number }> }>("/invoices/meta/activity"),
  bulkImport: (invoices: Array<{
    customer_name?: string;
    customer_email: string;
    company_name?: string;
    phone?: string;
    invoice_number: string;
    amount: number;
    currency?: string;
    issued_at?: string;
    due_at: string;
    status?: string;
    external_invoice_id?: string;
  }>) => request<{
    imported_count: number;
    customers_created: number;
    skipped_count: number;
    errors: string[];
  }>("/invoices/bulk-import", { method: "POST", body: JSON.stringify({ invoices }) }),
  emailStatus: () => request<{ email_enabled: boolean; payment_ready: boolean }>("/invoices/meta/email-status"),
  sendReminder: (id: string, data?: { subject?: string; body?: string; deliver?: boolean }) =>
    request<{ success: boolean; message: any; collection_action: any }>(`/invoices/${id}/send-reminder`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
};
export type RecurringRow = {
  id: string; customer_id: string; customer_name: string; frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"; next_run: string; active: boolean; runs: number;
  template: { items: Array<{ description: string; quantity: number; rate: number }>; discount: number; tax_mode: string; tax_percent: number; currency: string };
};
export const recurringApi = {
  list: () => request<RecurringRow[]>("/recurring"),
  create: (data: { customer_id: string; frequency: string; first_run: string; currency: string; terms_days: number; prefix: string; deliverable?: string; items: Array<{ description: string; quantity: number; rate: number }>; discount: number; tax_mode: string; tax_percent: number; notes?: string }) =>
    request<{ id: string }>("/recurring", { method: "POST", body: JSON.stringify(data) }),
  setActive: (id: string, active: boolean) => request<{ ok: boolean }>(`/recurring/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  remove: (id: string) => request<{ ok: boolean }>(`/recurring/${id}`, { method: "DELETE" }),
};
export const customersApi = {
  list: () => request<Customer[]>("/customers"),
  detail: (id: string) => request<CustomerDetail>(`/customers/${id}`),
  create: (data: { name: string; email: string; company_name?: string; phone?: string }) => request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),
  portalLink: (id: string) => request<{ url: string }>(`/customers/${id}/portal-link`),
  erasure: (id: string) => request<{ status: string; legal_notice: string }>(`/customers/${id}/erasure`, { method: "POST" }),
  export: (id: string) => request<any>(`/customers/${id}/export`),
};
export const conversationsApi = { list: () => request<Conversation[]>("/conversations"), detail: (id: string) => request<ConversationDetail>(`/conversations/${id}`) };
export const paymentsApi = {
  list: (invoiceId?: string) => request<Payment[]>(`/payments${invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ""}`),
  create: (data: { invoice_id: string; amount: number; paid_at?: string; external_payment_id?: string }) =>
    request<Payment>("/payments", { method: "POST", body: JSON.stringify(data) }),
};
export const creditNotesApi = {
  list: (invoiceId?: string) => request<any[]>(`/credit-notes${invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ""}`),
  create: (data: { invoice_id: string; amount: number; reason: string }) => request<any>("/credit-notes", { method: "POST", body: JSON.stringify(data) }),
};
export const complianceApi = {
  getSuppressions: () => request<Array<{ id: string; address: string; reason: string; created_at: string }>>("/compliance/suppressions"),
  addSuppression: (data: { address: string; reason?: string }) => request<any>("/compliance/suppressions", { method: "POST", body: JSON.stringify(data) }),
  authorizeSend: (data: { customer_id?: string; customer_email?: string; invoice_id?: string; channel?: string }) =>
    request<{ allowed: boolean; reason?: string; disclosure_footer: string }>("/compliance/authorize-send", { method: "POST", body: JSON.stringify(data) }),
};
export const actionsApi = {
  list: (status?: string) => request<{ value: CollectionAction[]; Count: number }>(`/collection-actions${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  updateStatus: (id: string, status: string) => request<CollectionAction>(`/collection-actions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  verifyProof: (id: string) => request<{ success: boolean; message: string; invoice: any; payment: any; action: any }>(`/collection-actions/${id}/verify-proof`, { method: "POST", body: JSON.stringify({}) }),
};
export const messagesApi = {
  ingest: (data: { from: string; subject?: string; text?: string; html?: string; invoice_number?: string }) => request<any>("/messages/ingest", { method: "POST", body: JSON.stringify(data) }),
  classify: (id: string) => request<any>(`/messages/${id}/classify`, { method: "POST", body: JSON.stringify({}) }),
};
export const organizationsApi = {
  me: () => request<{ organization: { id: string; name: string; slug: string }; inbox_address: string }>("/organizations/me"),
  updateMe: (data: { name?: string; slug?: string }) => request<{ organization: { id: string; name: string; slug: string }; inbox_address: string }>("/organizations/me", { method: "PATCH", body: JSON.stringify(data) }),
};
export const settingsApi = {
  get: () => request<OrgSettings>("/organizations/settings"),
  save: (data: Partial<Omit<OrgSettings, "plan">>) => request<OrgSettings>("/organizations/settings", { method: "PUT", body: JSON.stringify(data) }),
  upgrade: (data: { plan: "PRO" | "AGENCY"; utr: string }) => request<{ success: boolean; message: string }>("/organizations/upgrade-request", { method: "POST", body: JSON.stringify(data) }),
};
export type PlanRequest = { id: string; plan: string; utr: string; status: string; created_at: string; organization_id: string; organization_name: string; current_plan: string; owner_email: string | null };
export type AdminAnalytics = {
  days: number;
  daily: Array<{ day: string; views: number; visitors: number }>;
  pages: Array<{ path: string; views: number }>;
  referrers: Array<{ referrer: string; visits: number }>;
  heard: Array<{ answer: string; signups: number }>;
  sources: Array<{ source: string; medium: string; campaign: string; visitors: number; signups: number }>;
  funnel: { landing: number; pricing: number; register_page: number; signups: number; activated: number };
  totals: { organizations: number; paid_organizations: number; pending_upgrades: number };
};
/** Fetches the payment screenshot for a proof action as a short-lived blob URL (auth header required). */
export async function fetchProofImage(actionId: string): Promise<string> {
  const token = localStorage.getItem("ledgerlane_token");
  const res = await fetch(`${BASE_URL}/collection-actions/${encodeURIComponent(actionId)}/proof-image`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? "No screenshot was attached to this payment." : "Could not load the screenshot.");
  return URL.createObjectURL(await res.blob());
}
export const leadsApi = {
  submit: (data: { kind: "waitlist" | "feedback"; email?: string; message?: string; plan?: string; website?: string }) =>
    request<{ success: boolean; message: string }>("/leads", { method: "POST", body: JSON.stringify(data) }),
};
export type Lead = { id: string; at: string; kind: string; email: string | null; plan: string | null; message: string | null };
export const adminApi = {
  me: () => request<{ is_admin: boolean }>("/admin/me"),
  planRequests: () => request<PlanRequest[]>("/admin/plan-requests"),
  leads: () => request<{ leads: Lead[]; counts: Record<string, number> }>("/admin/leads"),
  analytics: (days: number) => request<AdminAnalytics>(`/admin/analytics?days=${days}`),
  decide: (id: string, decision: "approve" | "reject") => request<{ success: boolean }>(`/admin/plan-requests/${id}/${decision}`, { method: "POST", body: JSON.stringify({}) }),
};
export const overdueApi = { process: () => request<{ invoices_detected: number; actions_created: number; created_action_ids: string[]; skipped: Array<{ invoice_id: string; reason: string }> }>("/overdue-invoices/process", { method: "POST", body: JSON.stringify({}) }) };
export const publicApi = {
  clientPortal: (customerId: string, token: string) =>
    request<{ organization: { name: string; brand_color: string | null; logo_data: string | null }; customer: { name: string; company_name: string | null }; invoices: Array<{ id: string; invoice_number: string; amount: number; currency: string; status: string; issued_at: string | null; due_at: string | null; outstanding: number }>; outstanding_total: number }>(`/public/client/${customerId}/${token}`),
  getInvoice: (invoiceNumber: string) => request<PublicInvoiceDetail>(`/public/invoices/${encodeURIComponent(invoiceNumber)}`),
  submitProof: (invoiceNumber: string, data: { utr: string; amount?: number; notes?: string; screenshot?: string; turnstile_token?: string }) =>
    request<{ success: boolean; message: string; payment_id: string }>(`/public/invoices/${encodeURIComponent(invoiceNumber)}/submit-proof`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
