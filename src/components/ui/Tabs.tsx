import React from "react";
import { cn } from "../../lib/utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function Tabs({ tabs, activeTab, onChange, className, size = "md" }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-line bg-slate-100/70 p-1 text-slate-600",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md font-medium transition-all select-none whitespace-nowrap",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs sm:text-sm",
              isActive
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums",
                  isActive
                    ? "bg-slate-100 text-slate-700"
                    : "bg-slate-200/60 text-slate-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
