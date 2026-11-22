import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Rocket, X } from "lucide-react";
import { settingsApi } from "../api";
import { useResource } from "./shared";

const KEY = "ledgerlane_onboarding_dismissed";

export function OnboardingChecklist({ customers, invoices }: { customers: number; invoices: number }) {
  const settings = useResource(() => settingsApi.get().catch(() => null), []);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  if (dismissed || settings.loading || !settings.data) return null;

  const steps = [
    { done: Boolean(settings.data.upi_id), title: "Add your UPI ID", detail: "So client payments land in your account, not ours.", to: "/settings", cta: "Add payment details" },
    { done: customers > 0, title: "Add your first customer", detail: "Name, email and phone for WhatsApp reminders.", to: "/customers", cta: "Add customer" },
    { done: invoices > 0, title: "Create an invoice with a vault link", detail: "Attach the Figma / Drive link; it unlocks on payment.", to: "/invoices", cta: "Create invoice" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done)!;

  return (
    <section className="panel relative mb-7 overflow-hidden border-brand-200/70 bg-gradient-to-br from-brand-50/70 via-white to-white p-6">
      <button
        aria-label="Dismiss setup guide"
        className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
        onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setDismissed(true); }}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-glow"><Rocket className="h-5 w-5" /></span>
        <div>
          <h2 className="text-base font-bold text-slate-900">Get paid in 3 steps</h2>
          <p className="text-xs text-slate-500">{doneCount} of {steps.length} done</p>
        </div>
        <div className="ml-auto mr-8 hidden h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 sm:block">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`rounded-xl border p-4 ${s.done ? "border-emerald-200 bg-emerald-50/50" : s === next ? "border-brand-300 bg-white shadow-soft" : "border-slate-200 bg-white/60"}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <p className={`text-sm font-bold ${s.done ? "text-slate-500 line-through" : "text-slate-900"}`}>{s.title}</p>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{s.detail}</p>
            {!s.done && s === next && (
              <Link to={s.to} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800">
                {s.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
