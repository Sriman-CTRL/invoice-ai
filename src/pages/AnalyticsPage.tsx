import { useState } from "react";
import { Download, FileSpreadsheet, Timer, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { analyticsApi } from "../api";
import { ErrorState, PageHeader, TableSkeleton } from "../components";
import { money } from "../lib";
import { useToast } from "../toast";
import { useResource } from "./shared";

const compact = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)));
const monthLabel = (ym: string) => new Date(ym + "-01T00:00:00").toLocaleString("en-IN", { month: "short" });

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: any; tone: string; label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-5">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function RevenueChart({ months }: { months: Array<{ month: string; received: number; invoiced: number }> }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.received, m.invoiced]));
  const H = 180;
  const ticks = [0, 0.5, 1];
  return (
    <div>
      <div className="relative" style={{ height: H + 28 }}>
        {ticks.map((t) => (
          <div key={t} className="absolute left-0 right-0 flex items-center" style={{ bottom: 28 + t * H }}>
            <span className="w-10 shrink-0 pr-2 text-right text-[10px] font-mono text-slate-400">{compact(max * t)}</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-1.5 pl-10 sm:gap-2.5">
          {months.map((m) => (
            <div key={m.month} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
              <div className="flex w-full items-end justify-center gap-0.5" style={{ height: H, marginBottom: 28 }}>
                <div className="w-full max-w-[14px] rounded-t bg-slate-200 transition-all group-hover:bg-slate-300" style={{ height: `${(m.invoiced / max) * 100}%`, minHeight: m.invoiced ? 2 : 0 }} />
                <div className="w-full max-w-[14px] rounded-t bg-brand-600 transition-all group-hover:bg-brand-500" style={{ height: `${(m.received / max) * 100}%`, minHeight: m.received ? 2 : 0 }} />
              </div>
              <span className="absolute bottom-0 text-[10px] font-semibold text-slate-400">{monthLabel(m.month)}</span>
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block">
                <b>{monthLabel(m.month)}</b> · Received {money(m.received, "INR")}<br />Invoiced {money(m.invoiced, "INR")}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 pl-10 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Money received</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Invoiced</span>
      </div>
    </div>
  );
}

function fyRange(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const startYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - offset;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, label: `FY ${startYear}-${String(startYear + 1).slice(2)}` };
}
function monthRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(start), to: iso(end), label: start.toLocaleString("en-IN", { month: "long", year: "numeric" }) };
}

const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function GstExport() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const ranges = [monthRange(1), monthRange(0), fyRange(0), fyRange(1)];

  const download = async (r: { from: string; to: string; label: string }) => {
    setBusy(r.label);
    try {
      const rep = await analyticsApi.gstReport(r.from, r.to);
      if (!rep.rows.length) { toast.info("Nothing to export", `No invoices were issued in ${r.label}.`); return; }
      const head = ["Invoice no", "Date", "Customer", "Status", "Currency", "Taxable value", "GST rate %", "CGST", "SGST", "IGST", "Invoice total"];
      const lines = [head, ...rep.rows.map((x) => [x.invoice_number, x.date, x.customer, x.status, x.currency, x.taxable, x.gst_rate, x.cgst, x.sgst, x.igst, x.total])];
      const sum = (k: "taxable" | "cgst" | "sgst" | "igst" | "total") => Math.round(rep.rows.reduce((a, x) => a + x[k], 0) * 100) / 100;
      lines.push(["TOTAL", "", "", "", "", sum("taxable"), "", sum("cgst"), sum("sgst"), sum("igst"), sum("total")]);
      const blob = new Blob(["﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gst-report-${r.from}-to-${r.to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("GST report downloaded", `${rep.rows.length} invoices, ${r.label}.`);
    } catch (e: any) {
      toast.error("Could not build the report", e?.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><FileSpreadsheet className="h-4 w-4" /></span>
        <div>
          <h2 className="text-base font-bold text-slate-900">GST report for your accountant</h2>
          <p className="text-xs text-slate-500">Every invoice with its taxable value and CGST, SGST and IGST. Opens in Excel and Google Sheets.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ranges.map((r) => (
          <button key={r.label} onClick={() => download(r)} disabled={busy !== null} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50">
            <span>{r.label}</span>
            <Download className={`h-4 w-4 ${busy === r.label ? "animate-pulse text-brand-600" : "text-slate-400"}`} />
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Drafts and cancelled invoices are left out. Check the figures with your accountant before filing.</p>
    </section>
  );
}

export function AnalyticsPage() {
  const r = useResource(() => analyticsApi.get(), []);
  if (r.loading) return <><PageHeader title="Analytics" /><TableSkeleton rows={4} /></>;
  if (r.error || !r.data) return <><PageHeader title="Analytics" /><ErrorState message={r.error || "Could not load analytics."} retry={r.reload} /></>;
  const { months, top_clients, kpi } = r.data;
  const last12 = months.reduce((s, m) => s + m.received, 0);
  const rate = kpi.sent_count ? Math.round((kpi.paid_count / kpi.sent_count) * 100) : 0;
  const empty = kpi.sent_count === 0;
  const topMax = Math.max(1, ...top_clients.map((c) => c.paid));

  return (
    <>
      <PageHeader title="Analytics" detail="How your business is really doing: money in, who pays best, and how fast." />

      {empty && (
        <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-bold text-slate-800">No data yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">Create your first invoice and this page fills in as clients pay you. The chart below shows what it will look like.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} tone="bg-emerald-50 text-emerald-600" label="Received, last 12 months" value={money(last12, "INR")} sub={`${money(kpi.lifetime_received, "INR")} all time`} />
        <Kpi icon={TrendingUp} tone="bg-brand-50 text-brand-600" label="Still to collect" value={money(kpi.outstanding, "INR")} sub={`${rate}% of sent invoices paid`} />
        <Kpi icon={AlertTriangle} tone="bg-rose-50 text-rose-600" label="Overdue" value={money(kpi.overdue, "INR")} sub={kpi.overdue > 0 ? "Worth a reminder today" : "Nothing overdue"} />
        <Kpi icon={Timer} tone="bg-amber-50 text-amber-600" label="Average time to get paid" value={kpi.avg_days_to_pay === null ? "—" : `${kpi.avg_days_to_pay} days`} sub="From issue date to payment" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-base font-bold text-slate-900">Money in, by month</h2>
          <p className="mb-5 text-xs text-slate-500">Last 12 months. Hover a month for the exact figures.</p>
          <RevenueChart months={months} />
        </section>

        <section className="panel p-6">
          <h2 className="text-base font-bold text-slate-900">Your best clients</h2>
          <p className="mb-4 text-xs text-slate-500">By money received, all time.</p>
          {top_clients.filter((c) => c.paid > 0).length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Your top clients show up here once they've paid.</p>
          ) : (
            <ol className="space-y-4">
              {top_clients.filter((c) => c.paid > 0).map((c, i) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold text-slate-800"><span className="mr-2 font-mono text-xs text-slate-400">{i + 1}</span>{c.company_name || c.name}</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{money(c.paid, "INR")}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(c.paid / topMax) * 100}%` }} /></div>
                  <p className="mt-1 text-[11px] text-slate-400">{c.invoices} invoice{c.invoices === 1 ? "" : "s"}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {(r.data.other_currencies?.length ?? 0) > 0 && (
        <section className="panel mt-6 p-6">
          <h2 className="text-base font-bold text-slate-900">Other currencies</h2>
          <p className="mb-4 text-xs text-slate-500">Each currency is totalled on its own. The figures above are INR only; amounts in different currencies are never added together.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2 pr-4">Currency</th><th className="py-2 pr-4 text-right">Invoiced</th><th className="py-2 pr-4 text-right">Received</th><th className="py-2 text-right">Still to collect</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {r.data.other_currencies!.map((c) => (
                  <tr key={c.currency}>
                    <td className="py-2 pr-4 font-semibold text-slate-800">{c.currency} <span className="text-xs font-normal text-slate-400">{c.invoices} invoice{c.invoices === 1 ? "" : "s"}</span></td>
                    <td className="py-2 pr-4 text-right font-mono">{money(c.invoiced, c.currency)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{money(c.received, c.currency)}</td>
                    <td className="py-2 text-right font-mono">{money(c.outstanding, c.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mt-6"><GstExport /></div>
    </>
  );
}
