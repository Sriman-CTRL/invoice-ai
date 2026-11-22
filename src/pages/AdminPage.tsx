import { useState } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { adminApi } from "../api";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "../components";
import { dateTime } from "../lib";
import { useToast } from "../toast";
import { useResource } from "./shared";

export function AdminPage() {
  const r = useResource(() => adminApi.planRequests(), []);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    try {
      await adminApi.decide(id, decision);
      toast.success(decision === "approve" ? "Plan activated" : "Request rejected");
      r.reload();
    } catch (e: any) {
      toast.error("Action failed", e?.message);
    } finally {
      setBusy(null);
    }
  };

  const header = <PageHeader title="Plan payments" detail="Verify the UTR in your bank app, then activate the plan." />;
  if (r.loading) return <>{header}<TableSkeleton rows={4} /></>;
  if (r.error || !r.data) {
    return (
      <>
        {header}
        <ErrorState message={r.error || "Could not load requests."} retry={r.reload} />
      </>
    );
  }
  if (!r.data.length) return <>{header}<EmptyState title="No plan payments yet" detail="When a customer pays for Pro or Agency and submits their UTR, it appears here." /></>;

  return (
    <>
      {header}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {["Submitted", "Business", "Plan", "UTR", "Status", ""].map((h) => <th key={h} className="table-head">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.data.map((q) => (
              <tr key={q.id}>
                <td className="table-cell whitespace-nowrap">{dateTime(q.created_at)}</td>
                <td className="table-cell">
                  <p className="font-semibold text-slate-900">{q.organization_name}</p>
                  <p className="text-xs text-slate-400">{q.owner_email}</p>
                </td>
                <td className="table-cell font-semibold">{q.plan} <span className="text-xs font-normal text-slate-400">(now {q.current_plan})</span></td>
                <td className="table-cell font-mono text-xs">{q.utr}</td>
                <td className="table-cell">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${q.status === "PENDING" ? "bg-amber-100 text-amber-800" : q.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{q.status}</span>
                </td>
                <td className="table-cell">
                  {q.status === "PENDING" && (
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary h-8 px-3 text-xs" disabled={busy === q.id} onClick={() => decide(q.id, "reject")}><X className="h-3.5 w-3.5" /> Reject</button>
                      <button className="btn-primary h-8 px-3 text-xs" disabled={busy === q.id} onClick={() => decide(q.id, "approve")}><Check className="h-3.5 w-3.5" /> Activate</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><ShieldAlert className="h-3.5 w-3.5" /> Only activate after the money is visible in your bank statement.</p>
    </>
  );
}
