import type {
  CollectionAction,
  Conversation,
  ConversationDetail,
  Customer,
  CustomerDetail,
  Dashboard,
  Invoice,
  InvoiceDetail,
  Message,
  OverdueProcessResult,
  Payment,
  User,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorizedHandler = handler;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("ledgerlane_token");
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(0, "Unable to reach the server. Please check your network connection.");
  }

  let body: any = {};
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = {};
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorizedHandler?.();
      throw new ApiError(401, body?.error || "Your session has expired. Please sign in again.");
    }
    if (response.status === 403) {
      throw new ApiError(403, body?.error || "You do not have permission to access this resource.");
    }
    if (response.status === 404) {
      throw new ApiError(404, body?.error || "The requested record was not found.");
    }
    const message = body?.error || body?.message || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, body?.detail);
  }

  return body as T;
}

export const authApi = {
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: { email: string; password: string; name: string; organization_name: string }) =>
    request<{ user: User; organization: { id: string; name: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const dashboardApi = {
  get: () => request<Dashboard>("/dashboard"),
};

export const invoicesApi = {
  list: (status?: string) =>
    request<Invoice[]>(`/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`),

  detail: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),

  create: (data: {
    customer_id: string;
    invoice_number: string;
    amount: number;
    currency?: string;
    issued_at: string;
    due_at: string;
    status?: string;
    external_invoice_id?: string;
  }) =>
    request<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const customersApi = {
  list: () => request<Customer[]>("/customers"),

  detail: (id: string) => request<CustomerDetail>(`/customers/${id}`),

  create: (data: {
    name: string;
    email: string;
    company_name?: string;
    phone?: string;
    external_customer_id?: string;
  }) =>
    request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const conversationsApi = {
  list: () => request<Conversation[]>("/conversations"),

  detail: (id: string) => request<ConversationDetail>(`/conversations/${id}`),

  create: (data: {
    customer_id: string;
    invoice_id?: string | null;
    channel: string;
    external_thread_id?: string;
  }) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const messagesApi = {
  listForConversation: (conversationId: string) =>
    request<Message[]>(`/messages/conversation/${conversationId}`),

  create: (data: {
    conversation_id: string;
    direction: "INBOUND" | "OUTBOUND";
    channel: string;
    sender: string;
    recipient?: string;
    subject?: string;
    body: string;
  }) =>
    request<Message>("/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  classify: (messageId: string) =>
    request<{
      message_id: string;
      classification: {
        intent: string;
        confidence: number;
        promised_date: string | null;
        promised_amount: number | null;
        reason: string;
      };
      collection_action: any;
    }>(`/messages/${messageId}/classify`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

export const collectionActionsApi = {
  list: (params?: {
    status?: string;
    action_type?: string;
    customer_id?: string;
    invoice_id?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.action_type) q.set("action_type", params.action_type);
    if (params?.customer_id) q.set("customer_id", params.customer_id);
    if (params?.invoice_id) q.set("invoice_id", params.invoice_id);
    const qs = q.toString();
    return request<{ value: CollectionAction[]; Count: number }>(
      `/collection-actions${qs ? `?${qs}` : ""}`
    );
  },

  detail: (id: string) => request<CollectionAction>(`/collection-actions/${id}`),

  updateStatus: (id: string, status: string) =>
    request<CollectionAction>(`/collection-actions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// Aliased for convenience
export const actionsApi = collectionActionsApi;

export const overdueInvoicesApi = {
  process: () =>
    request<OverdueProcessResult>("/overdue-invoices/process", {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

export const paymentsApi = {
  list: (invoiceId?: string) =>
    request<Payment[]>(`/payments${invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ""}`),

  create: (data: {
    invoice_id: string;
    amount: number;
    currency?: string;
    status?: string;
    paid_at?: string;
    external_payment_id?: string;
  }) =>
    request<{ payment: Payment; invoice: Invoice; totalPaid: number }>("/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const systemApi = {
  health: () => request<{ status: string; database: string }>("/health"),
};
