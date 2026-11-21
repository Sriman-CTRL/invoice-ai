import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  HelpCircle,
  Inbox,
  Layers,
  MessageSquare,
  Play,
  PlusCircle,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  Users,
  Zap,
} from "lucide-react";
import {
  ApiError,
  complianceApi,
  creditNotesApi,
  customersApi,
  invoicesApi,
  messagesApi,
  organizationsApi,
  overdueApi,
  paymentsApi,
} from "./api";
import { Badge, PageHeader } from "./components";
import { money, titleCase } from "./lib";
import type { Customer, Invoice } from "./types";

interface Scenario {
  id: string;
  label: string;
  intent: string;
  tagColor: string;
  from: string;
  subject: string;
  text: string;
  description: string;
}

const PRESET_SCENARIOS: Scenario[] = [
  {
    id: "promise",
    label: "Promise to Pay",
    intent: "PAYMENT_PROMISED",
    tagColor: "border-sky-200 bg-sky-50 text-sky-700",
    from: "rohan@pixelwave.in",
    subject: "Re: Invoice INV-1042 reminder",
    text: "Hi, apologies for the delay! We had a temporary banking glitch. I have scheduled this payment and will pay on next Friday the 28th for sure.",
    description: "AI extracts the promised date and arms a scheduled follow-up trigger for that exact day.",
  },
  {
    id: "dispute",
    label: "Invoice Dispute",
    intent: "DISPUTE",
    tagColor: "border-rose-200 bg-rose-50 text-rose-700",
    from: "priya@urbanroots.org",
    subject: "Discrepancy in Invoice INV-1044 hours",
    text: "There is an error on INV-1044. The design hours listed are 45 but our agreement was capped at 30 hours. Please pause automatic reminders and issue a revised bill.",
    description: "Flags the invoice as disputed, pauses automated dunning, and alerts an account manager.",
  },
  {
    id: "plan",
    label: "Payment Plan Request",
    intent: "PAYMENT_PLAN_REQUEST",
    tagColor: "border-amber-200 bg-amber-50 text-amber-800",
    from: "kavita@summitdesign.co",
    subject: "Split payment request for invoice",
    text: "Can we split this invoice into 3 monthly installments? Cash flow is tight this quarter. Let me know if that works.",
    description: "Identifies structured payment proposal and queues human review with recommended installment milestones.",
  },
  {
    id: "extension",
    label: "Request Extension",
    intent: "REQUEST_EXTENSION",
    tagColor: "border-purple-200 bg-purple-50 text-purple-700",
    from: "arjun@cloudscale.io",
    subject: "Extension request for INV-1043",
    text: "Could we please get a 2-week extension on this invoice? Our client's disbursement was delayed until next week.",
    description: "Evaluates credit history, computes an extended grace period, and pauses active escalations.",
  },
  {
    id: "claimed",
    label: "Claimed Already Paid",
    intent: "PAYMENT_CLAIMED",
    tagColor: "border-emerald-200 bg-emerald-50 text-emerald-800",
    from: "vikram@novalabs.tech",
    subject: "Already transferred funds yesterday",
    text: "Hey, we already transferred ₹18,500 via IMPS yesterday afternoon. UTR number is CMS9382103819. Please update your records.",
    description: "Triggers deterministic reconciliation against settled ledger entries before acknowledging or clearing.",
  },
  {
    id: "resend",
    label: "Request PDF Copy",
    intent: "RESEND_INVOICE",
    tagColor: "border-indigo-200 bg-indigo-50 text-indigo-700",
    from: "sana@bloominteriors.co",
    subject: "Missing copy of INV-1041",
    text: "Can you please re-send the PDF copy of invoice INV-1041 along with your GSTIN? Our finance team cannot locate the original mail.",
    description: "Instantly packages official PDF invoice with tax details and dispatches a verified reply.",
  },
];

export function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<"ai_sandbox" | "ledger_sim" | "compliance_center">("ai_sandbox");

  // Organization info & forwarding inbox
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [inbox, setInbox] = useState("");
  const [slug, setSlug] = useState("");
  const [slugNotice, setSlugNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copiedInbox, setCopiedInbox] = useState(false);

  // Entities state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Compliance & Suppressions state
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [newSuppressEmail, setNewSuppressEmail] = useState("");
  const [newSuppressReason, setNewSuppressReason] = useState("MANUAL_OPT_OUT");
  const [suppressNotice, setSuppressNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [suppressBusy, setSuppressBusy] = useState(false);

  // Pre-flight compliance check
  const [authCheckEmail, setAuthCheckEmail] = useState("rohan@pixelwave.in");
  const [authCheckInvoiceId, setAuthCheckInvoiceId] = useState("");
  const [authCheckResult, setAuthCheckResult] = useState<any>(null);
  const [authCheckBusy, setAuthCheckBusy] = useState(false);

  // Credit Note state
  const [creditInvoiceId, setCreditInvoiceId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("Service fee adjustment");
  const [creditNotice, setCreditNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);

  // Simulation Reply state
  const [reply, setReply] = useState({
    from: "rohan@pixelwave.in",
    subject: "Re: Invoice INV-1042 reminder",
    text: "Hi, apologies for the delay! We had a temporary banking glitch. I have scheduled this payment and will pay on next Friday the 28th for sure.",
  });
  const [replyResult, setReplyResult] = useState<any>(null);
  const [replyError, setReplyError] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  // Create Customer state
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    company_name: "",
    phone: "",
  });
  const [customerNotice, setCustomerNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [customerBusy, setCustomerBusy] = useState(false);

  // Create Invoice state
  const [newInvoice, setNewInvoice] = useState({
    customer_id: "",
    invoice_number: "",
    amount: "",
    due_in_days: "30",
  });
  const [invoiceNotice, setInvoiceNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  // Record Payment state
  const [newPayment, setNewPayment] = useState({ invoice_id: "", amount: "" });
  const [paymentNotice, setPaymentNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  // Overdue scan state
  const [scan, setScan] = useState<any>(null);
  const [scanNotice, setScanNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [scanBusy, setScanBusy] = useState(false);

  const loadOrg = () => {
    organizationsApi
      .me()
      .then((r) => {
        setOrg(r.organization);
        setInbox(r.inbox_address);
        setSlug(r.organization.slug);
      })
      .catch(() => {});
  };

  const loadData = () => {
    customersApi.list().then(setCustomers).catch(() => {});
    invoicesApi.list().then(setInvoices).catch(() => {});
    complianceApi.getSuppressions().then(setSuppressions).catch(() => {});
  };

  useEffect(() => {
    loadOrg();
    loadData();
  }, []);

  async function saveSuppression(e: React.FormEvent) {
    e.preventDefault();
    setSuppressNotice(null);
    setSuppressBusy(true);
    try {
      await complianceApi.addSuppression({
        address: newSuppressEmail,
        reason: newSuppressReason,
      });
      setSuppressNotice({ kind: "ok", text: `Address "${newSuppressEmail}" added to suppression list. Active dunning paused.` });
      setNewSuppressEmail("");
      loadData();
    } catch (err: any) {
      setSuppressNotice({ kind: "err", text: err?.message || "Failed to add suppression" });
    } finally {
      setSuppressBusy(false);
    }
  }

  async function checkComplianceAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthCheckBusy(true);
    try {
      const res = await complianceApi.authorizeSend({
        customer_email: authCheckEmail,
        invoice_id: authCheckInvoiceId || undefined,
      });
      setAuthCheckResult(res);
    } catch (err: any) {
      setAuthCheckResult({ allowed: false, reason: err?.message || "Pre-flight failed" });
    } finally {
      setAuthCheckBusy(false);
    }
  }

  async function saveCreditNote(e: React.FormEvent) {
    e.preventDefault();
    setCreditNotice(null);
    setCreditBusy(true);
    try {
      const res = await creditNotesApi.create({
        invoice_id: creditInvoiceId,
        amount: Number(creditAmount),
        reason: creditReason,
      });
      setCreditNotice({
        kind: "ok",
        text: `Credit Note ${res.creditNote.credit_note_number} successfully issued for ${money(creditAmount)}. Remaining invoice balance: ${money(res.remainingBalance)}.`,
      });
      setCreditInvoiceId("");
      setCreditAmount("");
      loadData();
    } catch (err: any) {
      setCreditNotice({ kind: "err", text: err?.message || "Failed to issue credit note" });
    } finally {
      setCreditBusy(false);
    }
  }

  const openInvoices = invoices.filter((i) => ["OPEN", "PARTIALLY_PAID"].includes(i.status));

  const applyScenario = (scenario: Scenario) => {
    setReply({
      from: scenario.from,
      subject: scenario.subject,
      text: scenario.text,
    });
    setReplyResult(null);
    setReplyError("");
  };

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    setReplyBusy(true);
    setReplyError("");
    setReplyResult(null);
    try {
      const result = await messagesApi.ingest({
        from: reply.from,
        subject: reply.subject,
        text: reply.text,
      });
      setReplyResult(result);
      loadData();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Failed to ingest reply");
    } finally {
      setReplyBusy(false);
    }
  }

  async function copyToClipboard(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInbox(true);
      setTimeout(() => setCopiedInbox(false), 2000);
    } catch {}
  }

  async function saveSlug(event: React.FormEvent) {
    event.preventDefault();
    setSlugNotice(null);
    try {
      const r = await organizationsApi.updateMe({ slug });
      setOrg(r.organization);
      setInbox(r.inbox_address);
      setSlugNotice({ kind: "ok", text: `Dedicated forwarding address updated to: ${r.inbox_address}` });
    } catch (error) {
      setSlugNotice({
        kind: "err",
        text: error instanceof ApiError ? error.message : "Failed to update address",
      });
    }
  }

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    setCustomerNotice(null);
    setCustomerBusy(true);
    try {
      await customersApi.create(newCustomer);
      setCustomerNotice({ kind: "ok", text: `Customer "${newCustomer.name}" successfully created.` });
      setNewCustomer({ name: "", email: "", company_name: "", phone: "" });
      loadData();
    } catch (error) {
      setCustomerNotice({
        kind: "err",
        text: error instanceof ApiError ? error.message : "Failed to create customer",
      });
    } finally {
      setCustomerBusy(false);
    }
  }

  async function saveInvoice(event: React.FormEvent) {
    event.preventDefault();
    setInvoiceNotice(null);
    setInvoiceBusy(true);
    try {
      const issued = new Date();
      const due = new Date();
      due.setDate(due.getDate() + Number(newInvoice.due_in_days || 30));
      await invoicesApi.create({
        customer_id: newInvoice.customer_id,
        invoice_number: newInvoice.invoice_number,
        amount: Number(newInvoice.amount),
        issued_at: issued.toISOString(),
        due_at: due.toISOString(),
      });
      setInvoiceNotice({
        kind: "ok",
        text: `Invoice ${newInvoice.invoice_number} created with due date ${due.toLocaleDateString()}.`,
      });
      setNewInvoice({
        customer_id: "",
        invoice_number: "",
        amount: "",
        due_in_days: "30",
      });
      loadData();
    } catch (error) {
      setInvoiceNotice({
        kind: "err",
        text: error instanceof ApiError ? error.message : "Failed to create invoice",
      });
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function savePayment(event: React.FormEvent) {
    event.preventDefault();
    setPaymentNotice(null);
    setPaymentBusy(true);
    try {
      await paymentsApi.create({
        invoice_id: newPayment.invoice_id,
        amount: Number(newPayment.amount),
      });
      setPaymentNotice({
        kind: "ok",
        text: "Settled payment recorded. Ledger updated and invoice recalculated.",
      });
      setNewPayment({ invoice_id: "", amount: "" });
      loadData();
    } catch (error) {
      setPaymentNotice({
        kind: "err",
        text: error instanceof ApiError ? error.message : "Failed to record payment",
      });
    } finally {
      setPaymentBusy(false);
    }
  }

  async function runScan() {
    setScanBusy(true);
    setScanNotice(null);
    setScan(null);
    try {
      const result = await overdueApi.process();
      setScan(result);
      setScanNotice({
        kind: "ok",
        text: `Engine analyzed ledger: ${result.invoices_detected} overdue invoice(s) scanned, ${result.actions_created} follow-up action(s) armed.`,
      });
    } catch (error) {
      setScanNotice({
        kind: "err",
        text: error instanceof Error ? error.message : "Overdue scan execution failed",
      });
    } finally {
      setScanBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulation Studio & AI Test Bench"
        detail="Interactively test natural language intent classification, date entity extraction, and deterministic ledger action execution in real time."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("ai_sandbox")}
              className={`btn text-xs font-semibold ${
                activeTab === "ai_sandbox"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              AI Reply Sandbox
            </button>
            <button
              onClick={() => setActiveTab("ledger_sim")}
              className={`btn text-xs font-semibold ${
                activeTab === "ledger_sim"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Financial Ledger Sim
            </button>
            <button
              onClick={() => setActiveTab("compliance_center")}
              className={`btn text-xs font-semibold ${
                activeTab === "compliance_center"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance & Privacy
            </button>
          </div>
        }
      />

      {/* SYSTEM TELEMETRY STRIP */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700">
              <Inbox className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Forwarding Mailbox
              </p>
              <p className="truncate font-mono text-xs font-semibold text-slate-800">
                {inbox || "Loading address..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(inbox)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
            title="Copy email to clipboard"
          >
            {copiedInbox ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="panel p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Financial Safety Gate
            </p>
            <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Strict Ledger Enforcement
            </p>
          </div>
        </div>

        <div className="panel p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-700">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Inbound Execution Loop
            </p>
            <p className="text-xs font-semibold text-indigo-700">
              Resolve → Classify → Decide Action
            </p>
          </div>
        </div>
      </div>

      {activeTab === "ai_sandbox" && (
        /* TAB 1: AI INFERENCE SANDBOX */
        <div className="space-y-6">
          {/* QUICK PRESET SCENARIO PICKER */}
          <div className="panel p-5 bg-gradient-to-br from-white via-slate-50/50 to-brand-50/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  Quick Simulation Scenarios
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click any business scenario to prefill realistic debtor messages and observe the autonomous response.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                6 Production Intent Models
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
              {PRESET_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => applyScenario(sc)}
                  className="group relative flex flex-col items-start rounded-xl border border-slate-200/90 bg-white p-3 text-left transition-all hover:border-brand-500 hover:shadow-card hover:-translate-y-0.5"
                >
                  <div className="flex w-full items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition-colors">
                      {sc.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${sc.tagColor}`}
                    >
                      {sc.intent}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {sc.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* INGESTION & MESSAGE FORM */}
            <div className="lg:col-span-7 space-y-6">
              <section className="panel p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-brand-600" />
                      Dispatch Inbound Customer Message
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Simulates an inbound webhook from Gmail, SendGrid, or Cloudflare Email Workers.
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                    POST /api/messages/ingest
                  </span>
                </div>

                <form onSubmit={submitReply} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">Debtor Email Address</label>
                      <input
                        className="input"
                        type="email"
                        value={reply.from}
                        onChange={(e) => setReply({ ...reply, from: e.target.value })}
                        placeholder="customer@domain.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Email Subject</label>
                      <input
                        className="input"
                        value={reply.subject}
                        onChange={(e) => setReply({ ...reply, subject: e.target.value })}
                        placeholder="Re: Invoice Reminder"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Customer Inbound Message Body</label>
                    <textarea
                      className="input min-h-[140px] py-2.5 font-sans leading-relaxed resize-y"
                      value={reply.text}
                      onChange={(e) => setReply({ ...reply, text: e.target.value })}
                      placeholder="Type or paste any customer communication here..."
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Safe execution mode: Non-destructive
                    </p>
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={replyBusy}
                    >
                      {replyBusy ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Classifying & Processing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Execute Pipeline
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {replyError && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-900">Ingestion Error</p>
                      <p className="mt-0.5 text-xs text-rose-700">{replyError}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* OVERDUE SCAN RUNNER */}
              <section className="panel p-6 border-slate-200/90">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-indigo-600" />
                      Trigger Overdue Invoice Engine Scan
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-lg">
                      Scans all active invoices across your organization, flags overdue debts past grace periods, and generates next-step follow-up actions idempotently.
                    </p>
                  </div>
                  <button
                    className="btn-secondary shrink-0"
                    onClick={runScan}
                    disabled={scanBusy}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${scanBusy ? "animate-spin text-brand-600" : ""}`} />
                    {scanBusy ? "Evaluating..." : "Run Overdue Scan"}
                  </button>
                </div>

                {scanNotice && (
                  <div
                    className={`mt-4 rounded-xl p-3.5 text-xs flex items-center gap-2.5 ${
                      scanNotice.kind === "ok"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {scanNotice.kind === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>{scanNotice.text}</span>
                  </div>
                )}

                {scan && scan.skipped?.length > 0 && (
                  <p className="mt-2.5 text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5 text-slate-600" />
                    {scan.skipped.length} invoice(s) skipped because an active pending follow-up is already armed.
                  </p>
                )}
              </section>
            </div>

            {/* LIVE AI INFERENCE RESULTS INSPECTOR */}
            <div className="lg:col-span-5">
              <div className="panel p-6 sticky top-6 bg-slate-900 text-white shadow-2xl border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-brand-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Real-time Inference Inspector
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ENGINE READY
                  </span>
                </div>

                {replyResult ? (
                  <div className="space-y-4">
                    {/* CLASSIFICATION STATUS */}
                    <div className="rounded-xl bg-slate-800/80 p-4 border border-slate-700/80">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Detected Natural Intent
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        {replyResult.classified && replyResult.classification ? (
                          <>
                            <Badge value={replyResult.classification.intent} kind="intent" />
                            <span className="font-mono text-xs text-slate-300 font-semibold">
                              {Math.round(Number(replyResult.classification.confidence) * 100)}% Confidence
                            </span>
                          </>
                        ) : (
                          <Badge value="UNCLASSIFIED" />
                        )}
                      </div>

                      {/* CONFIDENCE BAR */}
                      {replyResult.classification && (
                        <div className="mt-3">
                          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                              style={{
                                width: `${Math.round(
                                  Number(replyResult.classification.confidence) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* EXTRACTED ENTITIES */}
                    {replyResult.classification?.extracted_date && (
                      <div className="rounded-xl bg-slate-800/80 p-4 border border-slate-700/80">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Extracted Temporal Date Entity
                        </p>
                        <p className="font-mono text-sm font-bold text-amber-300 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {replyResult.classification.extracted_date}
                        </p>
                      </div>
                    )}

                    {/* DECIDED ACTION */}
                    <div className="rounded-xl bg-slate-800/80 p-4 border border-slate-700/80">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Autonomous Action Decided
                      </p>
                      {replyResult.collection_action ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge
                              value={replyResult.collection_action.action_type || "NO_ACTION"}
                            />
                            <span className="text-[11px] font-mono text-slate-400">
                              Status: {replyResult.collection_action.status || "PENDING"}
                            </span>
                          </div>

                          {replyResult.collection_action.skipped_reason && (
                            <p className="text-xs text-amber-300/90 bg-amber-950/40 p-2.5 rounded-lg border border-amber-900/50">
                              Notice: {replyResult.collection_action.skipped_reason}
                            </p>
                          )}

                          {replyResult.collection_action.payment_verification && (
                            <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700">
                              <p className="font-semibold text-white">Ledger Verification:</p>
                              <p className="mt-0.5 text-slate-400">
                                Verified: {replyResult.collection_action.payment_verification.status} —
                                Paid{" "}
                                {money(
                                  replyResult.collection_action.payment_verification.total_paid
                                )}{" "}
                                of{" "}
                                {money(
                                  replyResult.collection_action.payment_verification.invoice_amount
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No action generated</p>
                      )}
                    </div>

                    {/* NAVIGATION LINK */}
                    {replyResult.conversation_id && (
                      <Link
                        to={`/conversations/${replyResult.conversation_id}`}
                        className="btn w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/30"
                      >
                        Inspect Full Conversation Thread
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <Bot className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-sm font-semibold text-slate-300">Awaiting Inbound Payload</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Pick a scenario above or submit a custom message to watch the AI intent classifier & action engine analyze it.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL LEDGER & ENTITY SIMULATION */}
      {activeTab === "ledger_sim" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* CREATE CUSTOMER */}
          <section className="panel p-6">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <Users className="h-4 w-4 text-brand-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Create Debtor Customer</h3>
                <p className="text-xs text-slate-600">Register new client accounts</p>
              </div>
            </div>

            <form onSubmit={saveCustomer} className="space-y-3.5">
              <div>
                <label className="label">Contact Name *</label>
                <input
                  className="input"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="e.g. Maya Chen"
                  required
                />
              </div>
              <div>
                <label className="label">Customer Email *</label>
                <input
                  className="input"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="maya@lumina.io"
                  required
                />
              </div>
              <div>
                <label className="label">Company Name</label>
                <input
                  className="input"
                  value={newCustomer.company_name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, company_name: e.target.value })
                  }
                  placeholder="Lumina Design Labs"
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <button
                className="btn-secondary w-full justify-center mt-2"
                type="submit"
                disabled={customerBusy}
              >
                <PlusCircle className="mr-2 h-4 w-4 text-brand-600" />
                {customerBusy ? "Registering..." : "Add Customer"}
              </button>
            </form>

            {customerNotice && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs ${
                  customerNotice.kind === "ok"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {customerNotice.text}
              </div>
            )}
          </section>

          {/* CREATE INVOICE */}
          <section className="panel p-6">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <FileText className="h-4 w-4 text-brand-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Issue Receivables Invoice</h3>
                <p className="text-xs text-slate-600">Simulate a billed invoice</p>
              </div>
            </div>

            <form onSubmit={saveInvoice} className="space-y-3.5">
              <div>
                <label className="label">Debtor Client *</label>
                <select
                  className="input"
                  value={newInvoice.customer_id}
                  onChange={(e) => setNewInvoice({ ...newInvoice, customer_id: e.target.value })}
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Invoice Number *</label>
                <input
                  className="input"
                  value={newInvoice.invoice_number}
                  onChange={(e) =>
                    setNewInvoice({ ...newInvoice, invoice_number: e.target.value })
                  }
                  placeholder="e.g. INV-1090"
                  required
                />
              </div>

              <div>
                <label className="label">Amount (₹) *</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                  placeholder="45000"
                  required
                />
              </div>

              <div>
                <label className="label">Payment Terms (Days until Due)</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[0, 15, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewInvoice({ ...newInvoice, due_in_days: String(d) })}
                      className={`text-xs font-semibold py-1.5 rounded-lg border transition-colors ${
                        newInvoice.due_in_days === String(d)
                          ? "bg-brand-50 border-brand-500 text-brand-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d === 0 ? "Due Today" : `Net-${d}`}
                    </button>
                  ))}
                </div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={newInvoice.due_in_days}
                  onChange={(e) => setNewInvoice({ ...newInvoice, due_in_days: e.target.value })}
                  placeholder="Custom days"
                />
              </div>

              <button
                className="btn-secondary w-full justify-center mt-2"
                type="submit"
                disabled={invoiceBusy}
              >
                <PlusCircle className="mr-2 h-4 w-4 text-brand-600" />
                {invoiceBusy ? "Issuing..." : "Create Invoice"}
              </button>
            </form>

            {invoiceNotice && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs ${
                  invoiceNotice.kind === "ok"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {invoiceNotice.text}
              </div>
            )}
          </section>

          {/* RECORD PAYMENT */}
          <section className="panel p-6">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Post Settled Payment</h3>
                <p className="text-xs text-slate-600">Simulate bank/payment gateway ledger</p>
              </div>
            </div>

            <form onSubmit={savePayment} className="space-y-3.5">
              <div>
                <label className="label">Open Invoice *</label>
                <select
                  className="input"
                  value={newPayment.invoice_id}
                  onChange={(e) => {
                    const invId = e.target.value;
                    const inv = openInvoices.find((i) => i.id === invId);
                    setNewPayment({
                      invoice_id: invId,
                      amount: inv ? String(Number(inv.amount)) : "",
                    });
                  }}
                  required
                >
                  <option value="">Select outstanding invoice...</option>
                  {openInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} · Amount {money(Number(i.amount), i.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Payment Amount (₹) *</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  placeholder="e.g. 15000"
                  required
                />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Financial Integrity Note:</p>
                <p className="mt-0.5">
                  Payments posted here immediately settle the invoice ledger and recalculate debt recovery metrics.
                </p>
              </div>

              <button
                className="btn-secondary w-full justify-center mt-2"
                type="submit"
                disabled={paymentBusy}
              >
                <Zap className="mr-2 h-4 w-4 text-emerald-600" />
                {paymentBusy ? "Recording..." : "Record Payment"}
              </button>
            </form>

            {paymentNotice && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs ${
                  paymentNotice.kind === "ok"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {paymentNotice.text}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: REGULATORY COMPLIANCE & LEGAL SAFETY */}
      {activeTab === "compliance_center" && (
        <div className="space-y-6">
          {/* COMPLIANCE OVERVIEW BANNER */}
          <div className="panel p-5 bg-gradient-to-br from-slate-900 to-midnight-900 text-white border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Regulatory Guardrails Active
                  </span>
                  <span className="text-xs text-slate-400 font-mono">PCI-DSS · CAN-SPAM · FDCPA/UDAP · GST/VAT</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">FinTech Legal & Compliance Operations Center</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Real-time enforcement of statutory debtor protections, mandatory cooling-off cadences, deterministic opt-out suppressions, and tax-compliant negative credit adjustments.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Suppressions</p>
                  <p className="text-xl font-bold font-mono text-emerald-400">{suppressions.length}</p>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dispute Pauses</p>
                  <p className="text-xl font-bold font-mono text-amber-400">
                    {invoices.filter((i) => i.status === "DISPUTED").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* PANEL 1: SUPPRESSION & OPT-OUT REGISTRY */}
            <section className="panel p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Suppression Registry</h3>
                    <p className="text-xs text-slate-600">CAN-SPAM / Reg F / GDPR Opt-Outs</p>
                  </div>
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  {suppressions.length} Blocked
                </span>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                Entities listed here are immediately excluded from automated dunning cycles, email queues, and AI collection actions.
              </p>

              <form onSubmit={saveSuppression} className="space-y-3 mb-4">
                <div>
                  <label className="label">Debtor Email / Domain *</label>
                  <input
                    className="input text-xs"
                    type="email"
                    value={newSuppressEmail}
                    onChange={(e) => setNewSuppressEmail(e.target.value)}
                    placeholder="debtor@clientcompany.com"
                    required
                  />
                </div>
                <div>
                  <label className="label">Legal Basis / Reason</label>
                  <select
                    className="input text-xs"
                    value={newSuppressReason}
                    onChange={(e) => setNewSuppressReason(e.target.value)}
                  >
                    <option value="MANUAL_OPT_OUT">Manual Request / Unsubscribe</option>
                    <option value="LEGAL_DISPUTE_CEASE">Legal Cease & Desist / Dispute</option>
                    <option value="BANKRUPTCY_STAY">Automatic Bankruptcy Stay (§ 362)</option>
                    <option value="GDPR_ERASURE">GDPR Art. 17 / DPDP Right to Erasure</option>
                  </select>
                </div>
                <button className="btn-primary w-full text-xs justify-center" type="submit" disabled={suppressBusy}>
                  {suppressBusy ? "Adding..." : "Add to Suppression List"}
                </button>
              </form>

              {suppressNotice && (
                <div
                  className={`mb-4 rounded-xl p-3 text-xs ${
                    suppressNotice.kind === "ok"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {suppressNotice.text}
                </div>
              )}

              <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
                {suppressions.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-600">No active suppressions on file.</p>
                ) : (
                  suppressions.map((s: any) => (
                    <div key={s.id} className="p-2.5 flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate font-mono">{s.address}</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">{s.reason}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* PANEL 2: OUTBOUND COMPLIANCE PRE-FLIGHT GATE */}
            <section className="panel p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Clock className="h-4 w-4 text-brand-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Pre-Flight Send Authorization</h3>
                  <p className="text-xs text-slate-600">POST /internal/compliance/authorize-send</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                Simulate n8n & agent dispatch checks. Enforces dispute freezes, 3-day cooling-off windows, and time-of-day quiet hours.
              </p>

              <form onSubmit={checkComplianceAuth} className="space-y-3 mb-4">
                <div>
                  <label className="label">Target Debtor Email *</label>
                  <input
                    className="input text-xs"
                    type="email"
                    value={authCheckEmail}
                    onChange={(e) => setAuthCheckEmail(e.target.value)}
                    placeholder="target@company.com"
                    required
                  />
                </div>
                <div>
                  <label className="label">Associated Invoice (Optional)</label>
                  <select
                    className="input text-xs"
                    value={authCheckInvoiceId}
                    onChange={(e) => setAuthCheckInvoiceId(e.target.value)}
                  >
                    <option value="">-- No specific invoice --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} ({inv.status}) - {money(inv.amount)}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn-secondary w-full text-xs justify-center" type="submit" disabled={authCheckBusy}>
                  {authCheckBusy ? "Evaluating..." : "Run Compliance Pre-Flight Check"}
                </button>
              </form>

              {authCheckResult && (
                <div
                  className={`flex-1 rounded-xl p-4 text-xs border ${
                    authCheckResult.allowed
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-rose-50 text-rose-900 border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-2">
                    {authCheckResult.allowed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>DISPATCH AUTHORIZED (200 OK)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                        <span>DISPATCH BLOCKED: {authCheckResult.code || "BLOCKED"}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed mb-3">{authCheckResult.reason}</p>
                  {authCheckResult.disclosure_footer && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 text-[10px] text-emerald-700 font-mono">
                      <p className="font-semibold uppercase tracking-wider mb-1">EU AI Act Art. 50 Mandated Footer:</p>
                      <p className="italic bg-white/70 p-2 rounded border border-emerald-200">
                        {authCheckResult.disclosure_footer}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* PANEL 3: STATUTORY TAX CREDIT NOTES */}
            <section className="panel p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Receipt className="h-4 w-4 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Issue Tax Credit Note</h3>
                  <p className="text-xs text-slate-600">GST / VAT Immutable Negative Adjustment</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                Invoices cannot be altered or deleted under tax laws. Issue sequential, auditable credit notes to settle disputes or reduce amounts.
              </p>

              <form onSubmit={saveCreditNote} className="space-y-3 mb-4">
                <div>
                  <label className="label">Target Open Invoice *</label>
                  <select
                    className="input text-xs"
                    value={creditInvoiceId}
                    onChange={(e) => setCreditInvoiceId(e.target.value)}
                    required
                  >
                    <option value="">Select Invoice...</option>
                    {openInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} ({inv.status}) - Balance: {money(inv.amount)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Adjustment Amount (₹ / $) *</label>
                  <input
                    className="input text-xs font-mono"
                    type="number"
                    min="1"
                    step="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    required
                  />
                </div>
                <div>
                  <label className="label">Statutory Adjustment Reason *</label>
                  <input
                    className="input text-xs"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="Disputed design hours waived / service rebate"
                    required
                  />
                </div>
                <button className="btn-primary w-full text-xs justify-center" type="submit" disabled={creditBusy}>
                  {creditBusy ? "Issuing Note..." : "Issue Sequential Credit Note"}
                </button>
              </form>

              {creditNotice && (
                <div
                  className={`rounded-xl p-3 text-xs ${
                    creditNotice.kind === "ok"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {creditNotice.text}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* DEDICATED FORWARDING SLUG SETTINGS */}
      <section className="panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Inbox className="h-4 w-4 text-brand-600" />
              Configure Organization Inbound Mailbox Slug
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
              Customize your enterprise inbox prefix. Any email routed to this address automatically resolves customer conversations and executes the collection loop.
            </p>
          </div>

          <form onSubmit={saveSlug} className="flex items-center gap-2">
            <div className="relative">
              <input
                className="input h-9 w-48 font-mono text-xs pr-2"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-inbound"
                aria-label="Inbox slug"
                required
              />
            </div>
            <button className="btn-secondary h-9 px-3 text-xs shrink-0" type="submit">
              Update Slug
            </button>
          </form>
        </div>

        {slugNotice && (
          <div
            className={`mt-3 rounded-lg p-2.5 text-xs ${
              slugNotice.kind === "ok"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {slugNotice.text}
          </div>
        )}

        {/* Zero-Cost Cloudflare Custom Domain Integration */}
        <div className="mt-6 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-purple-50/20 to-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600/10 text-indigo-600 shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">Zero-Cost Custom Email Domain (Cloudflare)</h4>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 border border-emerald-300">
                    $0 / MONTH
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 max-w-xl">
                  Want to use <code className="font-mono text-indigo-600 font-bold">billing@youragency.com</code> without paying Google Workspace $7/user? Use Cloudflare&apos;s free Email Worker to pipe replies straight into your Invoice AI dashboard.
                </p>
              </div>
            </div>
            <a
              href="https://github.com/Sriman-CTRL/invoice-ai/tree/main/cloudflare-worker"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>View Worker Code & Setup</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
