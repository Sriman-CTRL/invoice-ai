import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MarketingShell } from "./marketing";
import { emptyItem, totalsFor, type DraftItem, type TaxMode } from "./invoiceMath";
import { GST_SLABS, GST_SLABS_CHECKED, GST_SLABS_SOURCE_URL } from "./gstSlabs";
import { computeTds } from "./tdsMath";
import { buildReminderText, whatsappShareUrl, type Tone } from "./reminderText";

/** Sets the tab title and meta description while a tool page is open, and puts the originals back afterwards. */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? null;
    document.title = title;
    meta?.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const field = "mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-slate-400";

function ToolLayout({ title, intro, children, cta }: { title: string; intro: string; children: React.ReactNode; cta: string }) {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:pt-16">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Free tool, no sign-up</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 text-slate-400">{intro}</p>
        <p className="mt-2 text-xs text-slate-500">Everything runs in your browser. Nothing you type is sent to us or saved.</p>
        <div className="mt-8">{children}</div>
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-white">Want this done for you on every invoice?</h2>
          <p className="mt-2 text-sm text-slate-300">{cta}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200">Try Paivo free</Link>
            <Link to="/pricing" className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5">See pricing</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

// ---------------------------------------------------------------------------------------------------------------
// GST invoice calculator
// ---------------------------------------------------------------------------------------------------------------

export function GstCalculatorPage() {
  usePageMeta("Free GST invoice calculator for India (CGST, SGST, IGST) | Paivo", "Add line items, a discount and a GST rate, and see the taxable value, CGST + SGST or IGST, and the invoice total. Free, runs in your browser.");
  const [items, setItems] = useState<DraftItem[]>([{ description: "", quantity: "1", rate: "" }]);
  const [discount, setDiscount] = useState("");
  const [mode, setMode] = useState<TaxMode>("GST_INTRA");
  const [slab, setSlab] = useState<string>("18");
  const [custom, setCustom] = useState("");
  const rate = slab === "custom" ? Math.min(100, Math.max(0, num(custom))) : Number(slab);
  const t = useMemo(() => totalsFor(items, discount, rate, mode), [items, discount, rate, mode]);
  const setItem = (i: number, patch: Partial<DraftItem>) => setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <ToolLayout
      title="GST invoice calculator"
      intro="Work out the GST on an invoice: taxable value, CGST + SGST (same state) or IGST (different state), and the total."
      cta="Paivo does this sum for you on every invoice, adds your GSTIN and a UPI QR, and unlocks your final files only after the client pays."
    >
      <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_7rem_auto] items-end gap-2 sm:gap-3">
              <div>
                <label htmlFor={`gst-desc-${i}`} className={labelCls}>Item {i + 1}</label>
                <input id={`gst-desc-${i}`} className={field} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Logo design" />
              </div>
              <div>
                <label htmlFor={`gst-qty-${i}`} className={labelCls}>Qty</label>
                <input id={`gst-qty-${i}`} className={field} inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`gst-rate-${i}`} className={labelCls}>Rate (₹)</label>
                <input id={`gst-rate-${i}`} className={field} inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} placeholder="10000" />
              </div>
              <button type="button" aria-label={`Remove item ${i + 1}`} disabled={items.length === 1} onClick={() => setItems((cur) => cur.filter((_, idx) => idx !== i))} className="mb-0.5 h-11 rounded-lg border border-white/10 px-3 text-slate-300 hover:bg-white/5 disabled:opacity-30">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setItems((cur) => [...cur, emptyItem()])} className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">+ Add another item</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="gst-discount" className={labelCls}>Discount (₹)</label>
            <input id="gst-discount" className={field} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label htmlFor="gst-slab" className={labelCls}>GST rate</label>
            <select id="gst-slab" className={field} value={slab} onChange={(e) => setSlab(e.target.value)}>
              {GST_SLABS.map((s) => <option key={s} value={String(s)} className="text-slate-900">{s}%</option>)}
              <option value="custom" className="text-slate-900">Other rate…</option>
            </select>
          </div>
          {slab === "custom" && (
            <div>
              <label htmlFor="gst-custom" className={labelCls}>Rate (%)</label>
              <input id="gst-custom" className={field} inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="12" />
            </div>
          )}
        </div>

        <fieldset>
          <legend className={labelCls}>Where is your client?</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-200">
            <label className="flex items-center gap-2"><input type="radio" name="gst-mode" checked={mode === "GST_INTRA"} onChange={() => setMode("GST_INTRA")} /> Same state (CGST + SGST)</label>
            <label className="flex items-center gap-2"><input type="radio" name="gst-mode" checked={mode === "GST_INTER"} onChange={() => setMode("GST_INTER")} /> Different state (IGST)</label>
            <label className="flex items-center gap-2"><input type="radio" name="gst-mode" checked={mode === "NONE"} onChange={() => setMode("NONE")} /> No GST charged</label>
          </div>
        </fieldset>

        <dl className="divide-y divide-white/10 rounded-xl border border-white/10 text-sm" aria-live="polite">
          <Row k="Subtotal" v={inr(t.subtotal)} />
          {t.discount > 0 && <Row k="Discount" v={`- ${inr(t.discount)}`} />}
          <Row k="Taxable value" v={inr(t.taxable)} />
          {mode === "GST_INTRA" && <><Row k={`CGST ${rate / 2}%`} v={inr(t.cgst)} /><Row k={`SGST ${rate / 2}%`} v={inr(t.sgst)} /></>}
          {mode === "GST_INTER" && <Row k={`IGST ${rate}%`} v={inr(t.igst)} />}
          <Row k="Invoice total" v={inr(t.total)} strong />
        </dl>
      </div>

      <div className="mt-6 space-y-2 text-xs leading-relaxed text-slate-500">
        <p>
          Slabs: the GST Council's decisions of its 56th meeting (effective 22 Sep 2025) set a standard rate of 18%, a merit rate of 5% and a special rate of 40% for a few goods and services; 0% is for nil-rated or exempt supplies.
          Source: <a className="text-indigo-300 underline" href={GST_SLABS_SOURCE_URL} rel="noreferrer noopener" target="_blank">gstcouncil.gov.in press release</a>, checked {GST_SLABS_CHECKED}. Which rate applies to <em>your</em> service depends on its classification: we do not guess it here.
        </p>
        <p>Use "Other rate…" if your invoice needs a rate that is not listed. Whether you must register for GST depends on your turnover and the state you work from; we have not confirmed the current limits from an official page, so we show none. This is general information, not tax advice. Check with a CA.</p>
      </div>
    </ToolLayout>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${strong ? "bg-white/[0.04] text-base font-bold text-white" : "text-slate-300"}`}>
      <dt>{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// TDS calculator
// ---------------------------------------------------------------------------------------------------------------

export function TdsCalculatorPage() {
  usePageMeta("Free TDS calculator for freelancers in India | Paivo", "Type in your invoice amount, GST and the TDS rate to see how much will be deducted and what reaches your bank. Free, runs in your browser.");
  const [amount, setAmount] = useState("");
  const [gst, setGst] = useState("");
  const [ratePct, setRatePct] = useState("");
  const [excludeGst, setExcludeGst] = useState(true);
  const r = useMemo(() => computeTds({ amount: num(amount), gst: num(gst), ratePercent: num(ratePct), excludeGst }), [amount, gst, ratePct, excludeGst]);

  return (
    <ToolLayout
      title="TDS calculator for freelancers"
      intro="See how much TDS a client will deduct from an invoice and how much will actually reach your bank account."
      cta="Paivo's invoices include a TDS helper, so you can see what to expect before the client pays, and the pay page records what the client actually sent."
    >
      <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">
        <strong>You enter the rate.</strong> TDS rates and limits (for example for contractors and professionals) can change from year to year.
        On {GST_SLABS_CHECKED} we could not open the Income Tax Department's rate pages from our tools, so we could not confirm any current rate or threshold, and this page does not suggest one.
        Take the rate from your client's deduction or from the official TDS chart at <a className="underline" href="https://www.incometax.gov.in" target="_blank" rel="noreferrer noopener">incometax.gov.in</a>.
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tds-amount" className={labelCls}>Invoice amount before GST (₹)</label>
            <input id="tds-amount" className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
          </div>
          <div>
            <label htmlFor="tds-gst" className={labelCls}>GST on the invoice (₹)</label>
            <input id="tds-gst" className={field} inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label htmlFor="tds-rate" className={labelCls}>TDS rate (%)</label>
            <input id="tds-rate" className={field} inputMode="decimal" value={ratePct} onChange={(e) => setRatePct(e.target.value)} placeholder="from your client or the official chart" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" className="mt-1" checked={excludeGst} onChange={(e) => setExcludeGst(e.target.checked)} />
          <span>Calculate TDS on the amount before GST. Untick to calculate it on amount + GST. Which one applies to you is a question for your CA or your client's accountant.</span>
        </label>
        <dl className="divide-y divide-white/10 rounded-xl border border-white/10 text-sm" aria-live="polite">
          <Row k="Invoice total (amount + GST)" v={inr(r.invoiceTotal)} />
          <Row k="TDS is calculated on" v={inr(r.tdsBase)} />
          <Row k={`TDS deducted${ratePct ? ` at ${ratePct}%` : ""}`} v={`- ${inr(r.tds)}`} />
          <Row k="Reaches your bank" v={inr(r.netReceived)} strong />
        </dl>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        The deducted TDS is credited against your income tax: it should appear in your Form 26AS / AIS (check with your CA). Ask your client for the TDS certificate. This is general information, not tax advice. Check with a CA.
      </p>
    </ToolLayout>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Payment reminder writer
// ---------------------------------------------------------------------------------------------------------------

export function ReminderWriterPage() {
  usePageMeta("Free payment reminder writer for late invoices | Paivo", "Pick a tone, add the invoice details and get a polite payment reminder you can edit, copy or send on WhatsApp. Free, runs in your browser.");
  const [tone, setTone] = useState<Tone>("friendly");
  const [clientName, setClientName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("3");
  const [yourName, setYourName] = useState("");
  const [payLink, setPayLink] = useState("");
  const generated = useMemo(
    () => buildReminderText({ tone, clientName, invoiceNumber, amount: num(amount), daysOverdue: num(days), yourName, payLink }),
    [tone, clientName, invoiceNumber, amount, days, yourName, payLink],
  );
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? generated;
  const [copied, setCopied] = useState(false);
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setEdited(null); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ToolLayout
      title="Payment reminder writer"
      intro="A polite, plain message to nudge a client about an unpaid invoice. Edit it, copy it, or open it in WhatsApp."
      cta="Paivo keeps the invoice, the pay link and your reminders in one place, so you are not hunting through chats. Automatic reminders are coming soon."
    >
      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rem-tone" className={labelCls}>Tone</label>
            <select id="rem-tone" className={field} value={tone} onChange={(e) => change(setTone)(e.target.value as Tone)}>
              <option value="friendly" className="text-slate-900">Friendly</option>
              <option value="firm" className="text-slate-900">Firm</option>
              <option value="final" className="text-slate-900">Last reminder (still polite)</option>
            </select>
          </div>
          <div>
            <label htmlFor="rem-days" className={labelCls}>Days overdue</label>
            <input id="rem-days" className={field} inputMode="numeric" value={days} onChange={(e) => change(setDays)(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rem-client" className={labelCls}>Client name</label>
            <input id="rem-client" className={field} value={clientName} onChange={(e) => change(setClientName)(e.target.value)} placeholder="Asha" />
          </div>
          <div>
            <label htmlFor="rem-inv" className={labelCls}>Invoice number</label>
            <input id="rem-inv" className={field} value={invoiceNumber} onChange={(e) => change(setInvoiceNumber)(e.target.value)} placeholder="INV-1042" />
          </div>
          <div>
            <label htmlFor="rem-amount" className={labelCls}>Amount due (₹)</label>
            <input id="rem-amount" className={field} inputMode="decimal" value={amount} onChange={(e) => change(setAmount)(e.target.value)} placeholder="25000" />
          </div>
          <div>
            <label htmlFor="rem-you" className={labelCls}>Your name</label>
            <input id="rem-you" className={field} value={yourName} onChange={(e) => change(setYourName)(e.target.value)} placeholder="Ravi" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rem-link" className={labelCls}>Payment link or UPI ID (optional)</label>
            <input id="rem-link" className={field} value={payLink} onChange={(e) => change(setPayLink)(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div>
          <label htmlFor="rem-text" className={labelCls}>Your message (you can edit it)</label>
          <textarea id="rem-text" className={`${field} min-h-[14rem] font-sans leading-relaxed`} value={text} onChange={(e) => setEdited(e.target.value)} />
          {edited !== null && <button type="button" onClick={() => setEdited(null)} className="mt-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Reset to the template</button>}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={copy} className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200">{copied ? "Copied" : "Copy message"}</button>
          <a href={whatsappShareUrl(text)} target="_blank" rel="noreferrer noopener" className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5">Open in WhatsApp</a>
        </div>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        These messages ask for payment or an update and never threaten. Keep it that way when you edit: threats or legal warnings can backfire. Send reminders to people who actually owe you, once a week at most.
      </p>
    </ToolLayout>
  );
}
