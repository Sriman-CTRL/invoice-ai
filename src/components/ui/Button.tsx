import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "brand";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      disabled,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none";

    const variantClasses = {
      primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm active:bg-slate-950",
      brand: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm active:bg-brand-800",
      secondary: "border border-line bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-soft active:bg-slate-100",
      outline: "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200",
      ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
      danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm active:bg-rose-800",
    };

    const sizeClasses = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
      md: "h-9 px-3.5 text-sm gap-2 rounded-md",
      lg: "h-11 px-5 text-base gap-2.5 rounded-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
