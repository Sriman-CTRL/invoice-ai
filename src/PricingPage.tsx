import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Minus } from "lucide-react";
import { MarketingShell } from "./marketing";
import { COMPARISON, PLANS, PAYMENTS_OPEN, featureLabel, inrPlain, isSoon } from "./plans";
import { LeadForm } from "./LeadForms";

const BILLING_FAQ = [
  { q: "Is there a fee on the payments I receive?", a: "No. Clients pay you directly by UPI or bank transfer, so there's no percentage taken. Payment gateways typically charge around 2% per payment; with Paivo you only pay the flat monthly price." },
  { q: "When can I buy Pro or Agency?", a: "Not yet, on purpose. Join the waitlist and we'll email you when automatic reminders and reply-reading work. Until then, Starter is free and fully usable." },
  { q: "Will I be charged automatically every month?", a: "No. Nothing is taken from your account automatically. You pay each month yourself, and you can stop whenever you like." },
  { q: "What happens to my data if I go back to Starter?", a: "Nothing is deleted. Your invoices, clients and history stay. Starter just limits you to 5 new invoices a month." },
  { q: "What counts as an invoice?", a: "Each invoice you create or import counts once, in the month you create it. Sending reminders or recording payments doesn't count." },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-slate-600" aria-label="Not included" />;
  if (v === "Soon") return <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">Coming soon</span>;
  return <span className="text-sm font-semibold text-slate-200">{v}</span>;
}

export function PricingPage() {
  const [open, setOpen] = useState<number | null>(0);
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-12 text-center sm:pt-16">
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Simple, honest pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Start free. No percentage of your payments, ever.
        </p>
        {!PAYMENTS_OPEN && (
          <p className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
            <b>Paid plans open soon.</b> We're finishing automatic reminders and reply-reading first, and we won't charge for things that don't work yet. Join the waitlist and we'll email you the day they're ready.
          </p>
        )}
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.id} className={`relative flex flex-col rounded-2xl border p-7 ${p.highlight ? "border-indigo-400/60 bg-indigo-500/10 shadow-[0_0_60px_-15px_rgba(99,102,241,0.5)]" : "border-white/10 bg-white/[0.03]"}`}>
              {p.highlight && <span className="absolute -top-3 left-7 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Most popular</span>}
              <h2 className="text-lg font-bold text-white">{p.name}</h2>
              <p className="mt-1 min-h-[40px] text-sm text-slate-400">{p.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-black tracking-tight text-white">{p.price ? `₹${inrPlain(p.price)}` : "₹0"}</span>
                <span className="text-sm text-slate-400">{p.price ? "per month" : "forever"}</span>
              </p>
              <p className="mt-1 h-4 text-xs text-slate-500">{p.price ? `About ₹${Math.round(p.price / 30)} a day` : ""}</p>
              {p.price && !PAYMENTS_OPEN ? (
                <>
                  <button onClick={() => setWaitlistFor(waitlistFor === p.id ? null : p.id)} className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${p.highlight ? "bg-indigo-500 text-white hover:bg-indigo-400" : "border border-white/15 text-white hover:bg-white/10"}`}>
                    Join the waitlist
                  </button>
                  {waitlistFor === p.id && <div className="mt-3"><LeadForm kind="waitlist" plan={p.id} variant="dark" /></div>}
                </>
              ) : (
                <Link to="/register" className={`mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${p.highlight ? "bg-indigo-500 text-white hover:bg-indigo-400" : "border border-white/15 text-white hover:bg-white/10"}`}>
                  {p.price ? "Start free, upgrade anytime" : "Start free"} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <ul className="mt-7 flex-1 space-y-3 border-t border-white/10 pt-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{featureLabel(f)}{isSoon(f) && <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Soon</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Prices in Indian Rupees. Every account starts on Starter. Paid plans open when the features marked "Soon" are ready.</p>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Compare plans</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`px-5 py-4 text-center text-sm font-bold ${p.highlight ? "text-indigo-300" : "text-white"}`}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {COMPARISON.map(([label, a, b, c]) => (
                <tr key={label} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 text-sm text-slate-300">{label}</td>
                  <td className="px-5 py-3.5 text-center"><Cell v={a} /></td>
                  <td className="px-5 py-3.5 text-center"><Cell v={b} /></td>
                  <td className="px-5 py-3.5 text-center"><Cell v={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Billing FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Billing questions</h2>
        <div className="mt-8 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
          {BILLING_FAQ.map((f, i) => (
            <div key={f.q}>
              <button className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span className="font-semibold text-white">{f.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="fade-in px-6 pb-5 text-sm leading-relaxed text-slate-400">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24 pt-4 text-center">
        <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-sm font-bold text-slate-900 transition hover:bg-slate-200">
          Create your free account <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </MarketingShell>
  );
}
