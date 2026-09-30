import React from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-white shadow-soft p-10 flex flex-col items-center justify-center text-center",
        className
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-50 border border-slate-200/60 text-slate-400 mb-3.5">
        {icon || <Inbox className="h-6 w-6 stroke-[1.5]" />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-muted leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
