import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Play,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserRound,
  Zap,
} from "lucide-react";
import {
  actionsApi,
  ApiError,
  conversationsApi,
  customersApi,
  dashboardApi,
  invoicesApi,
} from "./api";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  TableSkeleton,
} from "./components";
import { useAuth } from "./auth";
import { date, dateTime, money, titleCase } from "./lib";
import type {
  CollectionAction,
  Conversation,
  ConversationDetail,
  Customer,
  CustomerDetail,
  Dashboard,
  Invoice,
  InvoiceDetail,
} from "./types";

function useResource<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    setError(null);
    load()
      .then(setData)
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, deps);
  return { data, error, loading, reload };
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

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
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20",
    brand: "bg-brand-500/10 text-brand-700 ring-brand-600/20",
    amber: "bg-amber-500/10 text-amber-800 ring-amber-600/20",
    rose: "bg-rose-500/10 text-rose-700 ring-rose-600/20",
  };

  return (
    <div className="panel group relative overflow-hidden p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentGradient}`} />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-mono tabular-nums">
            {value}
          </p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100/80 text-slate-700 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="text-slate-500 font-medium">{subValue}</span>
        {badgeText && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ring-1 ring-inset ${toneMap[badgeTone]}`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const resource = useResource(() => dashboardApi.get(), []);
  const data = resource.data as Dashboard | null;

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
            <Link to="/playground" className="btn-secondary h-9.5 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              <span>Simulate Customer Reply</span>
            </Link>
            <Link to="/invoices" className="btn-primary h-9.5 text-xs font-bold">
              <span>View All Invoices</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
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

      {/* Middle Section: Distribution + Automation Pipeline */}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
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
              <span>Safety Guarantee</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const resource = useResource(() => invoicesApi.list(status || undefined), [status]);

  const invoices = useMemo(
    () =>
      (resource.data || []).filter((invoice) =>
        `${invoice.invoice_number} ${invoice.customers?.name || ""} ${invoice.customers?.email || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [resource.data, query],
  );

  const tabs = [
    { id: "", label: "All" },
    { id: "OPEN", label: "Open" },
    { id: "PARTIALLY_PAID", label: "Partially Paid" },
    { id: "PAID", label: "Paid" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <>
      <PageHeader
        title="Receivables Ledger"
        detail="Manage invoice balances, payment schedules, and automated collection actions."
        actions={
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-500">
              {invoices.length} {invoices.length === 1 ? "record" : "records"}
            </span>
          </div>
        }
      />

      {/* Filter Tabs & Search Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1 shadow-soft">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                status === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:max-w-xs">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search invoice or customer..."
          />
        </div>
      </div>

      {resource.loading ? (
        <TableSkeleton rows={6} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices found"
          detail="There are no records matching your selected status and search query."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Invoice ID</th>
                  <th className="table-head">Customer</th>
                  <th className="table-head">Issued</th>
                  <th className="table-head">Due Date</th>
                  <th className="table-head text-right">Amount</th>
                  <th className="table-head text-center">Status</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="table-cell">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-mono font-bold text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <div className="font-semibold text-slate-900">
                        {inv.customers?.name || "Unknown Customer"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {inv.customers?.company_name || inv.customers?.email || "—"}
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {date(inv.issued_at)}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {date(inv.due_at)}
                    </td>
                    <td className="table-cell text-right font-mono font-bold text-slate-900">
                      {money(inv.amount, inv.currency)}
                    </td>
                    <td className="table-cell text-center">
                      <Badge value={inv.status} />
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-600"
                      >
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE DETAIL PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DetailLoad<T>({
  resource,
  children,
}: {
  resource: ReturnType<typeof useResource<T>>;
  children: (data: T) => React.ReactNode;
}) {
  if (resource.loading) return <TableSkeleton rows={7} />;
  if (resource.error || !resource.data)
    return (
      <ErrorState
        message={resource.error || "This record could not be loaded."}
        retry={resource.reload}
      />
    );
  return <>{children(resource.data)}</>;
}

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const r = useResource(() => invoicesApi.detail(id), [id]);

  return (
    <DetailLoad resource={r}>
      {(data: InvoiceDetail) => {
        const inv = data.invoice;
        const fin = data.financial_summary;
        const totalAmount = Number(fin.invoice_amount) || 1;
        const paidAmount = Number(fin.paid_amount) || 0;
        const progressPct = Math.min(100, Math.round((paidAmount / totalAmount) * 100));

        return (
          <>
            <PageHeader
              title={`Invoice ${inv.invoice_number}`}
              detail={`Issued ${date(inv.issued_at)} · Due ${date(inv.due_at)}`}
              back="/invoices"
              actions={<Badge value={inv.status} />}
            />

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-6">
                {/* Financial Summary Card */}
                <section className="panel p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Invoice Balance
                  </p>
                  <p className="mt-2 font-mono text-3xl font-black text-slate-900 sm:text-4xl tabular-nums">
                    {money(fin.invoice_amount, fin.currency)}
                  </p>

                  {/* Payment Progress Bar */}
                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                      <span>{progressPct}% Settled</span>
                      <span>Outstanding: {money(fin.outstanding_amount, fin.currency)}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-5">
                    <div className="pr-4">
                      <p className="text-xs font-medium text-slate-400">Total Settled</p>
                      <p className="mt-1 font-mono text-lg font-bold text-emerald-600">
                        {money(fin.paid_amount, fin.currency)}
                      </p>
                    </div>
                    <div className="px-4">
                      <p className="text-xs font-medium text-slate-400">Remaining Due</p>
                      <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                        {money(fin.outstanding_amount, fin.currency)}
                      </p>
                    </div>
                    <div className="pl-4">
                      <p className="text-xs font-medium text-slate-400">Payments</p>
                      <p className="mt-1 font-mono text-lg font-bold text-slate-700">
                        {data.payments.length}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Payments Table */}
                <section className="panel overflow-hidden">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <h3 className="font-bold text-slate-900">Payment Records</h3>
                  </div>
                  {data.payments.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50/70 border-b border-slate-100">
                          <tr>
                            <th className="table-head">Amount</th>
                            <th className="table-head">Status</th>
                            <th className="table-head text-right">Date Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.payments.map((p) => (
                            <tr key={p.id}>
                              <td className="table-cell font-mono font-bold text-slate-900">
                                {money(p.amount, p.currency)}
                              </td>
                              <td className="table-cell">
                                <Badge value={p.status} />
                              </td>
                              <td className="table-cell text-right font-mono text-xs text-slate-500">
                                {date(p.paid_at || p.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-6 py-8 text-center text-xs text-slate-400">
                      No payments have been recorded for this invoice yet.
                    </p>
                  )}
                </section>

                {/* Collection Actions Linked */}
                <ActionsTable actions={data.collection_actions} />
              </div>

              {/* Sidebar Info */}
              <aside className="space-y-6">
                <section className="panel p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Customer Details</h3>
                  <Link
                    to={`/customers/${data.customer.id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-slate-100"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">
                        {data.customer.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {data.customer.company_name || data.customer.email}
                      </span>
                    </div>
                  </Link>
                </section>

                <section className="panel p-6">
                  <h3 className="font-bold text-slate-900 mb-3">Linked Conversations</h3>
                  {data.conversations.length ? (
                    <div className="space-y-2.5">
                      {data.conversations.map((c) => (
                        <Link
                          key={c.id}
                          to={`/conversations/${c.id}`}
                          className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 text-xs transition-colors hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2 font-semibold text-slate-700">
                            <Mail className="h-4 w-4 text-brand-600" />
                            <span>{titleCase(c.channel)} Thread</span>
                          </div>
                          <Badge value={c.status} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No active thread for this invoice.</p>
                  )}
                </section>
              </aside>
            </div>
          </>
        );
      }}
    </DetailLoad>
  );
}

function ActionsTable({ actions }: { actions: CollectionAction[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="font-bold text-slate-900">Collection Actions</h3>
      </div>
      {actions.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70 border-b border-slate-100">
              <tr>
                <th className="table-head">Action Type</th>
                <th className="table-head">Status</th>
                <th className="table-head">Scheduled</th>
                <th className="table-head text-right">Executed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="table-cell font-semibold text-slate-800">
                    {titleCase(a.action_type.replace(/_/g, " "))}
                  </td>
                  <td className="table-cell">
                    <Badge value={a.status} />
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-500">
                    {dateTime(a.scheduled_at)}
                  </td>
                  <td className="table-cell text-right font-mono text-xs text-slate-500">
                    {dateTime(a.executed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-6 py-8 text-center text-xs text-slate-400">
          No automated collection actions scheduled yet.
        </p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const [query, setQuery] = useState("");
  const r = useResource(() => customersApi.list(), []);

  const customers = useMemo(
    () =>
      (r.data || []).filter((c) =>
        `${c.name} ${c.company_name || ""} ${c.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [r.data, query],
  );

  return (
    <>
      <PageHeader
        title="Customer Directory"
        detail="All accounts linked to your invoice and receivables ledger."
        actions={
          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search customers or company..."
            />
          </div>
        }
      />

      {r.loading ? (
        <TableSkeleton rows={6} />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers found"
          detail="There are no accounts matching your search."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Customer</th>
                  <th className="table-head">Company</th>
                  <th className="table-head">Contact Email</th>
                  <th className="table-head text-right">Created</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="table-cell">
                      <Link
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-3 font-bold text-slate-900 group-hover:text-brand-600"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>{c.name}</span>
                      </Link>
                    </td>
                    <td className="table-cell font-medium text-slate-600">
                      {c.company_name || "—"}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {c.email}
                    </td>
                    <td className="table-cell text-right font-mono text-xs text-slate-400">
                      {date(c.created_at)}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        to={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-600"
                      >
                        <span>View</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER DETAIL PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const r = useResource(() => customersApi.detail(id), [id]);
  const [erasureBusy, setErasureBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);

  const handleExport = async (customerId: string) => {
    setExportBusy(true);
    try {
      const exportData = await customersApi.export(customerId);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-export-${customerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export customer data.");
    } finally {
      setExportBusy(false);
    }
  };

  const handleErasure = async (customerId: string) => {
    if (
      !confirm(
        "Are you sure you want to process the Right to Erasure (GDPR Art. 17 / DPDP)? Personal data will be anonymized, future communications permanently suppressed, and statutory tax records retained under 7-year legal hold."
      )
    ) {
      return;
    }
    setErasureBusy(true);
    try {
      const res = await customersApi.erasure(customerId);
      setComplianceNotice(res.legal_notice);
      r.reload();
    } catch (e: any) {
      alert(e?.message || "Failed to process erasure.");
    } finally {
      setErasureBusy(false);
    }
  };

  return (
    <DetailLoad resource={r}>
      {(data: CustomerDetail) => (
        <>
          <PageHeader
            title={data.customer.name}
            detail={data.customer.company_name || data.customer.email}
            back="/customers"
          />

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              {/* Financial KPI */}
              <section className="panel p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Outstanding Balance
                </p>
                <p className="mt-2 font-mono text-3xl font-black text-slate-900 sm:text-4xl tabular-nums">
                  {money(data.summary.total_outstanding)}
                </p>

                <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-5">
                  <div className="pr-4">
                    <p className="text-xs font-medium text-slate-400">Total Invoiced</p>
                    <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                      {money(data.summary.total_invoiced)}
                    </p>
                  </div>
                  <div className="px-4">
                    <p className="text-xs font-medium text-slate-400">Total Paid</p>
                    <p className="mt-1 font-mono text-lg font-bold text-emerald-600">
                      {money(data.summary.total_paid)}
                    </p>
                  </div>
                  <div className="pl-4">
                    <p className="text-xs font-medium text-slate-400">Overdue Risk</p>
                    <p className="mt-1 font-mono text-lg font-bold text-rose-600">
                      {money(data.summary.overdue_amount)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Invoices List */}
              <section className="panel overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="font-bold text-slate-900">Invoices</h3>
                </div>
                {data.invoices.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50/70 border-b border-slate-100">
                        <tr>
                          <th className="table-head">Invoice</th>
                          <th className="table-head">Due Date</th>
                          <th className="table-head text-right">Amount</th>
                          <th className="table-head text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="table-cell">
                              <Link
                                to={`/invoices/${inv.id}`}
                                className="font-mono font-bold text-brand-600 hover:underline"
                              >
                                {inv.invoice_number}
                              </Link>
                            </td>
                            <td className="table-cell font-mono text-xs text-slate-500">
                              {date(inv.due_at)}
                            </td>
                            <td className="table-cell text-right font-mono font-bold text-slate-900">
                              {money(inv.amount, inv.currency)}
                            </td>
                            <td className="table-cell text-center">
                              <Badge value={inv.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-6 py-8 text-center text-xs text-slate-400">
                    No invoices on record for this customer.
                  </p>
                )}
              </section>

              <ActionsTable actions={data.collection_actions} />
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              <section className="panel p-6">
                <h3 className="font-bold text-slate-900 mb-4">Contact Profile</h3>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Email Address
                    </span>
                    <span className="mt-1 block font-mono font-medium text-slate-800">
                      {data.customer.email}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Phone
                    </span>
                    <span className="mt-1 block font-mono font-medium text-slate-800">
                      {data.customer.phone || "Not recorded"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="panel p-6">
                <h3 className="font-bold text-slate-900 mb-3">Conversations</h3>
                {data.conversations.length ? (
                  <div className="space-y-2">
                    {data.conversations.map((c) => (
                      <Link
                        key={c.id}
                        to={`/conversations/${c.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs transition-colors hover:bg-slate-50"
                      >
                        <span className="font-semibold text-slate-700">
                          {titleCase(c.channel)} Thread
                        </span>
                        <Badge value={c.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No conversations recorded yet.</p>
                )}
              </section>

              {/* Data Privacy & Statutory Rights */}
              <section className="panel p-6 border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Data Privacy & Compliance</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Exercise statutory rights under GDPR (EU) and India DPDP Act 2023.
                </p>

                {complianceNotice && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    {complianceNotice}
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    onClick={() => handleExport(data.customer.id)}
                    disabled={exportBusy}
                    className="btn-secondary w-full justify-center text-xs h-9"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    {exportBusy ? "Generating JSON..." : "Download Data Export (JSON)"}
                  </button>

                  <button
                    onClick={() => handleErasure(data.customer.id)}
                    disabled={erasureBusy || (data.customer as any).processing_restricted}
                    className="btn w-full justify-center text-xs h-9 border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100/70 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
                    {(data.customer as any).processing_restricted
                      ? "Processing Restricted (Legal Hold)"
                      : erasureBusy
                      ? "Processing Erasure..."
                      : "Process Right to Erasure"}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </DetailLoad>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function ConversationsPage() {
  const [query, setQuery] = useState("");
  const r = useResource(() => conversationsApi.list(), []);

  const conversations = useMemo(
    () =>
      (r.data || []).filter((c) =>
        `${c.channel} ${c.status}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [r.data, query],
  );

  return (
    <>
      <PageHeader
        title="Customer Inbox"
        detail="AI-classified customer email replies and automated negotiation threads."
        actions={
          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by channel or status..."
            />
          </div>
        }
      />

      {r.loading ? (
        <TableSkeleton rows={5} />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          detail="Inbound customer replies captured via Gmail or the API will show up here."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Thread ID</th>
                  <th className="table-head">Channel</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Last Updated</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversations.map((c) => (
                  <tr
                    key={c.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="table-cell">
                      <Link
                        to={`/conversations/${c.id}`}
                        className="font-mono text-xs font-bold text-brand-600 hover:underline"
                      >
                        {c.id.slice(0, 12)}...
                      </Link>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-slate-800">
                          {titleCase(c.channel)}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge value={c.status} />
                    </td>
                    <td className="table-cell text-right font-mono text-xs text-slate-500">
                      {dateTime(c.updated_at)}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        to={`/conversations/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                      >
                        <span>Open Thread</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION DETAIL PAGE (CHAT THREAD)
// ─────────────────────────────────────────────────────────────────────────────

export function ConversationDetailPage() {
  const { id = "" } = useParams();
  const r = useResource(() => conversationsApi.detail(id), [id]);

  return (
    <DetailLoad resource={r}>
      {(data: ConversationDetail) => (
        <>
          <PageHeader
            title="Conversation Thread"
            detail={`${titleCase(data.conversation.channel)} channel · AI intent classified`}
            back="/conversations"
            actions={<Badge value={data.conversation.status} />}
          />

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            {/* Chat View */}
            <section className="panel overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Message History
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Ledgerlane AI Engine Active
                  </span>
                </div>
              </div>

              <div className="space-y-6 p-6 flex-1">
                {data.messages.length ? (
                  data.messages.map((m) => {
                    const isOutbound = m.direction === "OUTBOUND";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-4.5 shadow-soft ${
                            isOutbound
                              ? "bg-gradient-to-tr from-brand-600 to-indigo-700 text-white rounded-tr-sm"
                              : "border border-slate-200/80 bg-white text-slate-800 rounded-tl-sm"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-4 text-[11px]">
                            <span
                              className={`font-bold uppercase tracking-wider ${
                                isOutbound ? "text-brand-100" : "text-slate-400"
                              }`}
                            >
                              {isOutbound ? "Your Automated Agent" : "Customer Reply"}
                            </span>
                            <span className={isOutbound ? "text-brand-200" : "text-slate-400"}>
                              {dateTime(m.created_at)}
                            </span>
                          </div>

                          {m.subject && (
                            <p
                              className={`mb-2 font-bold text-sm ${
                                isOutbound ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {m.subject}
                            </p>
                          )}

                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {m.body || "No text content recorded."}
                          </p>

                          {/* AI Intent Diagnostic Tag */}
                          {m.ai_intent && (
                            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                              <span className="text-[11px] font-bold text-slate-400">AI Intent:</span>
                              <Badge value={m.ai_intent} kind="intent" />
                              {m.ai_confidence && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                  {Math.round(Number(m.ai_confidence) * 100)}% match
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No messages in thread"
                    detail="Messages will be displayed as soon as they are received or dispatched."
                  />
                )}
              </div>
            </section>

            {/* Sidebar Context */}
            <aside className="space-y-6">
              <section className="panel p-6">
                <h3 className="font-bold text-slate-900 mb-4">Customer Context</h3>
                <Link
                  to={`/customers/${data.customer.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-slate-100 p-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 font-bold">
                    {data.customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      {data.customer.name}
                    </span>
                    <span className="block text-xs text-slate-400 font-mono">
                      {data.customer.email}
                    </span>
                  </div>
                </Link>
              </section>

              {data.invoice && (
                <section className="panel p-6">
                  <h3 className="font-bold text-slate-900 mb-3">Linked Invoice</h3>
                  <Link
                    to={`/invoices/${data.invoice.id}`}
                    className="block rounded-xl border border-slate-100 p-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-600 text-sm">
                        {data.invoice.invoice_number}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {money(data.invoice.amount, data.invoice.currency)}
                      </span>
                    </div>
                  </Link>
                </section>
              )}

              <ActionsTable actions={data.collection_actions} />
            </aside>
          </div>
        </>
      )}
    </DetailLoad>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION ACTIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────

const transitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "FAILED"],
};

export function ActionsPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const r = useResource(() => actionsApi.list(status || undefined), [status]);

  const update = async (action: CollectionAction, next: string) => {
    setBusy(action.id);
    setNotice(null);
    try {
      await actionsApi.updateStatus(action.id, next);
      r.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to transition action.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Collection Action Engine"
        detail="Scheduled autonomous outreach, dispute escalations, and payment verifications."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <select
          className="input w-full sm:w-56 text-xs font-semibold"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter collection actions by status"
        >
          <option value="">All Action Statuses</option>
          {["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"].map((v) => (
            <option value={v} key={v}>
              {titleCase(v)}
            </option>
          ))}
        </select>
        {notice && <p className="text-xs font-semibold text-rose-600">{notice}</p>}
      </div>

      {r.loading ? (
        <TableSkeleton rows={5} />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : !r.data?.value.length ? (
        <EmptyState
          title="No collection actions in queue"
          detail="Scheduled work generated by AI classification and overdue triggers will appear here."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Action Type</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Scheduled</th>
                  <th className="table-head">Executed</th>
                  <th className="table-head text-right">Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.data.value.map((action) => (
                  <tr key={action.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <Zap className="h-4 w-4 text-brand-600 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {titleCase(action.action_type.replace(/_/g, " "))}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {action.invoice_id ? "Invoice-level trigger" : "Account-level trigger"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge value={action.status} />
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {dateTime(action.scheduled_at)}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {dateTime(action.executed_at)}
                    </td>
                    <td className="table-cell text-right">
                      {(transitions[action.status] || []).length ? (
                        <select
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-soft"
                          disabled={busy === action.id}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) update(action, e.target.value);
                          }}
                        >
                          <option value="">Transition state...</option>
                          {transitions[action.status].map((next) => (
                            <option value={next} key={next}>
                              Set {titleCase(next)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">Terminal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-6 py-3.5 text-xs text-slate-400 font-mono">
            Total {r.data.Count} actions in ledger
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAGE (LOGIN / REGISTER)
// ─────────────────────────────────────────────────────────────────────────────

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    organization_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.email || !form.password || (mode === "register" && (!form.name || !form.organization_name))) {
      setError("Please complete all required fields.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        navigate("/dashboard");
      } else {
        await register(form);
        navigate("/login", { state: { registered: true } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((curr) => ({ ...curr, [field]: e.target.value }));

  const registering = mode === "register";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr] bg-slate-50 font-sans">
      {/* Left Hero Pane (Fintech Midnight Gradient) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-midnight-950 p-14 text-white lg:flex border-r border-white/10">
        {/* Glow ambient meshes */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-96 w-96 rounded-full bg-accent-cyan/15 blur-3xl" />

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">Ledgerlane</span>
        </div>

        <div className="max-w-md my-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-300 backdrop-blur-md mb-6">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Deterministic Financial Safety</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white sm:text-5xl">
            Autonomous receivables that collect faster.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-slate-300">
            Intelligently parse customer replies, automatically schedule follow-ups, and keep cash flow visible without manual email chasing.
          </p>

          <div className="mt-8 space-y-3.5 border-t border-white/10 pt-8 text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>AI intent classification with strict ledger guardrails</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Two-way Gmail sync with automated resolution</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Row-locked action queue preventing duplicate outreach</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Financial state remains authoritative and grounded in real bank receipts.
        </div>
      </section>

      {/* Right Form Pane */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold text-slate-900">Ledgerlane</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {registering ? "Create your workspace" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {registering
              ? "Set up your organization to automate receivables."
              : "Sign in to access your collection dashboard."}
          </p>

          <form className="mt-8 space-y-4.5" onSubmit={submit}>
            {registering && (
              <>
                <div>
                  <label className="label" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    className="input"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={form.name}
                    onChange={set("name")}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="organization">
                    Company / Organization Name
                  </label>
                  <input
                    id="organization"
                    className="input"
                    autoComplete="organization"
                    placeholder="Acme Studios"
                    value={form.organization_name}
                    onChange={set("organization_name")}
                  />
                </div>
              </>
            )}

            <div>
              <label className="label" htmlFor="email">
                Work Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={set("email")}
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={form.password}
                onChange={set("password")}
              />
            </div>

            {error && (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <button className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? "Authenticating..." : registering ? "Create Workspace" : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs font-medium text-slate-500">
            {registering ? "Already have an account?" : "Need a workspace?"}{" "}
            <Link
              className="font-bold text-brand-600 hover:text-brand-700 hover:underline"
              to={registering ? "/login" : "/register"}
            >
              {registering ? "Sign in" : "Create one now"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
