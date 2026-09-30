import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckSquare,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../lib/utils";

interface SidebarProps {
  onClose?: () => void;
}

interface NavGroup {
  label: string;
  items: {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Receivables",
    items: [
      { to: "/invoices", label: "Invoices Ledger", icon: FileText },
      { to: "/customers", label: "Customer 360°", icon: Users },
      { to: "/conversations", label: "Collections Inbox", icon: MessageSquare },
    ],
  },
  {
    label: "Collections Engine",
    items: [
      { to: "/collection-actions", label: "Collection Actions", icon: CheckSquare },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/settings", label: "Organization & Profile", icon: Settings },
    ],
  },
];

export function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-full flex-col bg-white border-r border-line select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-line px-5">
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={onClose}
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white shadow-sm transition-transform group-hover:scale-105">
            <span className="font-bold text-sm tracking-tight">L</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-ink">Ledgerlane</span>
            </div>
            <span className="text-[10px] font-medium text-brand-700 tracking-wider uppercase">
              Receivables OS
            </span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Organization & User Profile Footer */}
      <div className="border-t border-line p-3 bg-slate-50/50">
        <div className="flex items-center gap-3 rounded-md p-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 font-semibold text-xs text-slate-700 shrink-0">
            {initials(user?.name || user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink leading-tight">
              {user?.name || "Operations User"}
            </p>
            <p className="truncate text-[11px] text-muted leading-tight mt-0.5">
              {user?.email}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between pt-2 border-t border-line/60 px-1">
          <Link
            to="/settings"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px]">Workspace settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
