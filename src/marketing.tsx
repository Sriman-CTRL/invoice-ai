import { Link, NavLink } from "react-router-dom";
import { Sparkles } from "lucide-react";

/** Demo invoice owned by the founder's own account, used for "see it live" links. */
export const DEMO_PAY_PATH = "/pay/13144558-e5f1-49ca-b968-8e7fe361d86e";

export function MarketingHeader() {
  const link = ({ isActive }: { isActive: boolean }) => `hover:text-white ${isActive ? "text-white" : ""}`;
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_25px_-5px_rgba(99,102,241,0.8)]">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </span>
        <span className="text-lg font-extrabold tracking-tight text-white">Paivo</span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm font-medium text-slate-400 md:flex">
        <a href="/#how" className="hover:text-white">How it works</a>
        <NavLink to="/pricing" className={link}>Pricing</NavLink>
        <a href="/#faq" className="hover:text-white">FAQ</a>
      </nav>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link to="/pricing" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white sm:inline-block md:hidden">Pricing</Link>
        <Link to="/login" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-300 hover:text-white">Sign in</Link>
        <Link to="/register" className="whitespace-nowrap rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-200">Start free</Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-xs text-slate-500">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link to="/pricing" className="hover:text-slate-300">Pricing</Link>
        <Link to="/tools/gst-invoice-calculator" className="hover:text-slate-300">GST calculator</Link>
        <Link to="/tools/tds-calculator" className="hover:text-slate-300">TDS calculator</Link>
        <Link to="/tools/payment-reminder-writer" className="hover:text-slate-300">Reminder writer</Link>
        <Link to="/whats-new" className="hover:text-slate-300">What's new</Link>
        <Link to="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-slate-300">Terms of Service</Link>
        <Link to="/login" className="hover:text-slate-300">Sign in</Link>
      </div>
      <p className="mx-auto mt-3 max-w-2xl">
        Paivo is invoicing software. Your clients pay you directly by UPI or bank transfer; we never hold or move your money.
      </p>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070a13] text-slate-200">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.28),transparent_70%)]" />
      <MarketingHeader />
      <main className="relative z-10">{children}</main>
      <MarketingFooter />
    </div>
  );
}
