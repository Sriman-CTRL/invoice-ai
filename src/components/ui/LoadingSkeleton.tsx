import React from "react";
import { cn } from "../../lib/utils";

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border border-line bg-white shadow-soft overflow-hidden">
      <div className="h-10 border-b border-line bg-slate-50/60 px-5 flex items-center gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3.5 bg-slate-200/70 rounded animate-pulse",
              i === 0 ? "w-28" : i === cols - 1 ? "w-16 ml-auto" : "w-24"
            )}
          />
        ))}
      </div>
      <div className="divide-y divide-line/60">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="px-5 py-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={cn(
                  "h-4 bg-slate-100 rounded animate-pulse",
                  cIdx === 0 ? "w-36" : cIdx === cols - 1 ? "w-20 ml-auto" : "w-24"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-white shadow-soft p-5 animate-pulse">
      <div className="h-3 w-28 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-44 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-32 bg-slate-100 rounded" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 w-64 bg-slate-200 rounded" />
      <div className="grid gap-5 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <TableSkeleton rows={4} cols={4} />
    </div>
  );
}
