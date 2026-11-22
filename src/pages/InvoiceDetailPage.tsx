import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Building2, Check, Copy, DollarSign, Lock, Mail, MessageSquare, Download, Printer, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import { invoicesApi, organizationsApi, paymentsApi } from "../api";
import { Badge, PageHeader } from "../components";
import { date, money, titleCase } from "../lib";
import type { Customer, Invoice, InvoiceDetail } from "../types";
import { useResource, DetailLoad, ActionsTable } from "./shared";
import { useToast } from "../toast";

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
  const toast = useToast();
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
      toast.success("Reminder sent", `Logged for ${invoice.invoice_number}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Reminder failed", err?.message);
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
  const toast = useToast();
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
      toast.success("Payment recorded", `${currency} ${num} applied to ${invoice.invoice_number}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Payment failed", err?.message);
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const toast = useToast();

  const handlePdf = async (detail: InvoiceDetail) => {
    setPdfBusy(true);
    try {
      const org = await organizationsApi.me().catch(() => null);
      const { downloadInvoicePdf } = await import("../invoicePdf");
      await downloadInvoicePdf(detail, { organizationName: org?.organization.name });
      toast.success("Invoice PDF ready", `${detail.invoice.invoice_number}.pdf downloaded.`);
    } catch (e: any) {
      toast.error("Could not generate PDF", e?.message);
    } finally {
      setPdfBusy(false);
    }
  };

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
                        toast.success("Payment link copied");
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
                      onClick={() => handlePdf(data)}
                      disabled={pdfBusy}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{pdfBusy ? "Building…" : "Download PDF"}</span>
                    </button>
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
