import React from "react";
import {
  cn,
  getActionStatusMeta,
  getIntentMeta,
  getInvoiceStatusMeta,
  getPaymentStatusMeta,
  titleCase,
} from "../../lib/utils";

export interface BadgeProps {
  value: string | null | undefined;
  kind?: "invoice" | "action" | "payment" | "intent" | "generic";
  isOverdue?: boolean;
  className?: string;
}

export function Badge({ value, kind = "generic", isOverdue = false, className }: BadgeProps) {
  if (!value) return null;

  let meta;
  if (kind === "invoice") {
    meta = getInvoiceStatusMeta(value, isOverdue);
  } else if (kind === "action") {
    meta = getActionStatusMeta(value);
  } else if (kind === "payment") {
    meta = getPaymentStatusMeta(value);
  } else if (kind === "intent") {
    meta = getIntentMeta(value);
  } else {
    meta = {
      label: titleCase(value),
      bgClass: "bg-slate-50",
      textClass: "text-slate-700",
      borderClass: "border-slate-200",
    };
  }

  const dotClasses: Record<string, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-sky-500",
    brand: "bg-brand-600",
    neutral: "bg-slate-400",
  };

  const dotColor = (meta as any).category
    ? dotClasses[(meta as any).category] || "bg-slate-400"
    : "bg-slate-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium tracking-wide",
        meta.bgClass,
        meta.textClass,
        meta.borderClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}
