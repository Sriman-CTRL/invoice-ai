import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pause, Play, Repeat, Trash2 } from "lucide-react";
import { recurringApi } from "../api";
import { date, money } from "../lib";
import { useToast } from "../toast";

type Row = Awaited<ReturnType<typeof recurringApi.list>>[number];
const LABEL: Record<string, string> = { WEEKLY: "Every week", MONTHLY: "Every month", QUARTERLY: "Every 3 months", YEARLY: "Every year" };

function total(t: Row["template"]): number {
  const sub = (t.items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
  const taxable = Math.max(0, sub - (t.discount || 0));
  return Math.round((taxable + (t.tax_mode === "NONE" ? 0 : (taxable * (t.tax_percent || 0)) / 100)) * 100) / 100;
}

/** Lists repeating invoices. Hidden until at least one exists, so it never clutters a new account. */
export function RecurringPanel({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const load = useCallback(() => { recurringApi.list().then(setRows).catch(() => {}); }, []);
  useEffect(load, [load, refreshKey]);
  if (rows.length === 0) return null;

  const toggle = async (r: Row) => { try { await recurringApi.setActive(r.id, !r.active); load(); } catch (e: any) { toast.error("Could not update", e?.message); } };
  const remove = async (r: Row) => {
    if (!window.confirm(`Stop repeating this invoice for ${r.customer_name}? Invoices already created stay.`)) return;
    try { await recurringApi.remove(r.id); load(); toast.success("Repeating invoice removed"); } catch (e: any) { toast.error("Could not remove", e?.message); }
  };

  return (
    <div className="panel mb-5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left" aria-expanded={open}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Repeat className="h-4 w-4" /></span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-slate-900">Repeating invoices</span>
          <span className="block text-xs text-slate-500">{rows.filter((r) => r.active).length} active. Each one arrives as a draft for you to review before it's sent.</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="min-w-[8rem] flex-1 font-semibold text-slate-900">{r.customer_name}</span>
              <span className="font-mono text-xs font-bold text-slate-800">{money(total(r.template), r.template.currency)}</span>
              <span className="text-xs text-slate-500">{LABEL[r.frequency]}</span>
              <span className="text-xs text-slate-500">{r.active ? `Next draft ${date(r.next_run)}` : "Paused"}</span>
              <span className="ml-auto flex items-center gap-1">
                <button onClick={() => toggle(r)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" title={r.active ? "Pause" : "Resume"}>{r.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
                <button onClick={() => remove(r)} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
