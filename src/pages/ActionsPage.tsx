import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { actionsApi, fetchProofImage, overdueApi } from "../api";
import { Badge, EmptyState, ErrorState, PageHeader, TableSkeleton } from "../components";
import { dateTime, titleCase } from "../lib";
import type { CollectionAction, Customer, Invoice } from "../types";
import { useResource } from "./shared";
import { useToast } from "../toast";

const transitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "FAILED"],
};

export function ActionsPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const r = useResource(() => actionsApi.list(status || undefined), [status]);

  const handleRunScan = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const res = await overdueApi.process();
      setNotice(
        `Automated sweep complete: ${res.invoices_detected} overdue invoice(s) evaluated, ${res.actions_created} collection action(s) created.`
      );
      toast.success("Overdue sweep complete", `${res.actions_created} collection action(s) created.`);
      r.reload();
    } catch (err: any) {
      toast.error("Scan failed", err?.message);
      setNotice("Scan failed: " + (err?.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  };

  const update = async (action: CollectionAction, next: string) => {
    setBusy(action.id);
    setNotice(null);
    try {
      await actionsApi.updateStatus(action.id, next);
      toast.success(`Action marked ${next.toLowerCase()}`);
      r.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to transition action.";
      toast.error("Update failed", msg);
      setNotice(msg);
    } finally {
      setBusy(null);
    }
  };

  const [shot, setShot] = useState<{ url: string; title: string } | null>(null);
  const viewShot = async (action: CollectionAction) => {
    try {
      const url = await fetchProofImage(action.id);
      setShot({ url, title: String((action.metadata as Record<string, unknown> | undefined)?.utr ?? "Payment screenshot") });
    } catch (e: any) {
      toast.error("Could not open screenshot", e?.message);
    }
  };

  const handleVerifyProof = async (actionId: string) => {
    setBusy(actionId);
    setNotice(null);
    try {
      const res = await actionsApi.verifyProof(actionId);
      toast.success("Payment settled - vault unlocked", res.message);
      setNotice(`Payment Settled! ${res.message}`);
      r.reload();
    } catch (err: any) {
      toast.error("Verification failed", err?.message);
      setNotice("Verification failed: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(null);
    }
  };

  const pendingProofs = (r.data?.value || []).filter(
    (a) => a.action_type === "VERIFY_PAYMENT_PROOF" && (a.status === "PENDING" || a.status === "PROCESSING")
  );

  return (
    <>
      {shot && (
        <div className="fade-in fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}>
          <div className="pop-in max-h-[90vh] max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Client's payment screenshot <span className="ml-1 font-mono text-xs font-normal text-slate-500">UTR {shot.title}</span></p>
              <button className="btn-secondary h-8 px-3 text-xs" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}>Close</button>
            </div>
            <img src={shot.url} alt="Payment screenshot from client" className="mx-auto max-h-[70vh] rounded-lg border border-slate-200" />
            <p className="mt-3 text-xs text-slate-500">Always match the amount and UTR against your bank statement before confirming. A screenshot alone can be faked.</p>
          </div>
        </div>
      )}
      <PageHeader
        title="Collection Action Engine"
        detail="Scheduled autonomous outreach, dispute escalations, and payment verifications."
        actions={
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {scanning ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Scanning Overdue...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Scan Overdue Invoices</span>
              </>
            )}
          </button>
        }
      />

      {/* Astryx Luminous Pending Payment Proofs Alert */}
      {pendingProofs.length > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-5 text-white shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">
                    {pendingProofs.length} Client Payment Proof{pendingProofs.length > 1 ? "s" : ""} Awaiting Settlement
                  </h4>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                    ACTION REQUIRED
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  Clients have submitted UTR / reference IDs via your public checkout portal. Click &ldquo;1-Click Settle&rdquo; below to mark invoices PAID and automatically unlock deliverable vaults.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <select
          className="input w-full sm:w-56 text-xs font-semibold"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter collection actions by status"
        >
          <option value="">All Action Statuses</option>
          {["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"].map((v) => (
            <option value={v} key={v}>
              {titleCase(v)}
            </option>
          ))}
        </select>
        {notice && (
          <p className={`text-xs font-semibold ${notice.includes("Settled") || notice.includes("complete") ? "text-emerald-600" : "text-rose-600"}`}>
            {notice}
          </p>
        )}
      </div>

      {r.loading ? (
        <TableSkeleton rows={5} />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : !r.data?.value.length ? (
        <EmptyState
          title="No collection actions in queue"
          detail="Scheduled work generated by AI classification and overdue triggers will appear here."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Action Type</th>
                  <th className="table-head">Invoice & Customer</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Scheduled</th>
                  <th className="table-head text-right">Settlement / Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.data.value.map((action) => {
                  const meta = (action.metadata || {}) as Record<string, any>;
                  const isProof = action.action_type === "VERIFY_PAYMENT_PROOF";
                  const canSettle = isProof && (action.status === "PENDING" || action.status === "PROCESSING");

                  return (
                    <tr key={action.id} className={`transition-colors ${canSettle ? "bg-emerald-50/30 hover:bg-emerald-50/50" : "hover:bg-slate-50/70"}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          {isProof ? (
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 shrink-0">
                              <Zap className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {titleCase(action.action_type.replace(/_/g, " "))}
                            </p>
                            {isProof && meta.utr ? (
                              <p className="font-mono text-[11px] font-bold text-emerald-700">
                                UTR: {meta.utr} {meta.amount ? `· ₹${meta.amount}` : ""}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                {action.invoice_id ? "Invoice-level trigger" : "Account-level trigger"}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          {action.invoices?.invoice_number ? (
                            <Link
                              to={`/invoices/${action.invoice_id}`}
                              className="font-mono font-bold text-brand-600 hover:underline text-xs"
                            >
                              {action.invoices.invoice_number}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">—</span>
                          )}
                          {action.customers?.name && (
                            <p className="text-[11px] text-slate-500 font-medium">
                              {action.customers.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge value={action.status} />
                      </td>
                      <td className="table-cell font-mono text-xs text-slate-500">
                        {dateTime(action.scheduled_at)}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isProof && Boolean((action.metadata as Record<string, unknown> | undefined)?.has_screenshot) && (
                            <button onClick={() => viewShot(action)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                              View screenshot
                            </button>
                          )}
                          {canSettle && (
                            <button
                              onClick={() => handleVerifyProof(action.id)}
                              disabled={busy === action.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all hover:scale-105"
                            >
                              {busy === action.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              <span>1-Click Settle</span>
                            </button>
                          )}

                          {(transitions[action.status] || []).length ? (
                            <select
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-soft"
                              disabled={busy === action.id}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) update(action, e.target.value);
                              }}
                            >
                              <option value="">Transition state...</option>
                              {transitions[action.status].map((next) => (
                                <option value={next} key={next}>
                                  Set {titleCase(next)}
                                </option>
                              ))}
                            </select>
                          ) : !canSettle ? (
                            <span className="font-mono text-[11px] text-slate-400">Terminal</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-6 py-3.5 text-xs text-slate-400 font-mono">
            Total {r.data.Count} actions in ledger
          </div>
        </div>
      )}
    </>
  );
}
