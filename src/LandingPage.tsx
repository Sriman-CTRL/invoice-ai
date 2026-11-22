import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight, Bot, Check, ChevronDown, FileText, Lock, QrCode, ShieldCheck, Sparkles, Unlock, Zap,
} from "lucide-react";
import { useAuth } from "./auth";
import { PLANS, inrPlain } from "./plans";

const FEATURES = [
  {
    icon: Lock, tone: "from-indigo-500 to-violet-600", title: "Deliverable Escrow Vault",
    body: "Attach the final Figma, GitHub or Drive link to the invoice. It stays locked on the client's pay page and unlocks the second payment is verified. No escrow fees, no middleman.",
  },
  {
    icon: QrCode, tone: "from-emerald-500 to-teal-600", title: "Zero-fee UPI + 1-click settle",
    body: "Every invoice gets a dynamic UPI QR that pays straight into your account. Clients submit their UTR; you tap once to settle the ledger and unlock the deliverable.",
  },
  {
    icon: Bot, tone: "from-sky-500 to-blue-600", title: "AI collections that read replies",
    body: "Gemini classifies \"will pay Friday\" and \"we dispute this\" in client emails, schedules follow-ups, and feeds promised dates into your cash-flow forecast.",
  },
];

const STEPS = [
  { n: "1", title: "Add your UPI ID", body: "Two minutes. Your money always goes directly to you." },
  { n: "2", title: "Send an invoice", body: "Share the pay link on WhatsApp or attach the branded PDF." },
  { n: "3", title: "Get paid, deliver instantly", body: "Client pays, you settle in one click, the vault unlocks." },
];

const FAQ = [
  { q: "Do you hold my money?", a: "No. Clients pay directly to your UPI ID or bank account. Ledgerlane only tracks the payment and controls access to your deliverable link." },
  { q: "What does the escrow vault actually protect?", a: "The final files. The link is hidden on the public pay page until you confirm the payment, so a client can't take the work and walk away." },
  { q: "Does it handle TDS?", a: "Yes. When you record a payment you can pick Section 194C or 194J and Ledgerlane splits the net bank deposit from the tax withheld." },
  { q: "Is my customers' data safe?", a: "Each business's data is isolated with Postgres row-level security, and we provide DPDP / GDPR export and erasure tools. See the Privacy Policy." },
  { q: "Can I cancel any time?", a: "Plans are month-to-month, paid by UPI. Nothing auto-renews without you." },
];

export function PricingSection({ id = "pricing" }: { id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Pricing</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Pays for itself with one recovered invoice</h2>
        <p className="mt-3 text-slate-400">Flat monthly pricing. No percentage cut of your payments, ever.</p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`relative flex flex-col rounded-2xl border p-7 ${p.highlight ? "border-indigo-400/60 bg-indigo-500/10 shadow-[0_0_60px_-15px_rgba(99,102,241,0.5)]" : "border-white/10 bg-white/[0.03]"}`}>
            {p.highlight && <span className="absolute -top-3 left-7 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Most popular</span>}
            <h3 className="text-lg font-bold text-white">{p.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{p.tagline}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">{p.price ? `₹${inrPlain(p.price)}` : "₹0"}</span>
              <span className="text-sm text-slate-400">{p.price ? "/ month" : "forever"}</span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className={`mt-8 inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-all ${p.highlight ? "bg-indigo-500 text-white hover:bg-indigo-400" : "border border-white/15 text-white hover:bg-white/10"}`}>
              {p.price ? `Start with ${p.name}` : "Start free"}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.28),transparent_70%)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_25px_-5px_rgba(99,102,241,0.8)]"><Sparkles className="h-4.5 w-4.5 text-white" /></span>
          <span className="text-lg font-extrabold tracking-tight text-white">Ledgerlane</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-400 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-300 hover:text-white">Sign in</Link>
          <Link to="/register" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-200">Start free</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-14 text-center sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-200">
          <Zap className="h-3.5 w-3.5" /> Built for Indian freelancers, studios and micro-SMEs
        </span>
        <h1 className="mt-7 text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl">
          Stop chasing invoices.<br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">Get paid before you hand over the work.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          Ledgerlane locks your deliverables behind the payment, collects through zero-fee UPI straight into your account, and lets AI do the awkward follow-ups.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-500 px-7 text-sm font-bold text-white shadow-[0_10px_40px_-10px_rgba(99,102,241,0.9)] transition hover:bg-indigo-400">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/pay/INV-1042" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 px-7 text-sm font-bold text-white transition hover:bg-white/10">
            See a live client pay page
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">Free plan, no card. Your money never passes through us.</p>

        {/* Product mock */}
        <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Invoice INV-1042</p>
              <p className="mt-1 text-2xl font-black text-white">₹45,000</p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">Payment due</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
              <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
              <div><p className="text-sm font-bold text-white">Deliverables locked</p><p className="mt-0.5 text-xs text-slate-400">Unlocks the moment you verify payment.</p></div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <Unlock className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div><p className="text-sm font-bold text-white">1-Click Settle</p><p className="mt-0.5 text-xs text-slate-400">UTR submitted by client, confirmed by you.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Why Ledgerlane</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">The two things that cost freelancers the most</h2>
          <p className="mt-3 text-slate-400">Clients who vanish after the work is delivered, and weeks lost chasing payments.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
              <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${f.tone} shadow-lg`}><f.icon className="h-5 w-5 text-white" /></span>
              <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
            <p className="text-sm text-slate-400"><b className="text-white">Branded PDF invoices</b> with GSTIN, TDS summary and a scannable UPI QR, generated in your browser.</p>
          </div>
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <p className="text-sm text-slate-400"><b className="text-white">DPDP &amp; GDPR ready</b> with tenant isolation, data export and right-to-erasure built in.</p>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="relative z-10 mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">Live in ten minutes</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-500/20 text-sm font-black text-indigo-200">{s.n}</span>
              <h3 className="mt-4 font-bold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative z-10"><PricingSection /></div>

      {/* FAQ */}
      <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-center text-3xl font-black tracking-tight text-white">Questions, answered</h2>
        <div className="mt-10 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
          {FAQ.map((f, i) => (
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

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-24 pt-8">
        <div className="rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent p-10 text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Your next invoice should pay itself.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Set up in minutes. Free for your first five invoices every month.</p>
          <Link to="/register" className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-sm font-bold text-slate-900 transition hover:bg-slate-200">
            Create your free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-slate-300">Terms &amp; Escrow Charter</Link>
          <Link to="/login" className="hover:text-slate-300">Sign in</Link>
        </div>
        <p className="mt-3">Ledgerlane facilitates peer-to-peer payment verification and deliverable access control. We do not hold customer funds.</p>
      </footer>
    </div>
  );
}
