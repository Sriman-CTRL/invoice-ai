import { TURNSTILE_SITE_KEY, TurnstileWidget } from "../TurnstileWidget";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, RefreshCw, Sparkles, X, Zap } from "lucide-react";
import { Badge } from "../components";
import { useAuth } from "../auth";
import type { Customer, Dashboard } from "../types";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    organization_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [humanToken, setHumanToken] = useState<string | null>(null);
  const [humanReset, setHumanReset] = useState(0);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.email || !form.password || (mode === "register" && (!form.name || !form.organization_name))) {
      setError("Please complete all required fields.");
      return;
    }
    if (mode === "register" && (form.password.length < 10 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))) {
      setError("Password must be at least 10 characters and include a letter and a number.");
      return;
    }

    if (mode === "register" && TURNSTILE_SITE_KEY && !humanToken) {
      setError("Please complete the human check below.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        navigate("/dashboard");
      } else {
        await register({ ...form, turnstile_token: humanToken ?? undefined });
        navigate("/login", { state: { registered: true } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate.");
      if (mode === "register") setHumanReset((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((curr) => ({ ...curr, [field]: e.target.value }));

  const registering = mode === "register";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr] bg-slate-950 font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Hero Pane (Astryx Obsidian & Luminous Meshes) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-midnight-950 p-12 lg:flex border-r border-white/10 text-white">
        {/* Luminous ambient meshes */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[450px] w-[450px] rounded-full bg-accent-cyan/15 blur-[120px]" />

        {/* Brand Header */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-violet-500 shadow-glow ring-1 ring-white/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block">Ledgerlane</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Invoices & payments
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Gemini 2.5 Flash Online</span>
          </div>
        </div>

        {/* Center Content */}
        <div className="max-w-lg my-auto py-8 z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1 text-xs font-bold text-brand-300 backdrop-blur-md mb-5">
            <Zap className="h-3.5 w-3.5 text-brand-400" />
            <span>Less chasing. More getting paid.</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight leading-[1.15] text-white sm:text-5xl">
            Send the invoice.{" "}
            <span className="bg-gradient-to-r from-brand-300 via-indigo-200 to-teal-200 bg-clip-text text-transparent">
              Get paid before you hand over the work.
            </span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Send invoices with a UPI QR code, keep your final files locked until the client pays, and see at a glance who still owes you. Payments go straight to your bank account.
          </p>

          {/* Astryx Live AR Simulation Bento Card */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4.5 backdrop-blur-xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] font-bold text-white tracking-wide">
                  EXAMPLE · HOW REPLY-READING WILL WORK
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                ₹45,000 DUE
              </span>
            </div>

            {/* Inbound Customer Message Simulation */}
            <div className="rounded-xl bg-slate-900/90 border border-white/5 p-3 text-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-bold text-slate-300">From: Rohan Mehta (Acme Studios)</span>
                <span className="font-mono">Inbound Email</span>
              </div>
              <p className="text-slate-200 italic font-mono text-[11px] leading-relaxed">
                "Our finance head was out of office. We've scheduled the ₹45,000 transfer for this Friday via RTGS."
              </p>
            </div>

            {/* Gemini Classification Badge */}
            <div className="flex items-center justify-between rounded-xl bg-brand-500/15 border border-brand-500/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-brand-300 shrink-0" />
                <span className="font-bold text-brand-200">Gemini 2.5 Classified:</span>
              </div>
              <span className="font-mono text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                PAYMENT_PROMISED (99.8%)
              </span>
            </div>

            {/* Autonomous Action */}
            <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Chasing halted · Check-in auto-calendared for Friday</span>
            </div>
          </div>

          {/* 3 Bento Mini-Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Your files</span>
              <p className="text-sm font-black text-emerald-400 mt-0.5 font-mono">Locked until paid</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment fees</span>
              <p className="text-sm font-black text-brand-300 mt-0.5 font-mono">None (UPI direct)</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Reminders</span>
              <p className="text-sm font-black text-teal-300 mt-0.5 font-mono">Email & WhatsApp</p>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-white/10 pt-4 z-10">
          <div className="flex items-center gap-3">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          </div>
          <span>Opt-out requests are honoured</span>
        </div>
      </section>

      {/* Right Form Pane */}
      <section className="flex items-center justify-center p-6 sm:p-12 bg-slate-900/60 backdrop-blur-xl">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-white">Ledgerlane</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Beta
            </span>
          </div>

          {/* Form Header Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-white/10 mb-6">
              <Link
                to="/login"
                className={`w-1/2 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  !registering
                    ? "bg-brand-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className={`w-1/2 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  registering
                    ? "bg-brand-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Create Account
              </Link>
            </div>

            <div>
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                {registering ? "Deploy your AR Workspace" : "Access your Command Center"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {registering
                  ? "Set up your workspace in a few minutes."
                  : "Sign in to see your invoices and who owes you."}
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {registering && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="name">
                      Full Name *
                    </label>
                    <input
                      id="name"
                      className="input bg-slate-950 border-white/10 text-white text-xs"
                      autoComplete="name"
                      placeholder="Sriman Bhavani"
                      value={form.name}
                      onChange={set("name")}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="organization">
                      Company / Organization Name *
                    </label>
                    <input
                      id="organization"
                      className="input bg-slate-950 border-white/10 text-white text-xs"
                      autoComplete="organization"
                      placeholder="Acme Technologies"
                      value={form.organization_name}
                      onChange={set("organization_name")}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="email">
                  Work Email *
                </label>
                <input
                  id="email"
                  className="input bg-slate-950 border-white/10 text-white text-xs"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400" htmlFor="password">
                    Password *
                  </label>
                </div>
                <input
                  id="password"
                  className="input bg-slate-950 border-white/10 text-white text-xs"
                  type="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  placeholder="••••••••••"
                  value={form.password}
                  onChange={set("password")}
                />
              </div>

              {registering && <TurnstileWidget onToken={setHumanToken} resetKey={humanReset} />}

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-300 flex items-center justify-between animate-fade-in">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-11 text-xs font-bold shadow-glow mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Connecting to Ledger...</span>
                  </>
                ) : registering ? (
                  <span>Initialize Organization Workspace</span>
                ) : (
                  <span>Enter Collection Dashboard</span>
                )}
              </button>
            </form>
          </div>

          {/* Legal Compliance Footer Links */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <span>Built with DPDP Act privacy in mind</span>
          </div>
        </div>
      </section>
    </main>
  );
}
