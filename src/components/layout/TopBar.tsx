import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  CheckCircle2,
  Menu,
  Play,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { overdueInvoicesApi, systemApi } from "../../api";
import { Button } from "../ui/Button";

interface TopBarProps {
  onOpenMobileNav: () => void;
}

export function TopBar({ onOpenMobileNav }: TopBarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [healthStatus, setHealthStatus] = useState<"ok" | "checking" | "error">("checking");
  const [scanningOverdue, setScanningOverdue] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    systemApi
      .health()
      .then((res) => {
        if (mounted) setHealthStatus(res.status === "ok" ? "ok" : "error");
      })
      .catch(() => {
        if (mounted) setHealthStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleScanOverdue = async () => {
    setScanningOverdue(true);
    setScanResult(null);
    try {
      const res = await overdueInvoicesApi.process();
      setScanResult(
        `Scanned ${res.invoices_detected} overdue; created ${res.actions_created} follow-ups.`
      );
      setTimeout(() => setScanResult(null), 6000);
    } catch (err: any) {
      setScanResult(`Error scanning: ${err.message || "Request failed"}`);
      setTimeout(() => setScanResult(null), 6000);
    } finally {
      setScanningOverdue(false);
    }
  };

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path.startsWith("/invoices/")) return "Invoice Inspection";
    if (path === "/invoices") return "Invoices Ledger";
    if (path.startsWith("/customers/")) return "Customer 360°";
    if (path === "/customers") return "Customers Directory";
    if (path.startsWith("/conversations/")) return "Conversation Timeline";
    if (path === "/conversations") return "Collections Inbox";
    if (path === "/collection-actions") return "Collection Actions";
    if (path === "/settings") return "Workspace Settings";
    return "Executive Dashboard";
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
      {/* Left zone: Mobile toggle + Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="text-muted hidden sm:inline">Workspace</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="font-semibold text-ink">{getBreadcrumbTitle()}</span>
        </div>
      </div>

      {/* Right zone: System Health + Quick Scan Action */}
      <div className="flex items-center gap-3">
        {scanResult && (
          <div className="hidden md:flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{scanResult}</span>
          </div>
        )}

        {/* Overdue Engine Quick Trigger */}
        <Button
          size="sm"
          variant="secondary"
          loading={scanningOverdue}
          onClick={handleScanOverdue}
          icon={<Play className="h-3.5 w-3.5 fill-current text-slate-600" />}
          className="hidden sm:inline-flex text-xs"
          title="Run deterministic engine to check overdue invoices and schedule collection actions"
        >
          <span>Run Collections Engine</span>
        </Button>

        {/* User quick profile link */}
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-lg border border-line bg-slate-50/80 px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
          title="View Workspace Settings"
        >
          <div className="grid h-6 w-6 place-items-center rounded bg-brand-700 text-[11px] font-semibold text-white">
            {user?.name ? user.name.slice(0, 1).toUpperCase() : "U"}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-ink leading-none">{user?.name || "Account"}</span>
            <span className="text-[10px] text-muted leading-none mt-0.5 truncate max-w-[120px]">
              {user?.email || "Signed in"}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
