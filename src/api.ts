import type { CollectionAction, Conversation, ConversationDetail, Customer, CustomerDetail, Dashboard, Invoice, InvoiceDetail, Payment, User } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
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
  register: (data: { email: string; password: string; name: string; organization_name: string }) => request<{ user: User; organization: { id: string; name: string } }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
};
export const dashboardApi = { get: () => request<Dashboard>("/dashboard") };
export const invoicesApi = {
  list: (status?: string) => request<Invoice[]>(`/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  detail: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
  create: (data: { customer_id: string; invoice_number: string; amount: number; currency?: string; issued_at: string; due_at: string }) => request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(data) }),
};
export const customersApi = {
  list: () => request<Customer[]>("/customers"),
  detail: (id: string) => request<CustomerDetail>(`/customers/${id}`),
  create: (data: { name: string; email: string; company_name?: string; phone?: string }) => request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),
  erasure: (id: string) => request<{ status: string; legal_notice: string }>(`/customers/${id}/erasure`, { method: "POST" }),
  export: (id: string) => request<any>(`/customers/${id}/export`),
};
export const conversationsApi = { list: () => request<Conversation[]>("/conversations"), detail: (id: string) => request<ConversationDetail>(`/conversations/${id}`) };
export const paymentsApi = {
  list: (invoiceId?: string) => request<Payment[]>(`/payments${invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ""}`),
  create: (data: { invoice_id: string; amount: number; paid_at?: string }) => request<Payment>("/payments", { method: "POST", body: JSON.stringify(data) }),
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
export const actionsApi = { list: (status?: string) => request<{ value: CollectionAction[]; Count: number }>(`/collection-actions${status ? `?status=${encodeURIComponent(status)}` : ""}`), updateStatus: (id: string, status: string) => request<CollectionAction>(`/collection-actions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }) };
export const messagesApi = {
  ingest: (data: { from: string; subject?: string; text?: string; html?: string; invoice_number?: string }) => request<any>("/messages/ingest", { method: "POST", body: JSON.stringify(data) }),
  classify: (id: string) => request<any>(`/messages/${id}/classify`, { method: "POST", body: JSON.stringify({}) }),
};
export const organizationsApi = {
  me: () => request<{ organization: { id: string; name: string; slug: string }; inbox_address: string }>("/organizations/me"),
  updateMe: (data: { name?: string; slug?: string }) => request<{ organization: { id: string; name: string; slug: string }; inbox_address: string }>("/organizations/me", { method: "PATCH", body: JSON.stringify(data) }),
};
export const overdueApi = { process: () => request<{ invoices_detected: number; actions_created: number; created_action_ids: string[]; skipped: Array<{ invoice_id: string; reason: string }> }>("/overdue-invoices/process", { method: "POST", body: JSON.stringify({}) }) };
