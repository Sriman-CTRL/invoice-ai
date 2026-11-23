import { useState } from "react";
import { Plus, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { invoicesApi } from "../api";
import { money } from "../lib";
import { useToast } from "../toast";
import { GST_RATES, emptyItem, lineAmount, totalsFor, type DraftItem, type TaxMode } from "../invoiceMath";

export interface ItemsValue {
  items: DraftItem[];
  discount: string;
  taxMode: TaxMode;
  taxPercent: number;
  notes: string;
}

export const initialItems = (): ItemsValue => ({ items: [emptyItem()], discount: "", taxMode: "NONE", taxPercent: 18, notes: "" });

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10";

export function InvoiceItemsEditor({
  value,
  onChange,
  currency,
  onCurrency,
}: {
  value: ItemsValue;
  onChange: (v: ItemsValue) => void;
  currency: string;
  onCurrency: (c: string) => void;
}) {
  const toast = useToast();
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const t = totalsFor(value.items, value.discount, value.taxPercent, value.taxMode);
  const set = (patch: Partial<ItemsValue>) => onChange({ ...value, ...patch });
  const setItem = (idx: number, patch: Partial<DraftItem>) => set({ items: value.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  const generate = async () => {
    setAiBusy(true);
    try {
      const r = await invoicesApi.aiItems(aiText, currency);
      const drafted = r.items.map((i) => ({ description: i.description, quantity: String(i.quantity), rate: i.rate ? String(i.rate) : "" }));
      const keep = value.items.filter((i) => i.description.trim() || i.rate);
      set({ items: [...keep, ...drafted] });
      setAiText("");
      toast.success("Line items drafted", "Check the prices before you create the invoice.");
    } catch (e: any) {
      toast.error("Couldn't draft items", e?.message);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700">What are you billing for?</label>
        <select value={currency} onChange={(e) => onCurrency(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold">
          <option value="INR">₹ INR</option>
          <option value="USD">$ USD</option>
          <option value="EUR">€ EUR</option>
          <option value="GBP">£ GBP</option>
        </select>
      </div>

      {/* AI helper */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-300/70 bg-brand-50/40 p-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
        <input
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (aiText.trim().length >= 5 && !aiBusy) generate(); } }}
          placeholder="Describe the work, e.g. 3 days of UI design for a SaaS dashboard at ₹6,000 a day"
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
          maxLength={600}
        />
        <button type="button" onClick={generate} disabled={aiBusy || aiText.trim().length < 5} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand-700 disabled:opacity-40">
          {aiBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Draft
        </button>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[1fr_64px_96px_92px_28px] gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
          <span>Description</span><span>Qty</span><span>Rate</span><span className="text-right">Amount</span><span />
        </div>
        <div className="divide-y divide-slate-100">
          {value.items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_64px_96px] items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_64px_96px_92px_28px]">
              <input className={input + " col-span-3 sm:col-span-1"} value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="e.g. Brand identity design" maxLength={300} />
              <input className={input + " font-mono"} inputMode="decimal" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} aria-label="Quantity" />
              <input className={input + " font-mono"} inputMode="decimal" value={it.rate} onChange={(e) => setItem(idx, { rate: e.target.value })} placeholder="0" aria-label="Rate" />
              <span className="hidden text-right font-mono text-xs font-bold text-slate-800 sm:block">{money(lineAmount(it), currency)}</span>
              <button type="button" onClick={() => set({ items: value.items.length > 1 ? value.items.filter((_, i) => i !== idx) : [emptyItem()] })} className="hidden rounded-md p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 sm:block" aria-label="Remove line">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set({ items: [...value.items, emptyItem()] })} className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-xs font-semibold text-brand-600 transition hover:bg-brand-50/50">
          <Plus className="h-3.5 w-3.5" /> Add line
        </button>
      </div>

      {/* Discount + GST */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold text-slate-700">Discount ({currency})</label>
          <input className={input + " mt-1 font-mono"} inputMode="decimal" value={value.discount} onChange={(e) => set({ discount: e.target.value })} placeholder="0" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700">GST</label>
          <div className="mt-1 flex gap-1.5">
            <select className={input} value={value.taxMode} onChange={(e) => set({ taxMode: e.target.value as TaxMode })}>
              <option value="NONE">No GST</option>
              <option value="GST_INTRA">Same state (CGST + SGST)</option>
              <option value="GST_INTER">Other state (IGST)</option>
            </select>
            {value.taxMode !== "NONE" && (
              <select className={input + " w-24"} value={value.taxPercent} onChange={(e) => set({ taxPercent: Number(e.target.value) })} aria-label="GST rate">
                {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl bg-slate-50 p-3.5 text-xs">
        <Row label="Subtotal" value={money(t.subtotal, currency)} />
        {t.discount > 0 && <Row label="Discount" value={`− ${money(t.discount, currency)}`} />}
        {value.taxMode === "GST_INTRA" && (<><Row label={`CGST ${value.taxPercent / 2}%`} value={money(t.cgst, currency)} /><Row label={`SGST ${value.taxPercent / 2}%`} value={money(t.sgst, currency)} /></>)}
        {value.taxMode === "GST_INTER" && <Row label={`IGST ${value.taxPercent}%`} value={money(t.igst, currency)} />}
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2.5">
          <span className="text-sm font-bold text-slate-900">Total due</span>
          <span className="font-mono text-lg font-black text-slate-900">{money(t.total, currency)}</span>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700">Note to client <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea className={input + " mt-1 resize-none"} rows={2} value={value.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Thank you for the project. Payment terms, bank details, anything they should know." maxLength={2000} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-0.5 text-slate-600"><span>{label}</span><span className="font-mono font-semibold text-slate-800">{value}</span></div>;
}
