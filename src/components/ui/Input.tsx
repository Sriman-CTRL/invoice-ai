import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id, prefixIcon, suffixIcon, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {label}
            {props.required && <span className="ml-1 text-rose-500">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              {prefixIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 transition-colors",
              "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              prefixIcon ? "pl-9" : "",
              suffixIcon ? "pr-9" : "",
              error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500" : "",
              className
            )}
            {...props}
          />
          {suffixIcon && (
            <div className="pointer-events-none absolute right-3 flex items-center text-slate-400">
              {suffixIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
