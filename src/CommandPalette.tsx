import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CornerDownLeft, LayoutDashboard, MessageSquareText, Receipt, Search, Zap } from "lucide-react";
import { customersApi, invoicesApi } from "./api";
import { money } from "./lib";
import type { Customer, Invoice } from "./types";

interface Entry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PAGES: Entry[] = [
  { id: "p-dash", group: "Go to", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { id: "p-inv", group: "Go to", label: "Invoices", to: "/invoices", icon: Receipt },
  { id: "p-cust", group: "Go to", label: "Customers", to: "/customers", icon: Building2 },
  { id: "p-conv", group: "Go to", label: "Conversations", to: "/conversations", icon: MessageSquareText },
  { id: "p-act", group: "Go to", label: "Collection Actions", to: "/collection-actions", icon: Zap },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCursor(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    Promise.all([
      invoicesApi.list().catch(() => [] as Invoice[]),
      customersApi.list().catch(() => [] as Customer[]),
    ]).then(([i, c]) => {
      setInvoices(i);
      setCustomers(c);
    });
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all: Entry[] = [
      ...PAGES,
      ...invoices.map((i): Entry => ({
        id: `i-${i.id}`,
        group: "Invoices",
        label: i.invoice_number,
        hint: `${i.customers?.name ?? ""} · ${money(i.amount, i.currency)} · ${i.status}`,
        to: `/invoices/${i.id}`,
        icon: Receipt,
      })),
      ...customers.map((c): Entry => ({
        id: `c-${c.id}`,
        group: "Customers",
        label: c.name,
        hint: c.company_name || c.email,
        to: `/customers/${c.id}`,
        icon: Building2,
      })),
    ];
    const hit = needle ? all.filter((e) => `${e.label} ${e.hint ?? ""}`.toLowerCase().includes(needle)) : all.slice(0, 12);
    return hit.slice(0, 20);
  }, [q, invoices, customers]);

  useEffect(() => setCursor(0), [q]);

  if (!open) return null;
  const go = (e: Entry) => {
    onClose();
    navigate(e.to);
  };

  return (
    <div className="fade-in fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/60 px-4 pt-[14vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Command palette"
        className="pop-in w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/60 bg-midnight-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) go(results[cursor]);
              else if (e.key === "Escape") onClose();
            }}
            placeholder="Search invoices, customers, pages…"
            className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">No matches for “{q}”.</li>}
          {results.map((e, idx) => {
            const showGroup = idx === 0 || results[idx - 1].group !== e.group;
            return (
              <li key={e.id}>
                {showGroup && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{e.group}</p>}
                <button
                  onMouseEnter={() => setCursor(idx)}
                  onClick={() => go(e)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${idx === cursor ? "bg-indigo-500/20 text-white" : "text-slate-300"}`}
                >
                  <e.icon className="h-4 w-4 shrink-0 text-indigo-300" />
                  <span className="font-semibold">{e.label}</span>
                  {e.hint && <span className="truncate text-xs text-slate-500">{e.hint}</span>}
                  {idx === cursor && <CornerDownLeft className="ml-auto h-3.5 w-3.5 text-slate-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
