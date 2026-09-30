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
export const invoicesApi = { list: (status?: string) => request<Invoice[]>(`/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`), detail: (id: string) => request<InvoiceDetail>(`/invoices/${id}`) };
export const customersApi = { list: () => request<Customer[]>("/customers"), detail: (id: string) => request<CustomerDetail>(`/customers/${id}`) };
export const conversationsApi = { list: () => request<Conversation[]>("/conversations"), detail: (id: string) => request<ConversationDetail>(`/conversations/${id}`) };
export const paymentsApi = { list: (invoiceId?: string) => request<Payment[]>(`/payments${invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ""}`) };
export const actionsApi = { list: (status?: string) => request<{ value: CollectionAction[]; Count: number }>(`/collection-actions${status ? `?status=${encodeURIComponent(status)}` : ""}`), updateStatus: (id: string, status: string) => request<CollectionAction>(`/collection-actions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }) };
