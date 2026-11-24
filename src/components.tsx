import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Play,
  Receipt,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { adminApi } from "./api";
import { LeadDialog } from "./LeadForms";
import { CommandPalette } from "./CommandPalette";
import { ActivityBell } from "./ActivityBell";
import { useAuth } from "./auth";
import { PaivoWordmark } from "./Brand";
import { initials, titleCase } from "./lib";

export function Badge({ value, kind }: { value: string; kind?: "status" | "intent" }) {
  const normalized = value.toUpperCase();

  // Premium status colors with subtle borders and dot indicators
  const config: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
    PAID: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700",
      ring: "ring-emerald-600/20",
      dot: "bg-emerald-500",
    },
    SUCCEEDED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700",
      ring: "ring-emerald-600/20",
      dot: "bg-emerald-500",
    },
    COMPLETED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700",
      ring: "ring-emerald-600/20",
      dot: "bg-emerald-500",
    },
    OPEN: {
      bg: "bg-sky-500/10",
      text: "text-sky-700",
      ring: "ring-sky-600/20",
      dot: "bg-sky-500",
    },
    PROCESSING: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-700",
      ring: "ring-indigo-600/20",
      dot: "bg-indigo-500 animate-pulse",
    },
    PENDING: {
      bg: "bg-amber-500/10",
      text: "text-amber-800",
      ring: "ring-amber-600/20",
      dot: "bg-amber-500",
    },
    PARTIALLY_PAID: {
      bg: "bg-violet-500/10",
      text: "text-violet-700",
      ring: "ring-violet-600/20",
      dot: "bg-violet-500",
    },
    OVERDUE: {
      bg: "bg-rose-500/10",
      text: "text-rose-700",
      ring: "ring-rose-600/20",
      dot: "bg-rose-500",
    },
    FAILED: {
      bg: "bg-rose-500/10",
      text: "text-rose-700",
      ring: "ring-rose-600/20",
      dot: "bg-rose-500",
    },
    CANCELLED: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      ring: "ring-slate-500/20",
      dot: "bg-slate-400",
    },
    DISPUTE: {
      bg: "bg-rose-500/10",
      text: "text-rose-700",
      ring: "ring-rose-600/25",
      dot: "bg-rose-500",
    },
    PAYMENT_CONFIRMED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-800",
      ring: "ring-emerald-600/25",
      dot: "bg-emerald-500",
    },
    PAYMENT_PROMISED: {
      bg: "bg-brand-500/10",
      text: "text-brand-700",
      ring: "ring-brand-600/25",
      dot: "bg-brand-500",
    },
    PAYMENT_PLAN_REQUEST: {
      bg: "bg-purple-500/10",
      text: "text-purple-700",
      ring: "ring-purple-600/25",
      dot: "bg-purple-500",
    },
    REQUEST_EXTENSION: {
      bg: "bg-amber-500/10",
      text: "text-amber-800",
      ring: "ring-amber-600/25",
      dot: "bg-amber-500",
    },
  };

  const current = config[normalized] || {
    bg: kind === "intent" ? "bg-brand-500/10" : "bg-slate-100",
    text: kind === "intent" ? "text-brand-700" : "text-slate-700",
    ring: kind === "intent" ? "ring-brand-600/20" : "ring-slate-500/20",
    dot: kind === "intent" ? "bg-brand-500" : "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${current.bg} ${current.text} ${current.ring}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${current.dot}`} />
      <span>{titleCase(value.replace(/_/g, " "))}</span>
    </span>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 ring-8 ring-rose-50/50">
        <AlertCircle className="h-7 w-7 text-rose-600" />
      </div>
      <h3 className="text-base font-bold text-slate-900">Something needs attention</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-500 leading-relaxed">{message}</p>
      {retry && (
        <button className="btn-secondary mt-6" onClick={retry}>
          <RotateCw className="h-4 w-4 text-slate-500" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <svg viewBox="0 0 120 96" className="mb-3 h-24 w-28 fade-in" aria-hidden="true">
        <defs>
          <linearGradient id="es-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#818cf8" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="86" rx="38" ry="5" fill="#e2e8f0" />
        <rect x="30" y="14" width="50" height="64" rx="7" fill="#fff" stroke="#cbd5e1" strokeWidth="2" transform="rotate(-6 55 46)" />
        <rect x="40" y="10" width="50" height="66" rx="7" fill="#fff" stroke="url(#es-g)" strokeWidth="2.5" />
        <rect x="48" y="22" width="22" height="5" rx="2.5" fill="url(#es-g)" />
        <rect x="48" y="34" width="34" height="4" rx="2" fill="#e2e8f0" />
        <rect x="48" y="43" width="28" height="4" rx="2" fill="#e2e8f0" />
        <rect x="48" y="52" width="32" height="4" rx="2" fill="#e2e8f0" />
        <circle cx="84" cy="66" r="13" fill="url(#es-g)" />
        <path d="M84 59v14M77 66h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-500 leading-relaxed">{detail}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="panel overflow-hidden">
      <div className="h-12 border-b border-slate-100 bg-slate-50/60" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="flex items-center gap-6 px-6 py-4.5" key={i}>
            <div className="h-4 w-1/4 animate-pulse rounded-md bg-slate-200/70" />
            <div className="h-4 w-1/3 animate-pulse rounded-md bg-slate-200/60" />
            <div className="h-4 w-1/6 animate-pulse rounded-md bg-slate-200/70" />
            <div className="ml-auto h-5 w-20 animate-pulse rounded-full bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  detail,
  back,
  actions,
}: {
  title: string;
  detail?: string;
  back?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {back && (
          <Link
            to={back}
            className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

const nav = [
  {
    label: "Main",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/invoices", label: "Invoices", icon: Receipt },
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "AI Automation",
    items: [
      { to: "/conversations", label: "Inbox & Threads", icon: MessageSquareText },
      { to: "/collection-actions", label: "Action Queue", icon: Zap },
      { to: "/playground", label: "AI Simulator", icon: Terminal },
    ],
  },
];

function SidebarContent({ close }: { close?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useEffect(() => {
    adminApi.me().then((r) => setIsAdmin(r.is_admin)).catch(() => setIsAdmin(false));
  }, [user?.id]);
  const groups = isAdmin
    ? [...nav, { label: "Platform", items: [{ to: "/admin/growth", label: "Growth", icon: LayoutDashboard }, { to: "/admin", label: "Plan payments", icon: ShieldCheck }] }]
    : nav;

  return (
    <div className="flex h-full flex-col bg-midnight-950 text-slate-300">
      {/* Brand Header */}
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={close}>
          <div>
            <div className="flex items-center gap-2 text-white">
              <PaivoWordmark height={28} />
              <span className="rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-300 ring-1 ring-inset ring-brand-400/30">
                AI
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">Invoices &amp; payments</p>
          </div>
        </Link>
        {close && (
          <button
            className="btn h-8 w-8 px-0 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={close}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  end
                  to={to}
                  onClick={close}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-gradient-to-r from-brand-600/30 to-brand-500/10 text-white shadow-sm ring-1 ring-brand-500/40"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                  key={to}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4.5 w-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                    <span>{label}</span>
                  </div>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 pb-3">
        <Link to="/whats-new" onClick={close} className="mb-2 block rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">What's new</Link>
        <button onClick={() => setFeedbackOpen(true)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white">
          💬 Tell us what's missing
          <span className="mt-0.5 block text-[10px] font-normal text-slate-500">Goes straight to the founder</span>
        </button>
      </div>
      <LeadDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} kind="feedback" defaultEmail={user?.email} title="Tell us what's missing" intro="What were you trying to do? What got in the way? Every message is read." />

      {/* Astryx Live System Health Beacon */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3 text-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-[11px] tracking-wide">Smart replies</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              BETA
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 font-mono">
            Reads client replies. Coming soon.
          </p>
        </div>
      </div>

      {/* User Footer */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-tr from-brand-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
            {initials(user?.name || user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-white">
              {user?.name || "Workspace Owner"}
            </span>
            <span className="block truncate text-[11px] text-slate-400">
              {user?.email}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const location = useLocation();
  const navigate = useNavigate();

  const currentSection = location.pathname.split("/")[1] || "dashboard";

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800/20 bg-midnight-950 shadow-xl lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-midnight-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent close={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content Pane */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              className="btn-secondary h-9 w-9 px-0 lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:flex">
              <span>Ledger</span>
              <span>/</span>
              <span className="font-bold text-slate-800">
                {currentSection.replace(/-/g, " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Astryx Quick Command Search Input */}
            <div
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-100/70 px-3 py-1.5 text-xs text-slate-500 shadow-inner hover:border-slate-300 transition-colors"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 w-40 truncate">Quick jump to invoice or customer...</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400">
                ⌘K
              </kbd>
            </div>

            <ActivityBell />

            <Link
              to="/playground"
              className="btn-secondary h-9 text-xs font-bold"
              title="Test with AI simulator"
            >
              <Terminal className="h-3.5 w-3.5 text-brand-600" />
              <span>Simulate</span>
            </Link>
          </div>
        </header>

        <main key={location.pathname} className="page-in mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="relative block w-full">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-10 pr-12 text-sm font-medium"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
        ⌘K
      </span>
    </label>
  );
}
