import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Sparkles, TriangleAlert } from "lucide-react";
import { actionsApi, invoicesApi } from "../api";
import { date, money } from "../lib";
import type { CollectionAction, Invoice } from "../types";
import { useResource } from "./shared";

type Source = "promise" | "due" | "risk";
interface Projection { invoice: Invoice; amount: number; when: Date; source: Source }

const DAY = 86_400_000;
const WEEKS = 8;
const CLOSED = new Set(["PAID", "CANCELLED", "VOID", "DRAFT", "WRITTEN_OFF"]);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parsePromise(action: CollectionAction): Date | null {
  const raw = (action.metadata as Record<string, unknown> | undefined)?.promised_date;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

export function buildProjections(invoices: Invoice[], actions: CollectionAction[], today = startOfDay(new Date())): Projection[] {
  // Latest AI-extracted promise per invoice wins.
  const promises = new Map<string, Date>();
  [...actions]
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    .forEach((a) => {
      const d = a.invoice_id ? parsePromise(a) : null;
      if (a.invoice_id && d) promises.set(a.invoice_id, d);
    });

  return invoices
    .filter((i) => !CLOSED.has(i.status))
    .map((invoice): Projection => {
      const amount = Number(invoice.amount) || 0;
      const due = invoice.due_at ? startOfDay(new Date(invoice.due_at)) : today;
      const promised = promises.get(invoice.id);
      // A promise that has itself lapsed no longer counts as a forecast.
      if (promised && promised >= today) return { invoice, amount, when: promised, source: "promise" };
      if (due < today) return { invoice, amount, when: due, source: "risk" };
      return { invoice, amount, when: due, source: "due" };
    });
}

export function CashFlowForecast() {
  const inv = useResource(() => invoicesApi.list(), []);
  const act = useResource(() => actionsApi.list().then((r) => r.value ?? []).catch(() => [] as CollectionAction[]), []);

  const model = useMemo(() => {
    if (!inv.data) return null;
    const today = startOfDay(new Date());
    const projections = buildProjections(inv.data, act.data ?? [], today);
    const risk = projections.filter((p) => p.source === "risk");
    const buckets = Array.from({ length: WEEKS }, (_, w) => ({
      start: new Date(+today + w * 7 * DAY),
      promise: 0,
      due: 0,
      items: [] as Projection[],
    }));
    projections.filter((p) => p.source !== "risk").forEach((p) => {
      const w = Math.floor((+p.when - +today) / (7 * DAY));
      if (w < 0 || w >= WEEKS) return;
      buckets[w][p.source === "promise" ? "promise" : "due"] += p.amount;
      buckets[w].items.push(p);
    });
    const riskTotal = risk.reduce((s, p) => s + p.amount, 0);
    const promisedTotal = projections.filter((p) => p.source === "promise").reduce((s, p) => s + p.amount, 0);
    const peak = Math.max(1, riskTotal, ...buckets.map((b) => b.promise + b.due));
    const next30 = projections
      .filter((p) => p.source !== "risk" && +p.when - +today <= 30 * DAY)
      .reduce((s, p) => s + p.amount, 0);
    const timeline = [...projections].sort((a, b) => +a.when - +b.when).slice(0, 6);
    return { buckets, riskTotal, riskCount: risk.length, promisedTotal, peak, next30, timeline };
  }, [inv.data, act.data]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-midnight-950 p-6 text-white shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <CalendarClock className="h-4.5 w-4.5 text-indigo-300" /> Cash Flow Forecast
          </h2>
          <p className="mt-1 text-xs text-slate-400">Next {WEEKS} weeks, by due date and AI-extracted payment promises.</p>
        </div>
        {model && (
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected in 30 days</p>
            <p className="font-mono text-2xl font-black tabular-nums text-emerald-300">{money(model.next30)}</p>
          </div>
        )}
      </div>

      {inv.loading && <div className="relative mt-6 h-44 animate-pulse rounded-xl bg-slate-800/50" />}
      {inv.error && <p className="relative mt-6 text-sm text-rose-300">{inv.error}</p>}

      {model && !inv.loading && (
        model.buckets.every((b) => b.items.length === 0) && model.riskCount === 0 ? (
          <div className="relative mt-6 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-center">
            <CalendarClock className="mb-2 h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">Nothing to forecast yet</p>
            <p className="mt-0.5 text-xs text-slate-500">Create an invoice and projected collections will appear here.</p>
          </div>
        ) : (
          <>
            <div className="relative mt-6 flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label="Weekly projected collections chart">
              <Bar label="Overdue" sub={`${model.riskCount} inv`} height={(model.riskTotal / model.peak) * 100} amount={model.riskTotal}
                segments={[{ pct: 100, cls: "bg-gradient-to-t from-rose-600 to-rose-400" }]} />
              {model.buckets.map((b, i) => {
                const total = b.promise + b.due;
                return (
                  <Bar key={i} label={i === 0 ? "This wk" : date(b.start.toISOString(), { day: "numeric", month: "short" })}
                    sub={b.items.length ? `${b.items.length} inv` : ""} height={(total / model.peak) * 100} amount={total}
                    segments={total ? [
                      { pct: (b.promise / total) * 100, cls: "bg-gradient-to-t from-emerald-600 to-emerald-400" },
                      { pct: (b.due / total) * 100, cls: "bg-gradient-to-t from-indigo-600 to-indigo-400" },
                    ] : []} />
                );
              })}
            </div>

            <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400">
              <Legend cls="bg-emerald-400" text="AI-promised payment" />
              <Legend cls="bg-indigo-400" text="Due date" />
              <Legend cls="bg-rose-400" text="Overdue, no promise (at risk)" />
            </div>

            <div className="relative mt-5 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2">
              {model.riskTotal > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <p className="text-rose-100"><b>{money(model.riskTotal)}</b> across {model.riskCount} overdue invoice(s) has no payment promise. Prioritise these for collection.</p>
                </div>
              )}
              {model.promisedTotal > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-emerald-100"><b>{money(model.promisedTotal)}</b> promised by clients, as detected by Gemini from replies.</p>
                </div>
              )}
            </div>

            <ol className="relative mt-4 space-y-1.5">
              {model.timeline.map((p) => (
                <li key={p.invoice.id}>
                  <Link to={`/invoices/${p.invoice.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-slate-800/70">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${p.source === "promise" ? "bg-emerald-400" : p.source === "risk" ? "bg-rose-400" : "bg-indigo-400"}`} />
                    <span className="w-24 shrink-0 font-mono text-slate-400">{date(p.when.toISOString())}</span>
                    <span className="truncate font-semibold text-slate-200">{p.invoice.invoice_number}</span>
                    <span className="truncate text-slate-500">{p.invoice.customers?.name}</span>
                    <span className="ml-auto font-mono tabular-nums text-slate-200">{money(p.amount, p.invoice.currency)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )
      )}
    </section>
  );
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${cls}`} />{text}</span>;
}

function Bar({ label, sub, height, amount, segments }: {
  label: string; sub: string; height: number; amount: number; segments: { pct: number; cls: string }[];
}) {
  return (
    <div className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${label}: ${money(amount)}`}>
      <span className="mb-1 hidden font-mono text-[10px] text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 sm:block">
        {amount ? money(amount) : ""}
      </span>
      <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md transition-all duration-500 ease-out group-hover:brightness-125"
        style={{ height: `${Math.max(height, amount ? 4 : 1)}%` }}>
        {segments.map((s, i) => <div key={i} className={s.cls} style={{ height: `${s.pct}%` }} />)}
        {!amount && <div className="h-full bg-slate-800" />}
      </div>
      <span className="mt-2 w-full truncate text-center text-[10px] font-semibold text-slate-400">{label}</span>
      <span className="h-3 text-[9px] text-slate-600">{sub}</span>
    </div>
  );
}
