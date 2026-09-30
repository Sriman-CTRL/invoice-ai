import React from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  onClear,
}: SearchInputProps) {
  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-8 text-xs sm:text-sm text-ink placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-soft"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
