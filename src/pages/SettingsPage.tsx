import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Banknote, Check, CreditCard, Crown, Landmark, ShieldCheck } from "lucide-react";
import { settingsApi } from "../api";
import { PageHeader, TableSkeleton, ErrorState } from "../components";
import { PLANS, PLATFORM_UPI_ID, SUPPORT_EMAIL, inrPlain, type Plan } from "../plans";
import { useToast } from "../toast";
import type { OrgSettings } from "../types";
import { useResource } from "./shared";

type Form = Record<"upi_id" | "payee_name" | "bank_account_name" | "bank_account_number" | "bank_ifsc" | "bank_name" | "gstin", string>;
const EMPTY: Form = { upi_id: "", payee_name: "", bank_account_name: "", bank_account_number: "", bank_ifsc: "", bank_name: "", gstin: "" };

const toForm = (s: OrgSettings): Form => ({
  upi_id: s.upi_id ?? "", payee_name: s.payee_name ?? "", bank_account_name: s.bank_account_name ?? "",
  bank_account_number: s.bank_account_number ?? "", bank_ifsc: s.bank_ifsc ?? "", bank_name: s.bank_name ?? "", gstin: s.gstin ?? "",
});

function Field({ label, hint, value, onChange, placeholder, mono }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className={`input ${mono ? "font-mono" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function UpgradePanel({ plan, onClose, current }: { plan: Plan; onClose: () => void; current: OrgSettings["plan"] }) {
  const toast = useToast();
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const enabled = Boolean(PLATFORM_UPI_ID);

  useEffect(() => {
    if (!enabled) return;
    const uri = `upi://pay?pa=${encodeURIComponent(PLATFORM_UPI_ID)}&pn=Ledgerlane&am=${plan.price}.00&cu=INR&tn=${encodeURIComponent(`Ledgerlane ${plan.name} plan`)}`;
    QRCode.toDataURL(uri, { width: 240, margin: 1 }).then(setQr).catch(() => {});
  }, [enabled, plan]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await settingsApi.upgrade({ plan: plan.id as "PRO" | "AGENCY", utr: utr.trim() });
      toast.success("Payment proof received", r.message);
      onClose();
    } catch (err: any) {
      toast.error("Could not submit", err?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-slate-900">Upgrade to {plan.name}</h3>
        <p className="mt-1 text-sm text-slate-500">₹{inrPlain(plan.price)} / month, paid by UPI with zero gateway fees.{current !== "FREE" && " This replaces your current plan."}</p>
        {enabled ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {qr && <img src={qr} alt="UPI QR" className="h-40 w-40" />}
              <p className="text-xs text-slate-500">Scan with any UPI app or pay to <b className="font-mono">{PLATFORM_UPI_ID}</b></p>
            </div>
            <Field label="UTR / transaction reference" value={utr} onChange={setUtr} placeholder="12-digit UTR from your receipt" mono />
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex-1" disabled={busy || utr.trim().length < 12}>{busy ? "Submitting…" : "Submit payment proof"}</button>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Plan payments are being switched on. {SUPPORT_EMAIL ? <>Email <b>{SUPPORT_EMAIL}</b> and we'll activate {plan.name} for you.</> : "Please check back shortly."}
            <button className="btn-secondary mt-4 w-full" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const r = useResource(() => settingsApi.get(), []);
  const toast = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [upgrade, setUpgrade] = useState<Plan | null>(null);

  useEffect(() => { if (r.data) setForm(toForm(r.data)); }, [r.data]);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (r.loading) return <><PageHeader title="Settings" /><TableSkeleton rows={4} /></>;
  if (r.error || !r.data) return <><PageHeader title="Settings" /><ErrorState message={r.error || "Could not load settings."} retry={r.reload} /></>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.save(form);
      toast.success("Payment details saved", "Your pay pages and PDFs now use these details.");
      r.reload();
    } catch (err: any) {
      toast.error("Could not save", err?.message);
    } finally {
      setSaving(false);
    }
  };

  const plan = r.data.plan;
  const upiOk = Boolean(r.data.upi_id);

  return (
    <>
      <PageHeader title="Settings" detail="Where your clients send money, and your plan." />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={save} className="panel space-y-8 p-6">
          <section>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Banknote className="h-4.5 w-4.5" /></span>
              <div>
                <h2 className="text-base font-bold text-slate-900">UPI collection</h2>
                <p className="text-xs text-slate-500">The QR and "Open UPI app" button on every pay page and PDF.</p>
              </div>
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${upiOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{upiOk ? "Active" : "Required"}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your UPI ID" value={form.upi_id} onChange={set("upi_id")} placeholder="yourname@okhdfcbank" mono />
              <Field label="Payee name shown to client" value={form.payee_name} onChange={set("payee_name")} placeholder="Your business name" />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Landmark className="h-4.5 w-4.5" /></span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Bank transfer (NEFT / RTGS)</h2>
                <p className="text-xs text-slate-500">Optional. For larger invoices and corporate finance teams.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account holder" value={form.bank_account_name} onChange={set("bank_account_name")} placeholder="As per bank records" />
              <Field label="Account number" value={form.bank_account_number} onChange={set("bank_account_number")} mono />
              <Field label="IFSC" value={form.bank_ifsc} onChange={set("bank_ifsc")} placeholder="HDFC0001234" mono />
              <Field label="Bank name" value={form.bank_name} onChange={set("bank_name")} placeholder="HDFC Bank" />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-base font-bold text-slate-900">Tax details</h2>
            <div className="max-w-sm">
              <Field label="Your GSTIN" value={form.gstin} onChange={set("gstin")} placeholder="29ABCDE1234F1Z5" hint="Printed on your PDF invoices." mono />
            </div>
          </section>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Money goes straight to your account. We never hold funds.</p>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save payment details"}</button>
          </div>
        </form>

        <aside className="panel h-fit p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Crown className="h-4.5 w-4.5" /></span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Your plan</h2>
              <p className="text-xs text-slate-500">Currently <b className="text-slate-800">{PLANS.find((p) => p.id === plan)?.name}</b></p>
            </div>
          </div>
          <ul className="space-y-3">
            {PLANS.map((p) => {
              const current = p.id === plan;
              return (
                <li key={p.id} className={`rounded-xl border p-4 ${current ? "border-brand-300 bg-brand-50/60" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-sm font-extrabold text-slate-900">{p.price ? `₹${inrPlain(p.price)}/mo` : "Free"}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.features.slice(0, 3).join(" · ")}</p>
                  {current ? (
                    <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700"><Check className="h-3.5 w-3.5" /> Current plan</p>
                  ) : p.price > 0 && plan === "FREE" ? (
                    <button className="btn-primary mt-3 h-9 w-full text-xs" onClick={() => setUpgrade(p)}><CreditCard className="h-3.5 w-3.5" /> Upgrade to {p.name}</button>
                  ) : p.id === "AGENCY" && plan === "PRO" ? (
                    <button className="btn-secondary mt-3 h-9 w-full text-xs" onClick={() => setUpgrade(p)}>Upgrade to {p.name}</button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      {upgrade && <UpgradePanel plan={upgrade} current={plan} onClose={() => setUpgrade(null)} />}
    </>
  );
}
