import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleAlert, DollarSign, Receipt, RefreshCw, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { dashboardApi, overdueApi } from "../api";
import { Badge, ErrorState, PageHeader } from "../components";
import { dateTime, money, titleCase } from "../lib";
import type { CollectionAction, Dashboard, Invoice } from "../types";
import { useResource } from "./shared";
import { CashFlowForecast } from "./CashFlowForecast";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { useToast } from "../toast";

interface MetricCardProps {
  title: string;
  value: string;
  subValue: string;
  badgeText?: string;
  badgeTone?: "emerald" | "brand" | "amber" | "rose";
  icon: React.ComponentType<{ className?: string }>;
  accentGradient: string;
}

function MetricCard({
  title,
  value,
  subValue,
  badgeText,
  badgeTone = "brand",
  icon: Icon,
  accentGradient,
}: MetricCardProps) {
  const toneMap = {
    emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    brand: "bg-brand-500/10 text-brand-700 border-brand-500/20",
    amber: "bg-amber-500/10 text-amber-800 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/70 p-6 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-card-hover">
      {/* Top Astryx Accent Glow */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentGradient}`} />
      <div className={`pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gradient-to-br ${accentGradient} opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 truncate text-2xl font-extrabold tracking-tight text-slate-900 font-mono tabular-nums">
            {value}
          </p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-700 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-brand-300 group-hover:bg-brand-50 group-hover:text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="text-slate-500 font-medium">{subValue}</span>
        {badgeText && (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${toneMap[badgeTone]}`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const resource = useResource(() => dashboardApi.get(), []);
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const data = resource.data as Dashboard | null;

  const handleRunScan = async () => {
    setScanning(true);
    setScanNotice(null);
    try {
      const res = await overdueApi.process();
      setScanNotice(
        `Autonomous Scan Complete: ${res.invoices_detected} past-due invoice(s) detected, ${res.actions_created} collection action(s) created.`
      );
      toast.success("Autonomous scan complete", `${res.actions_created} collection action(s) created.`);
      resource.reload();
    } catch (err: any) {
      toast.error("Scan failed", err?.message);
      setScanNotice("Scan failed: " + (err?.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  };

  if (resource.loading) {
    return (
      <>
        <PageHeader title="Overview" detail="Live cash flow health and AI recovery engine." />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div className="panel h-36 animate-pulse bg-slate-100" key={i} />
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="panel h-80 animate-pulse bg-slate-100" />
          <div className="panel h-80 animate-pulse bg-slate-100" />
        </div>
      </>
    );
  }

  if (resource.error || !data) {
    return (
      <>
        <PageHeader title="Overview" />
        <ErrorState
          message={resource.error || "Dashboard data is currently unavailable."}
          retry={resource.reload}
        />
      </>
    );
  }

  const f = data.financial_summary;
  const invoicedNum = Number(f.total_invoiced) || 1;
  const paidNum = Number(f.total_paid) || 0;
  const recoveryRate = Math.min(100, Math.round((paidNum / invoicedNum) * 100));

  const statuses = [
    { key: "paid", label: "Paid", color: "bg-emerald-500", bar: "bg-emerald-500" },
    { key: "open", label: "Current Open", color: "bg-sky-500", bar: "bg-sky-500" },
    { key: "partially_paid", label: "Partially Paid", color: "bg-violet-500", bar: "bg-violet-500" },
    { key: "overdue", label: "Overdue", color: "bg-rose-500", bar: "bg-rose-500" },
    { key: "disputed", label: "In Dispute", color: "bg-amber-500", bar: "bg-amber-500" },
    { key: "cancelled", label: "Cancelled", color: "bg-slate-400", bar: "bg-slate-400" },
  ] as const;

  const actionStatuses = [
    { key: "pending", label: "Pending", desc: "Awaiting schedule trigger" },
    { key: "processing", label: "In Flight", desc: "Currently executing" },
    { key: "completed", label: "Completed", desc: "Delivered & resolved" },
    { key: "failed", label: "Needs Review", desc: "Action halted" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Accounts Receivable Hub"
        detail="Real-time ledger balances, automated email queues, and AI classification."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunScan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {scanning ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>Scan Overdue</span>
                </>
              )}
            </button>
            <Link to="/playground" className="btn-secondary h-9.5 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              <span>Simulate Reply</span>
            </Link>
            <Link to="/invoices" className="btn-secondary h-9.5 text-xs font-bold">
              <span>View Invoices</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      {scanNotice && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/90 p-4 text-xs font-semibold text-brand-900 flex items-center justify-between shadow-soft animate-fade-in">
          <span>{scanNotice}</span>
          <button onClick={() => setScanNotice(null)} className="text-brand-500 hover:text-brand-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <OnboardingChecklist
        customers={data.customer_summary.total_customers}
        invoices={Object.values(data.invoice_summary).reduce((a, b) => a + Number(b || 0), 0)}
      />

      {/* 4 Hero KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Invoiced"
          value={money(f.total_invoiced, f.currency)}
          subValue={`${data.invoice_summary.total} total invoices recorded`}
          badgeText="AUTHORITATIVE"
          badgeTone="brand"
          icon={Receipt}
          accentGradient="from-brand-600 to-indigo-600"
        />
        <MetricCard
          title="Collected Revenue"
          value={money(f.total_paid, f.currency)}
          subValue={`${recoveryRate}% recovery rate`}
          badgeText="SETTLED"
          badgeTone="emerald"
          icon={CheckCircle2}
          accentGradient="from-emerald-500 to-teal-600"
        />
        <MetricCard
          title="Active Outstanding"
          value={money(f.total_outstanding, f.currency)}
          subValue={`${data.customer_summary.customers_with_outstanding} accounts with balance`}
          badgeText="OPEN"
          badgeTone="brand"
          icon={DollarSign}
          accentGradient="from-sky-500 to-brand-500"
        />
        <MetricCard
          title="Overdue Balance"
          value={money(f.overdue_outstanding, f.currency)}
          subValue={`${data.customer_summary.customers_with_overdue} high-priority accounts`}
          badgeText="ACTION REQUIRED"
          badgeTone="rose"
          icon={CircleAlert}
          accentGradient="from-rose-500 to-amber-500"
        />
      </div>

      <div className="mt-7"><CashFlowForecast /></div>

      {/* Middle Section: Distribution + Automation Pipeline */}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-start">
        {/* Receivables Aging & Status */}
        <section className="panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Portfolio Status Breakdown</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Authoritative distribution across all invoice stages
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
              to="/invoices"
            >
              <span>Manage invoices</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Segmented Progress Bar */}
          <div className="mt-6">
            <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
              {statuses.map(({ key, bar }) => {
                const count = Number(data.invoice_summary[key] || 0);
                const pct = data.invoice_summary.total > 0 ? (count / data.invoice_summary.total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={key}
                    style={{ width: `${pct}%` }}
                    className={`${bar} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
                    title={`${titleCase(key)}: ${count} invoices (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>
          </div>

          {/* Status Metric Grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {statuses.map(({ key, label, color }) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  <span className="text-xs font-semibold text-slate-600">{label}</span>
                </div>
                <p className="mt-2 text-xl font-extrabold font-mono text-slate-900">
                  {data.invoice_summary[key] || 0}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* AI & Collection Action Pipeline */}
        <section className="panel p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Action Queue</h2>
              <p className="mt-0.5 text-xs text-slate-500">Autonomous follow-up pipeline</p>
            </div>
            <Link
              to="/collection-actions"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              <span>View queue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {actionStatuses.map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition-colors hover:bg-slate-50/80"
              >
                <div className="flex items-center gap-3">
                  <Badge value={key} />
                  <span className="text-xs text-slate-500 hidden sm:inline">{desc}</span>
                </div>
                <span className="font-mono text-lg font-bold text-slate-900">
                  {data.collection_summary[key] || 0}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-gradient-to-br from-brand-50 to-indigo-50/80 p-3.5 text-xs text-brand-900 ring-1 ring-inset ring-brand-500/10">
            <div className="flex items-center gap-2 font-bold text-brand-800">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <span>Safety checks</span>
            </div>
            <p className="mt-1 text-[11px] text-brand-700 leading-relaxed">
              AI suggestions require verified ledger payments before moving invoice states. Double outreach is prevented via row-level locks.
            </p>
          </div>
        </section>
      </div>

      {/* Live Recent Activity */}
      <section className="panel mt-7 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Ledger & AI Events</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Inbound customer emails, payments recorded, and follow-ups executed
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {[
            ...data.recent_activity.collection_actions.slice(0, 4).map((item) => ({
              type: "action",
              item,
            })),
            ...data.recent_activity.payments.slice(0, 3).map((item) => ({
              type: "payment",
              item,
            })),
            ...data.recent_activity.invoices.slice(0, 3).map((item) => ({
              type: "invoice",
              item,
            })),
          ]
            .slice(0, 8)
            .map(({ type, item }, index) => (
              <div
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70"
                key={`${type}-${index}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      type === "action"
                        ? "bg-amber-500/10 text-amber-700"
                        : type === "payment"
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-sky-500/10 text-sky-700"
                    }`}
                  >
                    {type === "action" ? (
                      <Zap className="h-4.5 w-4.5" />
                    ) : type === "payment" ? (
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    ) : (
                      <Receipt className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {type === "action"
                        ? `${(item as CollectionAction).action_type.replace(/_/g, " ")} executed`
                        : type === "payment"
                        ? `Payment received for ${
                            (item as any).invoices?.invoice_number || "Invoice"
                          }`
                        : `Invoice ${(item as Invoice).invoice_number} created`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {type === "action"
                        ? `Status: ${(item as CollectionAction).status}`
                        : type === "payment"
                        ? `Amount: ${money((item as any).amount, (item as any).currency)}`
                        : `Amount: ${money((item as Invoice).amount, (item as Invoice).currency)}`}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {dateTime((item as any).created_at)}
                </span>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
