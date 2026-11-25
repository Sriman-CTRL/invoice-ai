import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BellRing, Check, ChevronDown, FileText, Lock, QrCode, Unlock, Zap } from "lucide-react";
import { useAuth } from "./auth";
import { DEMO_PAY_PATH, MarketingShell } from "./marketing";
import { PLANS, inrPlain } from "./plans";

const FEATURES = [
  {
    icon: Lock, tone: "from-indigo-500 to-violet-600", title: "Files unlock only after payment",
    body: "Add the link to your final work (Figma, Google Drive, GitHub, anything). Your client sees that it's ready, but can only open it once you confirm their payment.",
  },
  {
    icon: QrCode, tone: "from-emerald-500 to-teal-600", title: "Paid straight to your bank",
    body: "Every invoice gets its own payment page with a UPI QR code for exactly the right amount. Money goes directly to your account. No payment-gateway cut.",
  },
  {
    icon: BellRing, tone: "from-sky-500 to-blue-600", title: "Reminders in one tap",
    body: "See which invoices are overdue and send a polite, ready-written reminder with one tap. Email goes out from Paivo and replies land in your own inbox; WhatsApp opens ready to send. Scheduled automatic reminders are coming next.",
  },
];

const STEPS = [
  { n: "1", title: "Add your UPI ID", body: "Takes two minutes. This is where your clients' money will go." },
  { n: "2", title: "Create an invoice and share the link", body: "Send it on WhatsApp or email, or download a PDF. Attach your final files if you like." },
  { n: "3", title: "Client pays, you confirm, files unlock", body: "Your client pays by UPI and tells you the transaction number. You check your bank and click Confirm." },
];

const FAQ = [
  { q: "Do you hold my money?", a: "No. Your clients pay directly into your own UPI ID or bank account. Paivo only keeps track of who has paid and decides when your files are shown." },
  { q: "How does the \"files unlock after payment\" part work?", a: "When you create an invoice you can paste a link to your finished work. On the client's payment page that link stays hidden. The moment you confirm the full payment, it appears for them. We don't store your files; we just control when the link is shown." },
  { q: "What is a UTR number?", a: "It's the transaction reference your client's UPI or banking app shows after paying (usually 12 digits). They type it in, and you match it against your bank statement before confirming." },
  { q: "Is there a limit on UPI payments?", a: "UPI apps and banks set a limit on each payment, and the limits differ by bank and by the kind of account, so a large payment can fail. For bigger invoices, add your bank details so clients can pay by NEFT/RTGS, or ask them to pay in parts." },
  { q: "Does it handle TDS and GST?", a: "Yes. You can record TDS deducted under Section 194C or 194J, and your GSTIN is printed on PDF invoices." },
  { q: "Why not just use a payment link from a payment gateway?", a: "Gateways are a good choice if you want payments confirmed automatically; they usually take a percentage of each payment (often around 2% plus GST on that fee, check their current pricing). With Paivo the client pays you directly, so there is no per-payment cut and no gateway account to set up. The trade-off: you confirm each payment yourself after checking your bank." },
  { q: "What if a client says they've paid but the money isn't there?", a: "Nothing unlocks on their word alone. The client submits the UTR (and an optional screenshot), you match it against your bank statement, and only when you click Confirm does the invoice become paid and the files appear." },
  { q: "Is it safe to share my UPI ID?", a: "Your UPI ID only lets people send you money; it can't be used to take money out. It appears on your invoice's payment page (which has a long random link) and on your PDF invoices." },
  { q: "Is my data safe?", a: "Every request is checked against your account, and the database itself keeps one business's records away from another's, payment links use long random IDs that can't be guessed, and you can export or erase customer data at any time." },
];

export function LandingPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  if (user) return <Navigate to="/dashboard" replace />;
  const pro = PLANS.find((p) => p.id === "PRO")!;

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-12 text-center sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-200">
          <Zap className="h-3.5 w-3.5" /> For freelancers, studios and small businesses in India
        </span>
        <h1 className="mt-7 text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl">
          Your client pays by UPI.<br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">Your files unlock when they do.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          Send an invoice, your client pays by UPI straight to your bank, and your final files unlock only after they've paid. Paivo keeps track of who owes you, and helps you chase politely.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-emerald-300">
          No per-payment fee: clients pay you directly, so nothing is taken from each payment.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-500 px-7 text-sm font-bold text-white shadow-[0_10px_40px_-10px_rgba(99,102,241,0.9)] transition hover:bg-indigo-400">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to={DEMO_PAY_PATH} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 px-7 text-sm font-bold text-white transition hover:bg-white/10">
            See what your client sees
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">Free for 5 invoices a month. No card needed. Pro is ₹{inrPlain(pro.price)}/month. <Link to="/pricing" className="underline hover:text-slate-300">See pricing</Link></p>

        {/* Product mock */}
        <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">What your client sees</p>
              <p className="mt-1 text-2xl font-black text-white">Invoice · ₹45,000</p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">Payment due</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
              <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
              <div><p className="text-sm font-bold text-white">Your files are ready</p><p className="mt-0.5 text-xs text-slate-400">They unlock as soon as payment is confirmed.</p></div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <Unlock className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div><p className="text-sm font-bold text-white">Scan to pay by UPI</p><p className="mt-0.5 text-xs text-slate-400">GPay, PhonePe, Paytm or any UPI app.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-4xl px-5 py-10 text-center">
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Sound familiar?</h2>
        <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
          {[
            "You delivered the work. The client went quiet.",
            "You spend hours every week sending \"just following up\" messages.",
            "You can't tell which payments have actually landed in your bank.",
          ].map((t) => (
            <p key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">"{t}"</p>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">How Paivo fixes it</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
              <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${f.tone} shadow-lg`}><f.icon className="h-5 w-5 text-white" /></span>
              <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
          <p className="text-sm text-slate-400"><b className="text-white">Proper invoices for company finance teams.</b> Download a PDF with your GSTIN, TDS details and a UPI QR code that can be scanned straight off the page.</p>
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">How it works</h2>
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

      {/* Pricing teaser */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-6 ${p.highlight ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 bg-white/[0.03]"}`}>
              <p className="font-bold text-white">{p.name}</p>
              <p className="mt-2 text-3xl font-black text-white">{p.price ? `₹${inrPlain(p.price)}` : "Free"}<span className="text-sm font-medium text-slate-400">{p.price ? " /month" : ""}</span></p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400"><Check className="h-4 w-4 text-emerald-400" /> {p.features[0]}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-300 hover:text-indigo-200">Compare plans in detail <ArrowRight className="h-4 w-4" /></Link>
        </p>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-4xl px-5 py-12">
        <h2 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">Paivo and a payment link, side by side</h2>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 text-sm">
          <div className="grid grid-cols-3 bg-white/[0.06] px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-300">
            <span /><span>Paivo</span><span>Typical payment link</span>
          </div>
          {[
            ["Fee on each payment", "None. The client pays you directly.", "Usually a percentage of each payment."],
            ["Who holds the money", "Nobody. It goes to your UPI ID or bank.", "The gateway, then it settles to you."],
            ["Final files locked until paid", "Yes, you choose per invoice.", "Not part of a basic link."],
            ["Payment confirmation", "You confirm after checking your bank.", "Usually automatic."],
          ].map(([k, a, b]) => (
            <div key={k} className="grid grid-cols-3 gap-3 border-t border-white/10 px-4 py-3.5 text-slate-300">
              <span className="font-semibold text-white">{k}</span><span>{a}</span><span className="text-slate-400">{b}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">A general comparison, not about any one company. Check any provider's own pricing before deciding.</p>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 py-16">
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
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-8">
        <div className="rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent p-10 text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Send your next invoice with Paivo.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Free for your first five invoices every month. Set up in about ten minutes.</p>
          <Link to="/register" className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-sm font-bold text-slate-900 transition hover:bg-slate-200">
            Create your free account <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm"><Link to={DEMO_PAY_PATH} className="font-semibold text-indigo-300 underline hover:text-indigo-200">Or see what your client sees first</Link></p>
        </div>
      </section>
    </MarketingShell>
  );
}
