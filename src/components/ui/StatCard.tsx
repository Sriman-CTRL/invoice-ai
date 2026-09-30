import React from "react";
import { cn } from "../../lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: "brand" | "emerald" | "sky" | "rose" | "amber" | "slate";
  badge?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent = "slate",
  badge,
  className,
}: StatCardProps) {
  const accentBorderColors = {
    brand: "bg-brand-600",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    slate: "bg-slate-500",
  };

  const iconBgColors = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className={cn("relative rounded-lg border border-line bg-white shadow-soft overflow-hidden transition-shadow hover:shadow-panel", className)}>
      <div className={cn("h-1 w-full", accentBorderColors[accent])} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
          {icon && (
            <div className={cn("grid h-8 w-8 place-items-center rounded-md shrink-0", iconBgColors[accent])}>
              {icon}
            </div>
          )}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tracking-tight text-ink font-mono tabular-nums">
            {value}
          </p>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <p className="mt-2 text-xs text-muted flex items-center gap-1.5 leading-normal">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
