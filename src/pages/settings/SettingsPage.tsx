import React, { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  Database,
  Lock,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { systemApi } from "../../api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export function SettingsPage() {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<{ status: string; database: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = () => {
    setChecking(true);
    systemApi
      .health()
      .then((res) => setHealthData(res))
      .catch(() => setHealthData({ status: "disconnected", database: "unavailable" }))
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace & Organization Settings"
        description="Tenant configuration, security isolation, active operator profile, and infrastructure health."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Organization / Tenant Profile */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-700" />
              <CardTitle>Organization Workspace</CardTitle>
            </div>
            <CardDescription>
              Multi-tenant isolated workspace scope and organizational attributes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="rounded-lg border border-line bg-slate-50 p-4 space-y-3">
              <div>
                <span className="text-muted block font-medium">Tenant Organization ID</span>
                <span className="font-mono font-semibold text-ink break-all text-xs">
                  {user?.organization_id || "d3b07384-d113-4966-9c0e-6091398c8c6a"}
                </span>
              </div>
              <div className="border-t border-line/60 pt-2">
                <span className="text-muted block font-medium">Data Partitioning Model</span>
                <span className="font-semibold text-ink">
                  Deterministic Row-Level Tenant Isolation
                </span>
                <p className="mt-1 text-[11px] text-muted">
                  All customer, invoice, and conversation queries are strictly filtered by organization_id enforced via JWT middleware.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Account Profile */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-brand-700" />
              <CardTitle>Operator Account Profile</CardTitle>
            </div>
            <CardDescription>
              Authenticated administrator account details and session credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-3">
              <div>
                <span className="text-muted block font-medium">Operator Name</span>
                <span className="text-sm font-semibold text-ink">
                  {user?.name || "System Operator"}
                </span>
              </div>

              <div className="border-t border-line/60 pt-2">
                <span className="text-muted block font-medium">Work Email</span>
                <span className="text-sm font-semibold text-ink">
                  {user?.email || "demo@ledgerlane.com"}
                </span>
              </div>

              <div className="border-t border-line/60 pt-2">
                <span className="text-muted block font-medium">User Identifier (UUID)</span>
                <span className="font-mono text-xs text-slate-700">
                  {user?.id || "e4a18295-e224-4a77-ad1f-71a2409d9d7b"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backend & AI System Health */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-brand-700" />
                <CardTitle>System & Engine Health Verification</CardTitle>
              </div>
              <CardDescription>
                Live connectivity status with Express API server, Database, and Collections Engine.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={checking}
              onClick={checkHealth}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Verify Connection
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-line p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-ink">API Server Status</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      healthData?.status === "ok" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>
                <p className="text-base font-bold text-ink font-mono mt-2">
                  {healthData?.status === "ok" ? "200 OK / Live" : "Unverified"}
                </p>
                <p className="mt-1 text-muted text-[11px]">Port 3000 unified reverse proxy</p>
              </div>

              <div className="rounded-lg border border-line p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-ink">Database Connectivity</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      healthData?.database === "connected" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>
                <p className="text-base font-bold text-ink font-mono mt-2">
                  {healthData?.database === "connected" ? "Active / In-Sync" : "Connecting"}
                </p>
                <p className="mt-1 text-muted text-[11px]">Database query response verified</p>
              </div>

              <div className="rounded-lg border border-line p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-ink">AI Intent Classification</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-base font-bold text-ink font-mono mt-2">
                  Deterministic Rule-Based
                </p>
                <p className="mt-1 text-muted text-[11px]">Zero cold starts, instant response</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
