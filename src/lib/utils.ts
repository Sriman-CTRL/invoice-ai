export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function money(amount: number | string | null | undefined, currency = "USD"): string {
  const numeric = typeof amount === "string" ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(numeric)) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `$${numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "k";
  }
  return num.toString();
}

export function date(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", options).format(d);
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return date(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date(value, { month: "short", day: "numeric" });
}

export function initials(name?: string | null): string {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function titleCase(value: string): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export type StatusCategory = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

export interface StatusMeta {
  label: string;
  category: StatusCategory;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export function getInvoiceStatusMeta(status: string, isOverdue = false): StatusMeta {
  const norm = (status || "").toUpperCase();

  if (isOverdue && (norm === "OPEN" || norm === "PARTIALLY_PAID")) {
    return {
      label: "Overdue",
      category: "danger",
      bgClass: "bg-rose-50",
      textClass: "text-rose-700",
      borderClass: "border-rose-200",
    };
  }

  switch (norm) {
    case "PAID":
      return {
        label: "Paid",
        category: "success",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "PARTIALLY_PAID":
      return {
        label: "Partially Paid",
        category: "info",
        bgClass: "bg-sky-50",
        textClass: "text-sky-700",
        borderClass: "border-sky-200",
      };
    case "OPEN":
      return {
        label: "Open",
        category: "info",
        bgClass: "bg-blue-50",
        textClass: "text-blue-700",
        borderClass: "border-blue-200",
      };
    case "DRAFT":
      return {
        label: "Draft",
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
      };
    case "DISPUTED":
      return {
        label: "Disputed",
        category: "warning",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        borderClass: "border-amber-200",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-600",
        borderClass: "border-slate-200",
      };
    default:
      return {
        label: titleCase(status),
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
      };
  }
}

export function getActionStatusMeta(status: string): StatusMeta {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "COMPLETED":
      return {
        label: "Completed",
        category: "success",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "PROCESSING":
      return {
        label: "Processing",
        category: "info",
        bgClass: "bg-sky-50",
        textClass: "text-sky-700",
        borderClass: "border-sky-200",
      };
    case "PENDING":
      return {
        label: "Pending",
        category: "warning",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        borderClass: "border-amber-200",
      };
    case "FAILED":
      return {
        label: "Failed",
        category: "danger",
        bgClass: "bg-rose-50",
        textClass: "text-rose-700",
        borderClass: "border-rose-200",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-600",
        borderClass: "border-slate-200",
      };
    default:
      return {
        label: titleCase(status),
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
      };
  }
}

export function getPaymentStatusMeta(status: string): StatusMeta {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "SUCCEEDED":
      return {
        label: "Succeeded",
        category: "success",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "PENDING":
      return {
        label: "Pending",
        category: "warning",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        borderClass: "border-amber-200",
      };
    case "FAILED":
      return {
        label: "Failed",
        category: "danger",
        bgClass: "bg-rose-50",
        textClass: "text-rose-700",
        borderClass: "border-rose-200",
      };
    case "REFUNDED":
      return {
        label: "Refunded",
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-600",
        borderClass: "border-slate-200",
      };
    default:
      return {
        label: titleCase(status),
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
      };
  }
}

export function getIntentMeta(intent: string | null): StatusMeta {
  if (!intent) {
    return {
      label: "Unclassified",
      category: "neutral",
      bgClass: "bg-slate-100",
      textClass: "text-slate-600",
      borderClass: "border-slate-200",
    };
  }

  const norm = intent.toUpperCase();
  switch (norm) {
    case "PAYMENT_CONFIRMED":
      return {
        label: "Payment Confirmed",
        category: "success",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "PAYMENT_PROMISED":
      return {
        label: "Payment Promised",
        category: "brand",
        bgClass: "bg-brand-50",
        textClass: "text-brand-700",
        borderClass: "border-brand-200",
      };
    case "DISPUTE":
      return {
        label: "Dispute Raised",
        category: "danger",
        bgClass: "bg-rose-50",
        textClass: "text-rose-700",
        borderClass: "border-rose-200",
      };
    case "REQUEST_EXTENSION":
      return {
        label: "Extension Requested",
        category: "warning",
        bgClass: "bg-amber-50",
        textClass: "text-amber-800",
        borderClass: "border-amber-200",
      };
    case "PAYMENT_PLAN_REQUEST":
      return {
        label: "Payment Plan Request",
        category: "info",
        bgClass: "bg-violet-50",
        textClass: "text-violet-700",
        borderClass: "border-violet-200",
      };
    case "INVOICE_ISSUE":
    case "WRONG_INVOICE":
      return {
        label: norm === "WRONG_INVOICE" ? "Wrong Invoice" : "Invoice Issue",
        category: "warning",
        bgClass: "bg-orange-50",
        textClass: "text-orange-800",
        borderClass: "border-orange-200",
      };
    case "PAYMENT_NOT_RECEIVED":
      return {
        label: "Payment Not Received",
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
      };
    default:
      return {
        label: titleCase(intent),
        category: "neutral",
        bgClass: "bg-slate-100",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
      };
  }
}

export function formatActionType(actionType: string): string {
  switch (actionType) {
    case "FOLLOW_UP_SCHEDULED":
      return "Follow-up Scheduled";
    case "PAYMENT_VERIFICATION_REQUIRED":
      return "Payment Verification Required";
    case "ESCALATE_FOR_REVIEW":
      return "Escalate for Review";
    case "ESCALATE_DISPUTE":
      return "Escalate Dispute";
    case "RESEND_INVOICE":
      return "Resend Invoice";
    case "MANUAL_REVIEW":
      return "Manual Review";
    default:
      return titleCase(actionType);
  }
}
