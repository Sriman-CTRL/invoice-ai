import React, { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    organization_name: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(() => {
    return (location.state as any)?.registered
      ? "Account created successfully. Please sign in to your workspace."
      : null;
  });
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!form.email || !form.password) {
      setError("Please complete all required fields.");
      return;
    }

    if (isRegister && (!form.name || !form.organization_name)) {
      setError("Please specify your name and organization name.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(form);
        navigate("/login", { state: { registered: true } });
      } else {
        await login(form.email, form.password);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setForm({
      email: "demo@ledgerlane.com",
      password: "password123",
      name: "Demo Admin",
      organization_name: "Acme Financial Corp",
    });
    setError(null);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr] bg-white">
      {/* Left hero brand column */}
      <section className="hidden lg:flex flex-col justify-between bg-slate-900 p-12 text-white relative overflow-hidden">
        {/* Subtle grid pattern backdrop */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-slate-950 font-bold text-base shadow">
            L
          </div>
          <div>
            <span className="text-base font-bold tracking-tight">Ledgerlane</span>
            <span className="block text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
              Receivables OS
            </span>
          </div>
        </div>

        {/* Narrative core */}
        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Deterministic Finance Architecture</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white leading-[1.15]">
            Autonomous accounts receivable with deterministic follow-through.
          </h1>

          <p className="text-sm leading-relaxed text-slate-300">
            Ledgerlane unifies invoice tracking, AI-powered message intent classification, and automated collection workflows—grounded strictly in authoritative payment records.
          </p>

          <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-800">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                AI Intent Engine
              </p>
              <p className="mt-1 text-xs text-slate-300 leading-normal">
                Classifies promises, disputes, and payment confirmations in customer replies.
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Tenant Isolation
              </p>
              <p className="mt-1 text-xs text-slate-300 leading-normal">
                Strict multi-tenant security guarantees for each business organization.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-6">
          <span>Enterprise Collections Platform</span>
          <span>Authoritative Payment Guardrails</span>
        </div>
      </section>

      {/* Right form column */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand header */}
          <div className="flex items-center gap-2.5 lg:hidden mb-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white font-bold text-sm">
              L
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-ink">Ledgerlane</span>
              <span className="block text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">
                Receivables OS
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              {isRegister ? "Create organization workspace" : "Sign in to workspace"}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-muted">
              {isRegister
                ? "Set up your company workspace to automate receivables."
                : "Enter your credentials to access your collections ledger."}
            </p>
          </div>

          {/* Success notice */}
          {successNotice && (
            <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Demo Fill Button */}
          {!isRegister && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800">Demo Organization</p>
                <p className="text-[11px] text-muted">Preloaded with invoices, customers & conversations</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFillDemo}
                className="text-xs shrink-0"
              >
                Fill credentials
              </Button>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <Input
                  label="Full Name"
                  id="name"
                  type="text"
                  required
                  placeholder="e.g. Jane Miller"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  prefixIcon={<User className="h-4 w-4" />}
                />

                <Input
                  label="Organization Name"
                  id="organization_name"
                  type="text"
                  required
                  placeholder="e.g. Acme Financial Inc."
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  prefixIcon={<Building2 className="h-4 w-4" />}
                />
              </>
            )}

            <Input
              label="Work Email"
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              prefixIcon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Password"
              id="password"
              type="password"
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              prefixIcon={<Lock className="h-4 w-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {isRegister ? "Create workspace" : "Sign in to workspace"}
            </Button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="pt-2 text-center text-xs text-muted">
            {isRegister ? (
              <span>
                Already have a workspace?{" "}
                <Link to="/login" className="font-semibold text-brand-700 hover:underline">
                  Sign in
                </Link>
              </span>
            ) : (
              <span>
                New to Ledgerlane?{" "}
                <Link to="/register" className="font-semibold text-brand-700 hover:underline">
                  Create a workspace
                </Link>
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
