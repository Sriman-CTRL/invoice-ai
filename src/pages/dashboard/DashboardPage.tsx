import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { dashboardApi, overdueInvoicesApi } from "../../api";
import type { Dashboard, Invoice, Payment, CollectionAction } from "../../types";
import { money, dateTime, date, titleCase, formatActionType } from "../../lib/utils";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineMessage, setEngineMessage] = useState<string | null>(null);

  const fetchDashboard = () => {
    setLoading(true);
    setError(null);
    dashboardApi
      .get()
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || "Failed to load dashboard metrics.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRunOverdueEngine = async () => {
    setEngineRunning(true);
    setEngineMessage(null);
    try {
      const res = await overdueInvoicesApi.process();
      setEngineMessage(
        `Engine processed ${res.invoices_detected} overdue invoice(s) and generated ${res.actions_created} collection action(s).`
      );
      fetchDashboard();
    } catch (err: any) {
      setEngineMessage(`Execution failed: ${err.message || "Engine error"}`);
    } finally {
      setEngineRunning(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Executive Dashboard"
          description="Receivables portfolio health, aging analysis, and collection follow-through."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-28 rounded-lg border border-line bg-white animate-pulse" />
          <div className="h-28 rounded-lg border border-line bg-white animate-pulse" />
          <div className="h-28 rounded-lg border border-line bg-white animate-pulse" />
          <div className="h-28 rounded-lg border border-line bg-white animate-pulse" />
        </div>
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Executive Dashboard" />
        <ErrorState message={error || "Dashboard data unavailable"} retry={fetchDashboard} />
      </div>
    );
  }

  const { financial_summary, invoice_summary, customer_summary, collection_summary, recent_activity } = data;
  const currency = financial_summary.currency || "USD";

  // Calculate recovery rate percentage
  const recoveryRate = financial_summary.total_invoiced > 0
    ? Math.round((financial_summary.total_paid / financial_summary.total_invoiced) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header with Action */}
      <PageHeader
        title="Executive Receivables Dashboard"
        description="Authoritative portfolio balance, overdue exposure, and AI-assisted collections pipeline."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchDashboard}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="brand"
              loading={engineRunning}
              onClick={handleRunOverdueEngine}
              icon={<Play className="h-3.5 w-3.5 fill-current" />}
            >
              Run Collections Engine
            </Button>
          </div>
        }
      />

      {/* Engine Execution Notice */}
      {engineMessage && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm text-emerald-900 shadow-soft">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{engineMessage}</span>
          </div>
          <button
            onClick={() => setEngineMessage(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Financial KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Invoiced"
          value={money(financial_summary.total_invoiced, currency)}
          subtitle={`${invoice_summary.total} active invoice(s) generated`}
          accent="brand"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Total Collected"
          value={money(financial_summary.total_paid, currency)}
          subtitle={`${recoveryRate}% cash conversion rate`}
          accent="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Total Outstanding"
          value={money(financial_summary.total_outstanding, currency)}
          subtitle={`${customer_summary.customers_with_outstanding} debtor customer(s)`}
          accent="sky"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title="Overdue Outstanding"
          value={money(financial_summary.overdue_outstanding, currency)}
          subtitle={`${customer_summary.customers_with_overdue} account(s) past due`}
          accent="rose"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </section>

      {/* Operational Visualizations: Status Breakdown & Action Pipeline */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Invoice Status Distribution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Invoice Status Distribution</CardTitle>
              <CardDescription>
                Classification of active invoices in the organization's ledger.
              </CardDescription>
            </div>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              <span>View ledger</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual ratio bar */}
            {invoice_summary.total > 0 ? (
              <div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {invoice_summary.paid > 0 && (
                    <div
                      style={{ width: `${(invoice_summary.paid / invoice_summary.total) * 100}%` }}
                      className="bg-emerald-500"
                      title={`Paid: ${invoice_summary.paid}`}
                    />
                  )}
                  {invoice_summary.partially_paid > 0 && (
                    <div
                      style={{ width: `${(invoice_summary.partially_paid / invoice_summary.total) * 100}%` }}
                      className="bg-sky-500"
                      title={`Partially Paid: ${invoice_summary.partially_paid}`}
                    />
                  )}
                  {invoice_summary.open > 0 && (
                    <div
                      style={{ width: `${(invoice_summary.open / invoice_summary.total) * 100}%` }}
                      className="bg-blue-400"
                      title={`Open: ${invoice_summary.open}`}
                    />
                  )}
                  {invoice_summary.overdue > 0 && (
                    <div
                      style={{ width: `${(invoice_summary.overdue / invoice_summary.total) * 100}%` }}
                      className="bg-rose-500"
                      title={`Overdue: ${invoice_summary.overdue}`}
                    />
                  )}
                  {invoice_summary.draft > 0 && (
                    <div
                      style={{ width: `${(invoice_summary.draft / invoice_summary.total) * 100}%` }}
                      className="bg-slate-300"
                      title={`Draft: ${invoice_summary.draft}`}
                    />
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded border border-line p-2.5">
                    <span className="text-muted block">Open</span>
                    <span className="text-base font-semibold font-mono text-ink mt-0.5 block">
                      {invoice_summary.open || 0}
                    </span>
                  </div>
                  <div className="rounded border border-line p-2.5">
                    <span className="text-muted block">Partially Paid</span>
                    <span className="text-base font-semibold font-mono text-ink mt-0.5 block">
                      {invoice_summary.partially_paid || 0}
                    </span>
                  </div>
                  <div className="rounded border border-line p-2.5">
                    <span className="text-muted block">Overdue</span>
                    <span className="text-base font-semibold font-mono text-rose-700 mt-0.5 block">
                      {invoice_summary.overdue || 0}
                    </span>
                  </div>
                  <div className="rounded border border-line p-2.5">
                    <span className="text-muted block">Fully Paid</span>
                    <span className="text-base font-semibold font-mono text-emerald-700 mt-0.5 block">
                      {invoice_summary.paid || 0}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">No invoices recorded in this organization yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Collection Actions Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Collections Action Pipeline</CardTitle>
              <CardDescription>
                State of automated and escalative collection follow-ups.
              </CardDescription>
            </div>
            <Link
              to="/collection-actions"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              <span>View actions</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded border border-amber-200/80 bg-amber-50/40 p-3">
                <span className="text-amber-800 font-medium block">Pending Follow-up</span>
                <span className="text-xl font-bold font-mono text-amber-950 mt-1 block">
                  {collection_summary.pending || 0}
                </span>
                <span className="text-[10px] text-amber-700 mt-0.5 block">Awaiting execution</span>
              </div>
              <div className="rounded border border-sky-200/80 bg-sky-50/40 p-3">
                <span className="text-sky-800 font-medium block">In Processing</span>
                <span className="text-xl font-bold font-mono text-sky-950 mt-1 block">
                  {collection_summary.processing || 0}
                </span>
                <span className="text-[10px] text-sky-700 mt-0.5 block">Active communication</span>
              </div>
              <div className="rounded border border-emerald-200/80 bg-emerald-50/40 p-3">
                <span className="text-emerald-800 font-medium block">Completed</span>
                <span className="text-xl font-bold font-mono text-emerald-950 mt-1 block">
                  {collection_summary.completed || 0}
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">Successfully resolved</span>
              </div>
              <div className="rounded border border-rose-200/80 bg-rose-50/40 p-3">
                <span className="text-rose-800 font-medium block">Failed / Escalated</span>
                <span className="text-xl font-bold font-mono text-rose-950 mt-1 block">
                  {collection_summary.failed || 0}
                </span>
                <span className="text-[10px] text-rose-700 mt-0.5 block">Manual review needed</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3 col-span-2 sm:col-span-2">
                <span className="text-slate-700 font-medium block">Customer Debt Coverage</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-base font-bold font-mono text-ink">
                    {customer_summary.total_customers} Customer Accounts
                  </span>
                  <span className="text-xs text-muted">
                    {customer_summary.customers_with_outstanding} with open balance
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity Streams: Invoices, Payments, and Collection Actions */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Recent Invoices */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Recent Invoices</CardTitle>
            <Link to="/invoices" className="text-xs text-brand-700 hover:underline">
              All
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {recent_activity.invoices && recent_activity.invoices.length > 0 ? (
              <div className="divide-y divide-line/60">
                {recent_activity.invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="p-3.5 px-5 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-medium text-xs text-brand-700 hover:underline font-mono"
                      >
                        {inv.invoice_number}
                      </Link>
                      <span className="font-mono text-xs font-semibold text-ink">
                        {money(inv.amount, inv.currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                      <span className="truncate max-w-[140px]">
                        {inv.customers?.name || "Customer"}
                      </span>
                      <Badge value={inv.status} kind="invoice" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-xs text-muted text-center">No recent invoices</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Verified Payments</CardTitle>
            <span className="text-[11px] text-emerald-700 font-medium">Authoritative</span>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {recent_activity.payments && recent_activity.payments.length > 0 ? (
              <div className="divide-y divide-line/60">
                {recent_activity.payments.slice(0, 5).map((pmt) => (
                  <div key={pmt.id} className="p-3.5 px-5 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900 font-mono">
                        {pmt.invoices?.invoice_number ? `For ${pmt.invoices.invoice_number}` : "Payment recorded"}
                      </span>
                      <span className="font-mono text-xs font-semibold text-emerald-700">
                        +{money(pmt.amount, pmt.currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                      <span>{date(pmt.paid_at || pmt.created_at)}</span>
                      <Badge value={pmt.status} kind="payment" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-xs text-muted text-center">No payment transactions recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Collection Actions */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Triggered Actions</CardTitle>
            <Link to="/collection-actions" className="text-xs text-brand-700 hover:underline">
              All
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {recent_activity.collection_actions && recent_activity.collection_actions.length > 0 ? (
              <div className="divide-y divide-line/60">
                {recent_activity.collection_actions.slice(0, 5).map((act) => (
                  <div key={act.id} className="p-3.5 px-5 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 truncate max-w-[170px]">
                        {formatActionType(act.action_type)}
                      </span>
                      <Badge value={act.status} kind="action" />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                      <span className="truncate max-w-[130px]">
                        {act.customers?.name || "Customer"}
                      </span>
                      <span>{date(act.scheduled_at || act.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-xs text-muted text-center">No collection actions triggered</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
