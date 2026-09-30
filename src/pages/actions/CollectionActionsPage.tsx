import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Info,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { collectionActionsApi, overdueInvoicesApi } from "../../api";
import type { CollectionAction } from "../../types";
import { date, dateTime, formatActionType, titleCase, cn } from "../../lib/utils";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import { Tabs } from "../../components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";

const validTransitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function ActionsPage() {
  const [actions, setActions] = useState<CollectionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Engine run state
  const [runningEngine, setRunningEngine] = useState(false);
  const [engineFeedback, setEngineFeedback] = useState<string | null>(null);

  // Metadata Inspector Modal State
  const [inspectAction, setInspectAction] = useState<CollectionAction | null>(null);

  const loadActions = () => {
    setLoading(true);
    setError(null);
    collectionActionsApi
      .list(statusFilter === "ALL" ? undefined : { status: statusFilter })
      .then((res) => {
        setActions(res.value || []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load collection actions.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadActions();
  }, [statusFilter]);

  const filteredActions = useMemo(() => {
    return actions.filter((act) => {
      const q = query.toLowerCase();
      const actionType = formatActionType(act.action_type).toLowerCase();
      const customer = (act.customers?.name || "").toLowerCase();
      const invoice = (act.invoices?.invoice_number || "").toLowerCase();
      return actionType.includes(q) || customer.includes(q) || invoice.includes(q);
    });
  }, [actions, query]);

  const handleUpdateStatus = async (actionId: string, nextStatus: string) => {
    setBusyActionId(actionId);
    setStatusNotice(null);
    try {
      await collectionActionsApi.updateStatus(actionId, nextStatus);
      setStatusNotice(`Action status updated to ${titleCase(nextStatus)}.`);
      setTimeout(() => setStatusNotice(null), 4000);
      loadActions();
    } catch (err: any) {
      setStatusNotice(`Failed to update status: ${err.message || "Transition rejected"}`);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRunOverdueEngine = async () => {
    setRunningEngine(true);
    setEngineFeedback(null);
    try {
      const res = await overdueInvoicesApi.process();
      setEngineFeedback(
        `Engine completed: ${res.invoices_detected} overdue detected, ${res.actions_created} follow-ups scheduled.`
      );
      setTimeout(() => setEngineFeedback(null), 6000);
      loadActions();
    } catch (err: any) {
      setEngineFeedback(`Engine failed: ${err.message || "Execution error"}`);
    } finally {
      setRunningEngine(false);
    }
  };

  const statusTabs = [
    { id: "ALL", label: "All Actions" },
    { id: "PENDING", label: "Pending" },
    { id: "PROCESSING", label: "Processing" },
    { id: "COMPLETED", label: "Completed" },
    { id: "FAILED", label: "Failed" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection Operations Engine"
        description="Autonomous workflow triggers, schedule follow-ups, dispute escalations, and payment verification tasks."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={loadActions}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="brand"
              loading={runningEngine}
              onClick={handleRunOverdueEngine}
              icon={<Play className="h-3.5 w-3.5 fill-current" />}
            >
              Run Overdue Engine
            </Button>
          </div>
        }
      />

      {/* Engine Feedback Notice */}
      {engineFeedback && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm text-emerald-900 shadow-soft">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{engineFeedback}</span>
          </div>
          <button
            onClick={() => setEngineFeedback(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Update Notice */}
      {statusNotice && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800">
          <span>{statusNotice}</span>
          <button
            onClick={() => setStatusNotice(null)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          tabs={statusTabs}
          activeTab={statusFilter}
          onChange={setStatusFilter}
          size="sm"
        />

        <div className="w-full lg:w-72">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search action or debtor..."
          />
        </div>
      </div>

      {/* Actions Table */}
      {loading && actions.length === 0 ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} retry={loadActions} />
      ) : filteredActions.length === 0 ? (
        <EmptyState
          title="No collection actions found"
          description={
            query
              ? `No operations match your query "${query}".`
              : "No actions in this category. Click 'Run Overdue Engine' to scan for overdue invoices and trigger follow-ups."
          }
          action={
            <Button
              size="sm"
              variant="brand"
              onClick={handleRunOverdueEngine}
              loading={runningEngine}
              icon={<Play className="h-3.5 w-3.5 fill-current" />}
            >
              Run Overdue Scan
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-white shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action Operation</TableHead>
                <TableHead>Target Debtor</TableHead>
                <TableHead>Linked Invoice</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Operations & Audit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActions.map((act) => {
                const transitions = validTransitions[act.status] || [];
                const isBusy = busyActionId === act.id;

                return (
                  <TableRow key={act.id}>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-ink block">
                          {formatActionType(act.action_type)}
                        </span>
                        <span className="text-[11px] text-muted block mt-0.5">
                          Triggered: {date(act.created_at)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {act.customers ? (
                        <Link
                          to={`/customers/${act.customers.id}`}
                          className="font-medium text-ink hover:text-brand-700 hover:underline"
                        >
                          {act.customers.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell mono>
                      {act.invoices ? (
                        <Link
                          to={`/invoices/${act.invoices.id}`}
                          className="text-xs text-brand-700 hover:underline font-semibold"
                        >
                          {act.invoices.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">Account-level</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700">{date(act.scheduled_at)}</span>
                      {act.executed_at && (
                        <span className="block text-[10px] text-emerald-700">
                          Executed {date(act.executed_at)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge value={act.status} kind="action" />
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        {transitions.length > 0 ? (
                          <select
                            disabled={isBusy}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleUpdateStatus(act.id, e.target.value);
                              }
                            }}
                            className="h-8 rounded border border-line bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            aria-label={`Update status for ${act.action_type}`}
                          >
                            <option value="">{isBusy ? "Updating…" : "Transition State"}</option>
                            {transitions.map((next) => (
                              <option key={next} value={next}>
                                Mark as {titleCase(next)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted font-medium">Terminal state</span>
                        )}

                        {act.metadata && (
                          <button
                            onClick={() => setInspectAction(act)}
                            className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Inspect Engine Audit Metadata"
                            aria-label="Inspect metadata"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Table Footer */}
          <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/50 px-5 py-3 text-xs text-muted">
            <span>
              Total {filteredActions.length} action(s) in view
            </span>
            <span className="font-mono tabular-nums">
              Engine state: Deterministic Idempotent
            </span>
          </div>
        </div>
      )}

      {/* Metadata Audit Modal */}
      <Modal
        isOpen={Boolean(inspectAction)}
        onClose={() => setInspectAction(null)}
        title="Collection Action Audit Trail"
        description={`Audit details for ${inspectAction ? formatActionType(inspectAction.action_type) : ""}`}
        maxWidth="md"
      >
        {inspectAction && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-slate-50 p-3">
              <div>
                <span className="text-muted block">Action ID</span>
                <span className="font-mono font-semibold text-ink break-all">
                  {inspectAction.id}
                </span>
              </div>
              <div>
                <span className="text-muted block">Status</span>
                <Badge value={inspectAction.status} kind="action" />
              </div>
            </div>

            {inspectAction.metadata && (
              <div>
                <h4 className="font-semibold text-ink text-xs uppercase tracking-wider mb-2">
                  Engine Decision Metadata
                </h4>
                <div className="rounded-lg border border-slate-200 bg-slate-900 p-3.5 text-slate-200 font-mono text-[11px] overflow-x-auto">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(inspectAction.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-line">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setInspectAction(null)}
              >
                Close Audit
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
