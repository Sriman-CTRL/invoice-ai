import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Mail,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlock,
  Building2,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { publicApi } from "./api";
import { compressImage } from "./imageUtil";
import { TURNSTILE_SITE_KEY, TurnstileWidget } from "./TurnstileWidget";
import type { PublicInvoiceDetail } from "./types";

function buildUpiUri(d: PublicInvoiceDetail) {
  const payee = (d.payment.payee_name || d.organization.name).replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 25);
  const inv = d.invoice_number.replace(/[^a-zA-Z0-9-]/g, "");
  return `upi://pay?pa=${encodeURIComponent(d.payment.upi_id || "")}&pn=${encodeURIComponent(payee)}&am=${Number(d.outstanding_amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv}`)}`;
}

function NotConfigured({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-xs leading-relaxed text-amber-100">
      <p className="font-bold">{what} isn't set up for this invoice yet.</p>
      <p className="mt-1 text-amber-200/80">Please ask the sender for their payment details, or use another method.</p>
    </div>
  );
}

export function PublicPayPage() {
  const { invoiceNumber = "" } = useParams();
  const [data, setData] = useState<PublicInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment tab: "upi" | "bank" | "proof"
  const [activeTab, setActiveTab] = useState<"upi" | "bank" | "proof">("upi");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // UTR submission state
  const [utr, setUtr] = useState("");
  const [proofAmount, setProofAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [humanToken, setHumanToken] = useState<string | null>(null);
  const [humanReset, setHumanReset] = useState(0);
  const [proofSuccess, setProofSuccess] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getInvoice(invoiceNumber);
      setData(res);
      // Personal UPI IDs are capped at about ₹1 lakh per payment; steer large invoices to bank transfer.
      if (res.outstanding_amount > 100000 && res.payment?.bank) setActiveTab("bank");
      setProofAmount(String(res.outstanding_amount));
    } catch (err: any) {
      setError(err?.message || "Invoice not found or link has expired.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceNumber) {
      fetchInvoice();
    }
  }, [invoiceNumber]);

  // Generate dynamic UPI QR Code when invoice data is loaded
  useEffect(() => {
    if (data && data.outstanding_amount > 0 && data.payment?.upi_id) {
      // Standard NPCI UPI URI Scheme, paying the invoice owner's own UPI ID
      const upiUri = buildUpiUri(data);

      QRCode.toDataURL(upiUri, {
        width: 256,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [data]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utr.trim()) {
      setProofError("Please enter your 12-digit UTR or Transaction Reference number.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !humanToken) {
      setProofError("Please complete the human check below.");
      return;
    }
    setSubmittingProof(true);
    setProofError(null);
    setProofSuccess(null);
    try {
      const res = await publicApi.submitProof(invoiceNumber, {
        utr: utr.trim(),
        amount: parseFloat(proofAmount) || undefined,
        notes: notes.trim() || undefined,
        screenshot: screenshot || undefined,
        turnstile_token: humanToken || undefined,
      });
      setProofSuccess(res.message);
      setUtr("");
      setNotes("");
      setScreenshot(null);
      fetchInvoice();
    } catch (err: any) {
      setProofError(err?.message || "Failed to submit payment reference.");
      setHumanReset((n) => n + 1);
    } finally {
      setSubmittingProof(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-400" />
          <p className="text-sm font-semibold tracking-wide">Loading Secure Payment Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-slate-800/90 border border-slate-700 p-8 text-center backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Invoice Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            {error || "The requested invoice could not be located. Please check the link or contact the billing issuer."}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-500 transition-colors"
          >
            <span>Go to Paivo</span>
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = data.status === "PAID" || data.outstanding_amount <= 0;
  const isPartiallyPaid = data.status === "PARTIALLY_PAID" && data.outstanding_amount > 0;
  const totalAmount = data.amount;
  const paidAmount = data.paid_amount;
  const outstanding = data.outstanding_amount;
  const progressPct = Math.min(100, Math.round((paidAmount / (totalAmount || 1)) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans selection:bg-brand-500 selection:text-white">
      {data.organization.brand_color && <div className="h-1 w-full" style={{ background: data.organization.brand_color }} />}
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.organization.logo_data ? (
              <img src={data.organization.logo_data} alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-glow" style={data.organization.brand_color ? { background: data.organization.brand_color } : undefined}>
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            )}
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block">
                {data.organization.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Powered by Paivo Secure Pay
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <ShieldCheck className="h-3 w-3" />
              <span>256-Bit Encrypted</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Column: Invoice Details & Vault */}
          <div className="space-y-6">
            {/* Status & Identity Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
                    Official Tax Invoice
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                    {data.invoice_number}
                  </h1>
                </div>

                <div>
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Paid & Settled
                    </span>
                  ) : isPartiallyPaid ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-xs font-bold text-amber-400">
                      Partially Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 px-3.5 py-1 text-xs font-bold text-brand-300">
                      Payment Due
                    </span>
                  )}
                </div>
              </div>

              {/* Bill To & From Grid */}
              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
                    Billed To
                  </span>
                  <p className="font-bold text-white text-sm">{data.customer.name}</p>
                  {data.customer.company_name && (
                    <p className="text-slate-300">{data.customer.company_name}</p>
                  )}
                  {data.customer.email && <p className="text-slate-400">{data.customer.email}</p>}
                </div>
                <div>
                  <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
                    Dates & Terms
                  </span>
                  <p className="text-slate-300">
                    Issued:{" "}
                    <span className="text-white font-medium">
                      {data.issued_at ? new Date(data.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Immediate"}
                    </span>
                  </p>
                  <p className="text-slate-300 mt-1">
                    Due Date:{" "}
                    <span className="text-white font-medium">
                      {data.due_at ? new Date(data.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Upon Receipt"}
                    </span>
                  </p>
                </div>
              </div>

              {data.details && data.details.items.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Description</span><span className="text-right">Qty × Rate</span><span className="w-24 text-right">Amount</span>
                  </div>
                  {data.details.items.map((li, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 border-b border-white/5 px-4 py-2.5 text-xs last:border-0">
                      <span className="font-semibold text-white">{li.description}</span>
                      <span className="text-right font-mono text-slate-400">{li.quantity} × {li.rate.toLocaleString("en-IN")}</span>
                      <span className="w-24 text-right font-mono font-bold text-slate-100">{li.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="space-y-1 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
                    <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{data.details.totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                    {data.details.totals.discount > 0 && <div className="flex justify-between text-emerald-300"><span>Discount</span><span className="font-mono">− {data.details.totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
                    {data.details.tax_mode === "GST_INTRA" && (<><div className="flex justify-between"><span>CGST {data.details.tax_percent / 2}%</span><span className="font-mono">{data.details.totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div><div className="flex justify-between"><span>SGST {data.details.tax_percent / 2}%</span><span className="font-mono">{data.details.totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div></>)}
                    {data.details.tax_mode === "GST_INTER" && <div className="flex justify-between"><span>IGST {data.details.tax_percent}%</span><span className="font-mono">{data.details.totals.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
                  </div>
                  {data.details.notes && <p className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed text-slate-400 whitespace-pre-wrap">{data.details.notes}</p>}
                </div>
              )}

              {/* Balance Summary Box */}
              <div className="mt-6 rounded-xl bg-slate-900/80 border border-white/5 p-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Settlement Progress</span>
                  <span className="font-mono font-semibold text-slate-300">{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-white/5 pt-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                    <p className="font-mono text-sm font-bold text-white mt-0.5">
                      {data.currency} {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Paid</span>
                    <p className="font-mono text-sm font-bold text-emerald-400 mt-0.5">
                      {data.currency} {paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Remaining</span>
                    <p className="font-mono text-base font-extrabold text-brand-300 mt-0.5">
                      {data.currency} {outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FREELANCER PROTECTION: The Deliverables Vault */}
            {data.has_deliverable && (
              <div
                className={`rounded-2xl border p-6 backdrop-blur-md transition-all ${
                  isPaid
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-amber-500/30 bg-amber-950/15"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      isPaid
                        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : "border-amber-500/30 bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {isPaid ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Secure Deliverables Vault</span>
                      {isPaid ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                          Locked Pending Settlement
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {isPaid
                        ? "Your payment is verified. You now have full access to the project deliverables, source assets, and handoff files."
                        : "The creator has attached final deliverables to this invoice. Complete payment or submit your UTR reference to unlock immediate access."}
                    </p>

                    {isPaid && data.deliverable_url && (
                      <div className="mt-4">
                        <a
                          href={data.deliverable_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-glow transition-all"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Final Deliverables</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Payment Panel */}
          <div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-6 backdrop-blur-md shadow-2xl sticky top-24">
              <div className="border-b border-white/10 pb-4 mb-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select Settlement Method
                </span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("upi")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      activeTab === "upi"
                        ? "border-brand-500 bg-brand-500/20 text-white font-bold ring-2 ring-brand-500/30"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <QrCode className="h-4 w-4 mx-auto mb-1 text-brand-400" />
                    <span className="text-xs block">Instant UPI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("bank")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      activeTab === "bank"
                        ? "border-brand-500 bg-brand-500/20 text-white font-bold ring-2 ring-brand-500/30"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Building2 className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
                    <span className="text-xs block">Bank NEFT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("proof")}
                    className={`rounded-xl border p-2.5 text-center transition-all ${
                      activeTab === "proof"
                        ? "border-brand-500 bg-brand-500/20 text-white font-bold ring-2 ring-brand-500/30"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-teal-400" />
                    <span className="text-xs block">Submit UTR</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: UPI SCAN & PAY */}
              {activeTab === "upi" && !data.payment?.upi_id && <NotConfigured what="UPI" />}
              {activeTab === "upi" && data.payment?.upi_id && (
                <div className="space-y-4 text-center">
                  <div className="rounded-2xl bg-white p-4 inline-block mx-auto shadow-glow">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="UPI Payment QR Code"
                        className="h-48 w-48 mx-auto"
                      />
                    ) : (
                      <div className="h-48 w-48 flex items-center justify-center text-slate-400 text-xs">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      Scan with any UPI App (GPay, PhonePe, Paytm, CRED)
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Amount: {data.currency} {outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    {outstanding > 100000 && (
                      <p className="mx-auto mt-3 max-w-xs rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-100">
                        Most UPI apps allow up to about ₹1 lakh per payment. {data.payment?.bank ? "For this amount, bank transfer (NEFT/RTGS) is easier." : "You can pay in parts and submit each UTR."}
                      </p>
                    )}
                  </div>

                  {/* Direct Mobile UPI Intent Button */}
                  <div className="pt-2">
                    <a
                      href={buildUpiUri(data)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-glow hover:opacity-95 transition-all"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Tap to Open UPI App on Mobile</span>
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-400 border-t border-white/5 pt-3">
                    Transferred already?{" "}
                    <button
                      onClick={() => setActiveTab("proof")}
                      className="text-brand-400 font-bold hover:underline"
                    >
                      Submit your 12-digit UTR number here
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: BANK NEFT / RTGS / WIRE */}
              {activeTab === "bank" && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-400 text-[11px] mb-2 leading-relaxed">
                    Transfer funds via NEFT, RTGS, or IMPS using the official billing account details below:
                  </p>

                  {!data.payment?.bank && <NotConfigured what="Bank transfer" />}
                  {(data.payment?.bank
                    ? [
                        { label: "Beneficiary Name", value: data.payment.bank.account_name },
                        { label: "Account Number", value: data.payment.bank.account_number },
                        { label: "IFSC Code", value: data.payment.bank.ifsc },
                        ...(data.payment.bank.bank_name ? [{ label: "Bank", value: data.payment.bank.bank_name }] : []),
                      ]
                    : []
                  ).map((field) => (
                    <div
                      key={field.label}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3"
                    >
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {field.label}
                        </span>
                        <span className="font-mono font-bold text-white text-xs">{field.value}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(field.value, field.label)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedField === field.label ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab("proof")}
                      className="btn-primary w-full h-10 text-xs font-bold"
                    >
                      I have made the transfer → Submit UTR Reference
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: SUBMIT UTR & PROOF */}
              {activeTab === "proof" && (
                <form onSubmit={handleProofSubmit} className="space-y-4 text-xs">
                  {proofSuccess && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 font-semibold flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                      <span>{proofSuccess}</span>
                    </div>
                  )}

                  {proofError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 font-semibold flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <span>{proofError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      UTR / Bank Reference ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 332410982734 or CMS-WIRE-889"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                      className="input w-full bg-slate-950 border-white/10 text-white font-mono text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Found in your bank receipt or UPI transaction details.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Amount Paid ({data.currency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={proofAmount}
                      onChange={(e) => setProofAmount(e.target.value)}
                      className="input w-full bg-slate-950 border-white/10 text-white font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Deducted 10% TDS (challan attached), or paid from personal account."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="input w-full bg-slate-950 border-white/10 text-white text-xs resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Payment screenshot (optional, helps get confirmed faster)
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) { setScreenshot(null); return; }
                        try {
                          setScreenshot(await compressImage(file));
                          setProofError(null);
                        } catch (err: any) {
                          setScreenshot(null);
                          e.target.value = "";
                          setProofError(err?.message || "Could not read that image.");
                        }
                      }}
                      className="block w-full text-[11px] text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-white/20"
                    />
                    {screenshot && <img src={screenshot} alt="Screenshot preview" className="mt-2 max-h-32 rounded-lg border border-white/10" />}
                  </div>

                  <TurnstileWidget onToken={setHumanToken} resetKey={humanReset} />

                  <button
                    type="submit"
                    disabled={submittingProof}
                    className="btn-primary w-full h-10 text-xs font-bold"
                  >
                    {submittingProof ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Verifying Reference...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm Payment Submission</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Compliance & Escrow Footer */}
      <footer className="mt-16 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
          <span className="text-slate-700">•</span>
          <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          <span className="text-slate-700">•</span>
          <span>Peer-to-Peer Direct Bank Settlement</span>
          <span className="text-slate-700">•</span>
          <span>Tenant-isolated records</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-600">
          Invoice AI facilitates peer-to-peer settlement verification and deliverable vault protection. We do not store banking credentials or hold customer funds.
        </p>
      </footer>
    </div>
  );
}
