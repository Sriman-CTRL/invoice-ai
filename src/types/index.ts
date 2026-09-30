export interface User {
  id: string;
  email: string;
  name: string | null;
  organization_id: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  organization_id?: string;
  name: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  external_customer_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  organization_id?: string;
  customer_id: string;
  invoice_number: string;
  external_invoice_id?: string | null;
  amount: number | string;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  status: "DRAFT" | "OPEN" | "PARTIALLY_PAID" | "PAID" | "DISPUTED" | "CANCELLED" | string;
  created_at: string;
  updated_at?: string;
  customers?: Customer;
}

export interface Payment {
  id: string;
  organization_id?: string;
  invoice_id: string;
  external_payment_id?: string | null;
  amount: number | string;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | string;
  paid_at: string | null;
  created_at: string;
  invoices?: {
    invoice_number: string;
  };
}

export interface Conversation {
  id: string;
  organization_id?: string;
  customer_id: string;
  invoice_id: string | null;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PORTAL" | string;
  external_thread_id?: string | null;
  status: "OPEN" | "CLOSED" | "ESCALATED" | string;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  invoices?: Invoice;
}

export type MessageIntent =
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_PROMISED"
  | "PAYMENT_NOT_RECEIVED"
  | "INVOICE_ISSUE"
  | "DISPUTE"
  | "REQUEST_EXTENSION"
  | "PAYMENT_PLAN_REQUEST"
  | "WRONG_INVOICE"
  | "OTHER";

export interface Message {
  id: string;
  organization_id?: string;
  conversation_id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: string;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  external_message_id?: string | null;
  ai_intent: MessageIntent | null;
  ai_confidence: number | string | null;
  created_at: string;
}

export interface CollectionAction {
  id: string;
  organization_id?: string;
  customer_id: string | null;
  invoice_id: string | null;
  conversation_id: string | null;
  action_type:
    | "FOLLOW_UP_SCHEDULED"
    | "PAYMENT_VERIFICATION_REQUIRED"
    | "ESCALATE_FOR_REVIEW"
    | "ESCALATE_DISPUTE"
    | "RESEND_INVOICE"
    | "MANUAL_REVIEW"
    | string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | string;
  scheduled_at: string | null;
  executed_at: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  customers?: Customer;
  invoices?: Invoice;
  conversations?: Conversation;
}

export interface Dashboard {
  invoice_summary: {
    total: number;
    draft: number;
    open: number;
    partially_paid: number;
    paid: number;
    overdue: number;
    disputed: number;
    cancelled: number;
    [key: string]: number;
  };
  financial_summary: {
    total_invoiced: number;
    total_paid: number;
    total_outstanding: number;
    overdue_outstanding: number;
    currency: string;
  };
  customer_summary: {
    total_customers: number;
    customers_with_outstanding: number;
    customers_with_overdue: number;
  };
  collection_summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    [key: string]: number;
  };
  recent_activity: {
    invoices: Invoice[];
    payments: Payment[];
    collection_actions: CollectionAction[];
  };
}

export interface InvoiceDetail {
  invoice: Invoice;
  customer: Customer;
  financial_summary: {
    invoice_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    currency: string;
  };
  payments: Payment[];
  conversation: Conversation | null;
  conversations: Conversation[];
  collection_actions: CollectionAction[];
}

export interface CustomerDetail {
  customer: Customer;
  summary: {
    total_invoices: number;
    total_invoiced: number;
    total_paid: number;
    total_outstanding: number;
    overdue_amount: number;
  };
  invoices: Invoice[];
  payments: Payment[];
  conversations: Conversation[];
  collection_actions: CollectionAction[];
}

export interface ConversationDetail {
  conversation: Conversation;
  customer: Customer;
  invoice: Invoice | null;
  messages: Message[];
  collection_actions: CollectionAction[];
}

export interface OverdueProcessResult {
  invoices_detected: number;
  actions_created: number;
  created_action_ids: string[];
  skipped: Array<{
    invoice_id: string;
    reason: string;
  }>;
}
