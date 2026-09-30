import React from "react";
import { cn } from "../../lib/utils";

export function Table({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full text-left text-sm text-ink border-collapse", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-line bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-muted", className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-line/60 bg-white", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  clickable = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-slate-50/80 group",
        clickable ? "cursor-pointer" : "",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  children,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "h-10 px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap select-none",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  align = "left",
  mono = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap align-middle",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        mono ? "font-mono tabular-nums text-slate-900" : "",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
