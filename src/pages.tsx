import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Play,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  UserCheck,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  actionsApi,
  ApiError,
  conversationsApi,
  customersApi,
  dashboardApi,
  invoicesApi,
  overdueApi,
  paymentsApi,
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

      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl font-mono tabular-nums">
            {value}
          </p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-700 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-brand-300 group-hover:bg-brand-50 group-hover:text-brand-600">
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
      resource.reload();
    } catch (err: any) {
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
// BULK CSV PARSER & TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function downloadSampleCSV() {
  const csvContent =
    "Customer Name,Customer Email,Company Name,Phone,Invoice Number,Amount,Currency,Due Date,Issue Date\n" +
    "Pixelwave Media,billing@pixelwave.in,Pixelwave Media Private Limited,+91 98200 10001,INV-3001,45000,INR,2026-12-15,2026-11-15\n" +
    "Nexus Cloud Solutions,accounts@nexuscloud.io,Nexus Cloud Corp,+1 415-555-0142,INV-3002,125000,INR,2026-11-30,2026-10-31\n" +
    "Hyperion Retail,finance@hyperionretail.com,Hyperion Retail Group,+91 98111 20002,INV-3003,78500,INR,2026-12-05,2026-11-05";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "invoices_sample_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        insideQuote = !insideQuote;
      } else if ((c === "," || c === "\t" || c === ";") && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    return row.map((r) => r.replace(/^"|"$/g, "").trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());

  const findCol = (...names: string[]) => {
    return headers.findIndex((h) => names.some((n) => h.includes(n)));
  };

  const nameIdx = findCol("customer name", "client name", "name");
  const emailIdx = findCol("customer email", "email", "mail");
  const companyIdx = findCol("company", "organization");
  const phoneIdx = findCol("phone", "mobile", "contact");
  const invNumIdx = findCol("invoice number", "invoice #", "invoice_number", "inv #", "invoice");
  const amountIdx = findCol("amount", "total", "balance", "price");
  const currencyIdx = findCol("currency");
  const dueIdx = findCol("due date", "due_date", "due_at", "due");
  const issuedIdx = findCol("issue date", "issued_at", "issued", "issue");
  const statusIdx = findCol("status");

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const email = emailIdx >= 0 ? cols[emailIdx] : "";
    const invNum = invNumIdx >= 0 ? cols[invNumIdx] : "";
    const rawAmt = amountIdx >= 0 ? cols[amountIdx].replace(/[^0-9.]/g, "") : "";
    const amount = parseFloat(rawAmt);
    const dueDate = dueIdx >= 0 ? cols[dueIdx] : "";
    const issuedDate = issuedIdx >= 0 ? cols[issuedIdx] : "";
    const name = nameIdx >= 0 ? cols[nameIdx] : "";
    const company = companyIdx >= 0 ? cols[companyIdx] : "";
    const phone = phoneIdx >= 0 ? cols[phoneIdx] : "";
    const currency = currencyIdx >= 0 && cols[currencyIdx] ? cols[currencyIdx].toUpperCase() : "INR";
    const status = statusIdx >= 0 && cols[statusIdx] ? cols[statusIdx].toUpperCase() : "OPEN";

    results.push({
      customer_name: name || company || (email ? email.split("@")[0] : "Customer"),
      customer_email: email,
      company_name: company || null,
      phone: phone || null,
      invoice_number: invNum,
      amount,
      currency,
      due_at: dueDate,
      issued_at: issuedDate || new Date().toISOString().split("T")[0],
      status,
      isValid: Boolean(email && email.includes("@") && invNum && !isNaN(amount) && amount > 0 && dueDate),
    });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK IMPORT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported_count: number;
    customers_created: number;
    skipped_count: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setError("No valid invoice rows found in the CSV. Make sure headers and data rows exist.");
        } else {
          setRows(parsed);
        }
      } catch (err: any) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(selected);
  };

  const validRows = rows.filter((r) => r.isValid);
  const totalAmount = validRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await invoicesApi.bulkImport(
        validRows.map((r) => ({
          customer_name: r.customer_name,
          customer_email: r.customer_email,
          company_name: r.company_name,
          phone: r.phone,
          invoice_number: r.invoice_number,
          amount: r.amount,
          currency: r.currency,
          due_at: r.due_at,
          issued_at: r.issued_at,
          status: r.status,
        }))
      );
      setImportResult(res);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to import invoices");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">1-Click Bulk Invoice Importer</h3>
              <p className="text-xs text-slate-500">
                Upload a CSV export from Excel, Tally, Zoho Books, or QuickBooks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {importResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Import Completed Successfully!</h4>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>{importResult.imported_count}</strong> invoices imported,{" "}
                  <strong>{importResult.customers_created}</strong> customer accounts auto-created
                  {importResult.skipped_count > 0 && `, ${importResult.skipped_count} duplicate invoices skipped`}
                  .
                </p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3 text-left rounded-lg bg-white/80 p-3 border border-emerald-200 text-xs text-slate-600 max-h-32 overflow-y-auto font-mono">
                  <div className="font-bold text-slate-700 mb-1">Notices:</div>
                  {importResult.errors.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Close & View Receivables
              </button>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:border-brand-500 hover:bg-brand-50/30 transition-all">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-soft text-brand-600">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-brand-600 hover:underline">
                      Click to choose CSV
                    </span>{" "}
                    or drag and drop your file here
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports .csv exports from Excel, Tally, Zoho Books, or QuickBooks (up to 500 rows)
                  </p>
                </div>
              </div>

              {/* Sample Template helper */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span>Need an example spreadsheet format?</span>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-1.5 font-bold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Sample CSV Template
                </button>
              </div>

              {/* Parsed Preview Table */}
              {rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-900">
                        Preview: {rows.length} rows parsed
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        {validRows.length} valid
                      </span>
                      {rows.length - validRows.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                          {rows.length - validRows.length} invalid
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold font-mono text-slate-900">
                      Total: {money(totalAmount)}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Invoice #</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2">Due Date</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={r.isValid ? "hover:bg-slate-50" : "bg-rose-50/40"}>
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">
                              {r.invoice_number || <span className="text-rose-500 italic">Missing</span>}
                            </td>
                            <td className="px-3 py-2">{r.customer_name}</td>
                            <td className="px-3 py-2 text-slate-500 font-mono">
                              {r.customer_email || <span className="text-rose-500 italic">Missing</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold">
                              {isNaN(r.amount) ? "—" : money(r.amount, r.currency)}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.due_at || "—"}</td>
                            <td className="px-3 py-2 text-center">
                              {r.isValid ? (
                                <span className="text-emerald-600 font-bold">✓ Ready</span>
                              ) : (
                                <span className="text-rose-500 font-bold">✕ Invalid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validRows.length === 0 || importing}
              onClick={handleImport}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Importing Invoices...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import {validRows.length} Invoices
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE INVOICE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split("T")[0]);

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const [dueAt, setDueAt] = useState(defaultDue.toISOString().split("T")[0]);
  const [deliverableVaultUrl, setDeliverableVaultUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    customersApi
      .list()
      .then((res) => {
        setCustomers(res);
        if (res.length > 0) {
          setCustomerId(res[0].id);
        } else {
          setIsNewCustomer(true);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    setSaving(true);
    try {
      let finalCustomerId = customerId;
      if (isNewCustomer) {
        if (!newCustomerEmail.trim() || !newCustomerEmail.includes("@")) {
          throw new Error("Valid customer email is required.");
        }
        const createdCustomer = await customersApi.create({
          name: newCustomerName.trim() || newCustomerEmail.split("@")[0],
          email: newCustomerEmail.trim().toLowerCase(),
          company_name: newCustomerCompany.trim() || undefined,
          phone: newCustomerPhone.trim() || undefined,
        });
        finalCustomerId = createdCustomer.id;
      }

      await invoicesApi.create({
        customer_id: finalCustomerId,
        invoice_number: invoiceNumber.trim(),
        amount: numAmount,
        currency,
        issued_at: issuedAt,
        due_at: dueAt,
        external_invoice_id: deliverableVaultUrl.trim() ? `vault:${deliverableVaultUrl.trim()}` : undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Create New Invoice</h3>
              <p className="text-xs text-slate-500">Record a new balance in the ledger.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Customer Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Customer</label>
              {customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsNewCustomer(!isNewCustomer)}
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  {isNewCustomer ? "Select existing customer" : "+ Add new customer"}
                </button>
              )}
            </div>

            {isNewCustomer ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="billing@acme.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Company Name</label>
                    <input
                      type="text"
                      value={newCustomerCompany}
                      onChange={(e) => setNewCustomerCompany(e.target.value)}
                      placeholder="Acme Inc"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Phone</label>
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="+91 98..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none bg-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company_name || c.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Invoice # & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Invoice Number</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-1001"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Amount</label>
              <div className="mt-1 flex items-center gap-1">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold bg-white"
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                </select>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Issued Date</label>
              <input
                type="date"
                required
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Due Date</label>
              <input
                type="date"
                required
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Deliverable Vault Escrow Lock (Fix My Itch: Freelancer Ghosting & SME Cashflow Shield) */}
          <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-600/10 text-indigo-600">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Zero-Cost Deliverable Vault (Escrow Lock)</p>
                <p className="text-[10px] text-slate-500">Lock work deliverables until client completes settlement</p>
              </div>
            </div>
            <input
              type="url"
              value={deliverableVaultUrl}
              onChange={(e) => setDeliverableVaultUrl(e.target.value)}
              placeholder="e.g. Figma file, Google Drive, GitHub repo, or Dropbox URL"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              When attached, client sees a locked vault card on their checkout page. Once payment is verified, the deliverables unlock instantly with zero gateway transaction fees.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-semibold text-slate-500 hidden sm:inline mr-1">
              {invoices.length} {invoices.length === 1 ? "record" : "records"}
            </span>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Invoice</span>
            </button>
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
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-mono font-bold text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                        {inv.external_invoice_id && (inv.external_invoice_id.startsWith("vault:") || inv.external_invoice_id.startsWith("http")) && (
                          <span
                            title={inv.status === "PAID" ? "Deliverable Vault Unlocked" : "Deliverable Held in Escrow Vault"}
                            className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              inv.status === "PAID"
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                : "text-indigo-700 bg-indigo-50 border-indigo-200"
                            }`}
                          >
                            <Lock className="h-2.5 w-2.5" />
                            {inv.status === "PAID" ? "Vault Unlocked" : "Vault"}
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center justify-end gap-2.5">
                        <a
                          href={`/pay/${inv.invoice_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open public payment portal"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          <span>Portal</span>
                        </a>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-brand-600"
                        >
                          <span>Details</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => resource.reload()}
      />
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => resource.reload()}
      />
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

function SendReminderModal({
  isOpen,
  onClose,
  invoice,
  customer,
  financialSummary,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  customer: Customer;
  financialSummary: { invoice_amount: number; outstanding_amount: number; currency: string };
  onSuccess: () => void;
}) {
  const [tone, setTone] = useState<"friendly" | "firm" | "urgent">("friendly");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const custName = customer.name || "Customer";
      const invNum = invoice.invoice_number;
      const due = date(invoice.due_at);
      const amt = `${financialSummary.currency} ${Number(financialSummary.outstanding_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

      if (tone === "friendly") {
        setSubject(`Friendly Reminder: Invoice ${invNum} is due`);
        setBody(
          `Hi ${custName},\n\nHope this finds you well. This is a gentle reminder that invoice ${invNum} for ${amt} was due on ${due}.\n\nPlease let us know if you need another copy of the invoice or banking details.\n\nBest regards,\nAccounts Receivable Team`
        );
      } else if (tone === "firm") {
        setSubject(`Overdue Notice: Invoice ${invNum} (${amt})`);
        setBody(
          `Dear ${custName},\n\nOur records show that invoice ${invNum} for ${amt} was due on ${due} and remains outstanding.\n\nTo keep your account in good standing, please arrange payment as soon as possible.\n\nThank you,\nFinance Department`
        );
      } else {
        setSubject(`URGENT: Final Notice for Overdue Invoice ${invNum}`);
        setBody(
          `Dear ${custName},\n\nThis is an urgent and final notification regarding overdue invoice ${invNum} for ${amt}, which was due on ${due}.\n\nImmediate payment is required to avoid service disruption or collections escalation.\n\nSincerely,\nCollections Management`
        );
      }
      setError(null);
    }
  }, [isOpen, tone, invoice.invoice_number, invoice.due_at, customer.name, financialSummary.currency, financialSummary.outstanding_amount]);

  if (!isOpen) return null;

  const handleSendPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await invoicesApi.sendReminder(invoice.id, { subject, body });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  const mailtoUrl = `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const cleanPhone = (customer.phone || "").replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `*Payment Reminder — Invoice ${invoice.invoice_number}*\n\n${body}\n\n👉 View & Pay Online: https://invoice-ai-nine-beta.vercel.app/pay/${invoice.invoice_number}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-brand-600" />
            <h3 className="font-bold text-slate-900">Send Payment Reminder</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSendPlatform} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-500">Recipient: </span>
              <span className="font-semibold text-slate-800">{customer.name} ({customer.email})</span>
            </div>
            <div>
              <span className="text-slate-500">Outstanding: </span>
              <span className="font-mono font-bold text-slate-900">
                {financialSummary.currency} {Number(financialSummary.outstanding_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Outreach Tone & Urgency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "friendly", label: "Friendly", sub: "0-15d overdue" },
                  { id: "firm", label: "Firm Notice", sub: "15-30d overdue" },
                  { id: "urgent", label: "Final Notice", sub: "30+d overdue" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    tone === t.id
                      ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <p className={`text-xs font-bold ${tone === t.id ? "text-brand-900" : "text-slate-700"}`}>
                    {t.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Email Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input w-full text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Email Message Body
            </label>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input w-full text-xs font-mono resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <a
                href={mailtoUrl}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Email Client</span>
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-lg transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </a>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary h-9 px-4 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="btn-primary h-9 px-4 text-xs font-bold"
              >
                {sending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send via Platform</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordPaymentModal({
  isOpen,
  onClose,
  invoice,
  outstandingAmount,
  currency,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  outstandingAmount: number;
  currency: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(outstandingAmount));
  const [tdsPct, setTdsPct] = useState<number>(0);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [externalPaymentId, setExternalPaymentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(String(outstandingAmount));
      setTdsPct(0);
      setPaidAt(new Date().toISOString().slice(0, 10));
      setExternalPaymentId("");
      setError(null);
    }
  }, [isOpen, outstandingAmount]);

  const applyTds = (pct: number) => {
    setTdsPct(pct);
    if (pct === 0) {
      setAmount(String(outstandingAmount));
    } else {
      const net = Math.round(outstandingAmount * (1 - pct / 100) * 100) / 100;
      setAmount(String(net));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }
    if (num > outstandingAmount + 0.001) {
      setError(`Payment cannot exceed remaining outstanding balance of ${currency} ${outstandingAmount}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await paymentsApi.create({
        invoice_id: invoice.id,
        amount: num,
        paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
        external_payment_id: externalPaymentId.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900">Record Received Payment</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-mono font-bold text-slate-800">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remaining Balance:</span>
              <span className="font-mono font-bold text-emerald-600">
                {currency} {outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Settlement Amount ({currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={outstandingAmount}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input w-full font-mono text-sm font-bold"
            />
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => applyTds(0)}
                className="text-[11px] font-semibold text-brand-600 hover:underline"
              >
                Full Balance ({currency} {outstandingAmount})
              </button>
              {outstandingAmount > 100 && (
                <button
                  type="button"
                  onClick={() => {
                    setTdsPct(0);
                    setAmount(String(Math.round(outstandingAmount / 2 * 100) / 100));
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                >
                  50% Partial
                </button>
              )}
            </div>

            {/* TDS / Withholding Quick Presets */}
            <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Client Deducted TDS at Source?
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { pct: 0, label: "0% (Full)" },
                  { pct: 1, label: "1% (194C)" },
                  { pct: 2, label: "2% (194C)" },
                  { pct: 10, label: "10% (194J)" },
                ].map((t) => (
                  <button
                    key={t.pct}
                    type="button"
                    onClick={() => applyTds(t.pct)}
                    className={`rounded-lg py-1 text-[11px] font-bold border transition-all ${
                      tdsPct === t.pct
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tdsPct > 0 && (
                <p className="text-[10px] text-slate-600 mt-1.5 font-medium leading-tight">
                  Applied {tdsPct}% TDS ({currency} {Math.round(outstandingAmount * (tdsPct / 100) * 100) / 100}). Net received in bank: <strong className="text-slate-900">{currency} {amount}</strong>
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="input w-full text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              External Reference / Transaction ID
            </label>
            <input
              type="text"
              placeholder="e.g. WIRE-2026-9812 or ACH-REF"
              value={externalPaymentId}
              onChange={(e) => setExternalPaymentId(e.target.value)}
              className="input w-full text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary h-9 px-4 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-9 px-4 text-xs font-bold"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Confirm Settlement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const r = useResource(() => invoicesApi.detail(id), [id]);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <DetailLoad resource={r}>
      {(data: InvoiceDetail) => {
        const inv = data.invoice;
        const fin = data.financial_summary;
        const totalAmount = Number(fin.invoice_amount) || 1;
        const paidAmount = Number(fin.paid_amount) || 0;
        const progressPct = Math.min(100, Math.round((paidAmount / totalAmount) * 100));
        const outstanding = Number(fin.outstanding_amount) || 0;

        return (
          <>
            <PageHeader
              title={`Invoice ${inv.invoice_number}`}
              detail={`Issued ${date(inv.issued_at)} · Due ${date(inv.due_at)}`}
              back="/invoices"
              actions={
                <div className="flex items-center gap-2">
                  <Badge value={inv.status} />
                  {outstanding > 0 && (
                    <>
                      <button
                        onClick={() => setReminderOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5 text-brand-600" />
                        <span>Send Reminder</span>
                      </button>
                      <button
                        onClick={() => setPaymentOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>Record Payment</span>
                      </button>
                    </>
                  )}
                </div>
              }
            />

            <SendReminderModal
              isOpen={reminderOpen}
              onClose={() => setReminderOpen(false)}
              invoice={inv}
              customer={data.customer}
              financialSummary={fin}
              onSuccess={r.reload}
            />

            <RecordPaymentModal
              isOpen={paymentOpen}
              onClose={() => setPaymentOpen(false)}
              invoice={inv}
              outstandingAmount={outstanding}
              currency={fin.currency}
              onSuccess={r.reload}
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

                {/* Instant Online Payment Link */}
                <section className="panel p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900 text-sm">Customer Payment Portal</h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" /> Live
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    Direct payment link for this invoice to share with customer.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`https://invoice-ai-nine-beta.vercel.app/pay/${inv.invoice_number}`}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600 select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://invoice-ai-nine-beta.vercel.app/pay/${inv.invoice_number}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="btn-secondary h-8 px-2.5 text-xs whitespace-nowrap"
                    >
                      {copied ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <Check className="h-3 w-3" /> Copied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Copy
                        </span>
                      )}
                    </button>
                    <a
                      href={`/pay/${inv.invoice_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary h-8 px-2.5 text-xs whitespace-nowrap inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-bold"
                      title="Open public payment portal"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>View</span>
                    </a>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <a
                      href={`https://wa.me/${(data.customer.phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        `Hi ${data.customer.name}, here is your invoice ${inv.invoice_number} for ${fin.currency} ${fin.outstanding_amount}. You can view details, scan UPI, or pay here: https://invoice-ai-nine-beta.vercel.app/pay/${inv.invoice_number}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Share on WhatsApp</span>
                    </a>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </section>

                {/* Deliverable Vault Escrow Status */}
                {inv.external_invoice_id && (inv.external_invoice_id.startsWith("vault:") || inv.external_invoice_id.startsWith("http")) && (
                  <section className="panel p-6 border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 to-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-indigo-600" />
                        <h3 className="font-bold text-slate-900 text-sm">Deliverable Vault</h3>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}>
                        {inv.status === "PAID" ? "🔓 Unlocked & Delivered" : "🔒 Held in Escrow"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                      {inv.status === "PAID"
                        ? "Payment is settled. Client has unlocked instant access to these project deliverables via their payment portal."
                        : "Deliverables are locked. Client cannot access the files until full payment is settled."}
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5 flex items-center justify-between text-xs font-mono">
                      <span className="truncate text-slate-600 max-w-[200px]">
                        {inv.external_invoice_id.replace(/^vault:/, "")}
                      </span>
                      <a
                        href={inv.external_invoice_id.replace(/^vault:/, "")}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 ml-2 shrink-0"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" /> Open
                      </a>
                    </div>
                  </section>
                )}

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
  const [scanning, setScanning] = useState(false);

  const r = useResource(() => actionsApi.list(status || undefined), [status]);

  const handleRunScan = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const res = await overdueApi.process();
      setNotice(
        `Automated sweep complete: ${res.invoices_detected} overdue invoice(s) evaluated, ${res.actions_created} collection action(s) created.`
      );
      r.reload();
    } catch (err: any) {
      setNotice("Scan failed: " + (err?.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  };

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

  const handleVerifyProof = async (actionId: string) => {
    setBusy(actionId);
    setNotice(null);
    try {
      const res = await actionsApi.verifyProof(actionId);
      setNotice(`Payment Settled! ${res.message}`);
      r.reload();
    } catch (err: any) {
      setNotice("Verification failed: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(null);
    }
  };

  const pendingProofs = (r.data?.value || []).filter(
    (a) => a.action_type === "VERIFY_PAYMENT_PROOF" && (a.status === "PENDING" || a.status === "PROCESSING")
  );

  return (
    <>
      <PageHeader
        title="Collection Action Engine"
        detail="Scheduled autonomous outreach, dispute escalations, and payment verifications."
        actions={
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {scanning ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Scanning Overdue...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Scan Overdue Invoices</span>
              </>
            )}
          </button>
        }
      />

      {/* Astryx Luminous Pending Payment Proofs Alert */}
      {pendingProofs.length > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-5 text-white shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">
                    {pendingProofs.length} Client Payment Proof{pendingProofs.length > 1 ? "s" : ""} Awaiting Settlement
                  </h4>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                    ACTION REQUIRED
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  Clients have submitted UTR / reference IDs via your public checkout portal. Click &ldquo;1-Click Settle&rdquo; below to mark invoices PAID and automatically unlock deliverable vaults.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
        {notice && (
          <p className={`text-xs font-semibold ${notice.includes("Settled") || notice.includes("complete") ? "text-emerald-600" : "text-rose-600"}`}>
            {notice}
          </p>
        )}
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
                  <th className="table-head">Invoice & Customer</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Scheduled</th>
                  <th className="table-head text-right">Settlement / Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.data.value.map((action) => {
                  const meta = (action.metadata || {}) as Record<string, any>;
                  const isProof = action.action_type === "VERIFY_PAYMENT_PROOF";
                  const canSettle = isProof && (action.status === "PENDING" || action.status === "PROCESSING");

                  return (
                    <tr key={action.id} className={`transition-colors ${canSettle ? "bg-emerald-50/30 hover:bg-emerald-50/50" : "hover:bg-slate-50/70"}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          {isProof ? (
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 shrink-0">
                              <Zap className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {titleCase(action.action_type.replace(/_/g, " "))}
                            </p>
                            {isProof && meta.utr ? (
                              <p className="font-mono text-[11px] font-bold text-emerald-700">
                                UTR: {meta.utr} {meta.amount ? `· ₹${meta.amount}` : ""}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                {action.invoice_id ? "Invoice-level trigger" : "Account-level trigger"}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          {action.invoices?.invoice_number ? (
                            <Link
                              to={`/invoices/${action.invoice_id}`}
                              className="font-mono font-bold text-brand-600 hover:underline text-xs"
                            >
                              {action.invoices.invoice_number}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">—</span>
                          )}
                          {action.customers?.name && (
                            <p className="text-[11px] text-slate-500 font-medium">
                              {action.customers.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge value={action.status} />
                      </td>
                      <td className="table-cell font-mono text-xs text-slate-500">
                        {dateTime(action.scheduled_at)}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canSettle && (
                            <button
                              onClick={() => handleVerifyProof(action.id)}
                              disabled={busy === action.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all hover:scale-105"
                            >
                              {busy === action.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              <span>1-Click Settle</span>
                            </button>
                          )}

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
                          ) : !canSettle ? (
                            <span className="font-mono text-[11px] text-slate-400">Terminal</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

  const fillDemo = () => {
    setForm((curr) => ({
      ...curr,
      email: "srimanbhavani961@gmail.com",
      password: "bhavanisri",
    }));
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr] bg-slate-950 font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Hero Pane (Astryx Obsidian & Luminous Meshes) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-midnight-950 p-12 lg:flex border-r border-white/10 text-white">
        {/* Luminous ambient meshes */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[450px] w-[450px] rounded-full bg-accent-cyan/15 blur-[120px]" />

        {/* Brand Header */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-violet-500 shadow-glow ring-1 ring-white/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block">Ledgerlane</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Autonomous Receivables OS
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Gemini 2.5 Flash Online</span>
          </div>
        </div>

        {/* Center Content */}
        <div className="max-w-lg my-auto py-8 z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1 text-xs font-bold text-brand-300 backdrop-blur-md mb-5">
            <Zap className="h-3.5 w-3.5 text-brand-400" />
            <span>Eliminating 10+ Hours of AR Admin Weekly</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight leading-[1.15] text-white sm:text-5xl">
            Autonomous receivables that collect{" "}
            <span className="bg-gradient-to-r from-brand-300 via-indigo-200 to-teal-200 bg-clip-text text-transparent">
              14 days faster.
            </span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Intelligently parses customer excuses with Gemini AI, schedules automated follow-ups with zero founder awkwardness, and settles directly to bank accounts via zero-fee UPI.
          </p>

          {/* Astryx Live AR Simulation Bento Card */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4.5 backdrop-blur-xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] font-bold text-white tracking-wide">
                  REAL-TIME AR EVENT · INV-1042
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                ₹45,000 DUE
              </span>
            </div>

            {/* Inbound Customer Message Simulation */}
            <div className="rounded-xl bg-slate-900/90 border border-white/5 p-3 text-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-bold text-slate-300">From: Rohan Mehta (Acme Studios)</span>
                <span className="font-mono">Inbound Email</span>
              </div>
              <p className="text-slate-200 italic font-mono text-[11px] leading-relaxed">
                "Our finance head was out of office. We've scheduled the ₹45,000 transfer for this Friday via RTGS."
              </p>
            </div>

            {/* Gemini Classification Badge */}
            <div className="flex items-center justify-between rounded-xl bg-brand-500/15 border border-brand-500/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-brand-300 shrink-0" />
                <span className="font-bold text-brand-200">Gemini 2.5 Classified:</span>
              </div>
              <span className="font-mono text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                PAYMENT_PROMISED (99.8%)
              </span>
            </div>

            {/* Autonomous Action */}
            <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Chasing halted · Check-in auto-calendared for Friday</span>
            </div>
          </div>

          {/* 3 Bento Mini-Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">DSO Speed</span>
              <p className="text-sm font-black text-emerald-400 mt-0.5 font-mono">14 Days Faster</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Transaction Fees</span>
              <p className="text-sm font-black text-brand-300 mt-0.5 font-mono">0% (UPI Direct)</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Admin Saved</span>
              <p className="text-sm font-black text-teal-300 mt-0.5 font-mono">10+ Hrs / Wk</p>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-white/10 pt-4 z-10">
          <div className="flex items-center gap-3">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          </div>
          <span>Reg F & CAN-SPAM Suppressed</span>
        </div>
      </section>

      {/* Right Form Pane */}
      <section className="flex items-center justify-center p-6 sm:p-12 bg-slate-900/60 backdrop-blur-xl">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-white">Ledgerlane</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              AI Active
            </span>
          </div>

          {/* Form Header Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-white/10 mb-6">
              <Link
                to="/login"
                className={`w-1/2 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  !registering
                    ? "bg-brand-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className={`w-1/2 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  registering
                    ? "bg-brand-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Create Account
              </Link>
            </div>

            <div>
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                {registering ? "Deploy your AR Workspace" : "Access your Command Center"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {registering
                  ? "Set up autonomous receivables for your business in 30 seconds."
                  : "Sign in to manage active collections and ledger balances."}
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {registering && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="name">
                      Full Name *
                    </label>
                    <input
                      id="name"
                      className="input bg-slate-950 border-white/10 text-white text-xs"
                      autoComplete="name"
                      placeholder="Sriman Bhavani"
                      value={form.name}
                      onChange={set("name")}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="organization">
                      Company / Organization Name *
                    </label>
                    <input
                      id="organization"
                      className="input bg-slate-950 border-white/10 text-white text-xs"
                      autoComplete="organization"
                      placeholder="Acme Technologies"
                      value={form.organization_name}
                      onChange={set("organization_name")}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="email">
                  Work Email *
                </label>
                <input
                  id="email"
                  className="input bg-slate-950 border-white/10 text-white text-xs"
                  type="email"
                  autoComplete="email"
                  placeholder="srimanbhavani961@gmail.com"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="password">
                    Password *
                  </label>
                  {!registering && (
                    <button
                      type="button"
                      onClick={fillDemo}
                      className="text-[10px] font-semibold text-brand-400 hover:text-brand-300 hover:underline"
                    >
                      Fill Demo Credentials
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  className="input bg-slate-950 border-white/10 text-white text-xs"
                  type="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  placeholder="••••••••••"
                  value={form.password}
                  onChange={set("password")}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-300 flex items-center justify-between animate-fade-in">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-11 text-xs font-bold shadow-glow mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Connecting to Ledger...</span>
                  </>
                ) : registering ? (
                  <span>Initialize Organization Workspace</span>
                ) : (
                  <span>Enter Collection Dashboard</span>
                )}
              </button>
            </form>
          </div>

          {/* Legal Compliance Footer Links */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">
              Terms & Escrow
            </Link>
            <span>•</span>
            <span>DPDP & FDCPA Certified</span>
          </div>
        </div>
      </section>
    </main>
  );
}
