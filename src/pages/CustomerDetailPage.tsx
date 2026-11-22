import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, FileText, Phone, ShieldCheck } from "lucide-react";
import { customersApi } from "../api";
import { Badge, PageHeader } from "../components";
import { date, money, titleCase } from "../lib";
import type { CustomerDetail, Invoice } from "../types";
import { useResource, DetailLoad, ActionsTable } from "./shared";

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const r = useResource(() => customersApi.detail(id), [id]);
  const [erasureBusy, setErasureBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);

  const handleExport = async (customerId: string) => {
    setExportBusy(true);
    try {
      const exportData = await customersApi.export(customerId);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-export-${customerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export customer data.");
    } finally {
      setExportBusy(false);
    }
  };

  const handleErasure = async (customerId: string) => {
    if (
      !confirm(
        "Are you sure you want to process the Right to Erasure (GDPR Art. 17 / DPDP)? Personal data will be anonymized, future communications permanently suppressed, and statutory tax records retained under 7-year legal hold."
      )
    ) {
      return;
    }
    setErasureBusy(true);
    try {
      const res = await customersApi.erasure(customerId);
      setComplianceNotice(res.legal_notice);
      r.reload();
    } catch (e: any) {
      alert(e?.message || "Failed to process erasure.");
    } finally {
      setErasureBusy(false);
    }
  };

  return (
    <DetailLoad resource={r}>
      {(data: CustomerDetail) => (
        <>
          <PageHeader
            title={data.customer.name}
            detail={data.customer.company_name || data.customer.email}
            back="/customers"
          />

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              {/* Financial KPI */}
              <section className="panel p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Outstanding Balance
                </p>
                <p className="mt-2 font-mono text-3xl font-black text-slate-900 sm:text-4xl tabular-nums">
                  {money(data.summary.total_outstanding)}
                </p>

                <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-5">
                  <div className="pr-4">
                    <p className="text-xs font-medium text-slate-400">Total Invoiced</p>
                    <p className="mt-1 font-mono text-lg font-bold text-slate-800">
                      {money(data.summary.total_invoiced)}
                    </p>
                  </div>
                  <div className="px-4">
                    <p className="text-xs font-medium text-slate-400">Total Paid</p>
                    <p className="mt-1 font-mono text-lg font-bold text-emerald-600">
                      {money(data.summary.total_paid)}
                    </p>
                  </div>
                  <div className="pl-4">
                    <p className="text-xs font-medium text-slate-400">Overdue Risk</p>
                    <p className="mt-1 font-mono text-lg font-bold text-rose-600">
                      {money(data.summary.overdue_amount)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Invoices List */}
              <section className="panel overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="font-bold text-slate-900">Invoices</h3>
                </div>
                {data.invoices.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50/70 border-b border-slate-100">
                        <tr>
                          <th className="table-head">Invoice</th>
                          <th className="table-head">Due Date</th>
                          <th className="table-head text-right">Amount</th>
                          <th className="table-head text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="table-cell">
                              <Link
                                to={`/invoices/${inv.id}`}
                                className="font-mono font-bold text-brand-600 hover:underline"
                              >
                                {inv.invoice_number}
                              </Link>
                            </td>
                            <td className="table-cell font-mono text-xs text-slate-500">
                              {date(inv.due_at)}
                            </td>
                            <td className="table-cell text-right font-mono font-bold text-slate-900">
                              {money(inv.amount, inv.currency)}
                            </td>
                            <td className="table-cell text-center">
                              <Badge value={inv.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-6 py-8 text-center text-xs text-slate-400">
                    No invoices on record for this customer.
                  </p>
                )}
              </section>

              <ActionsTable actions={data.collection_actions} />
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              <section className="panel p-6">
                <h3 className="font-bold text-slate-900 mb-4">Contact Profile</h3>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Email Address
                    </span>
                    <span className="mt-1 block font-mono font-medium text-slate-800">
                      {data.customer.email}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Phone
                    </span>
                    <span className="mt-1 block font-mono font-medium text-slate-800">
                      {data.customer.phone || "Not recorded"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="panel p-6">
                <h3 className="font-bold text-slate-900 mb-3">Conversations</h3>
                {data.conversations.length ? (
                  <div className="space-y-2">
                    {data.conversations.map((c) => (
                      <Link
                        key={c.id}
                        to={`/conversations/${c.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs transition-colors hover:bg-slate-50"
                      >
                        <span className="font-semibold text-slate-700">
                          {titleCase(c.channel)} Thread
                        </span>
                        <Badge value={c.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No conversations recorded yet.</p>
                )}
              </section>

              {/* Data Privacy & Statutory Rights */}
              <section className="panel p-6 border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Data Privacy & Compliance</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Exercise statutory rights under GDPR (EU) and India DPDP Act 2023.
                </p>

                {complianceNotice && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    {complianceNotice}
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    onClick={() => handleExport(data.customer.id)}
                    disabled={exportBusy}
                    className="btn-secondary w-full justify-center text-xs h-9"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    {exportBusy ? "Generating JSON..." : "Download Data Export (JSON)"}
                  </button>

                  <button
                    onClick={() => handleErasure(data.customer.id)}
                    disabled={erasureBusy || (data.customer as any).processing_restricted}
                    className="btn w-full justify-center text-xs h-9 border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100/70 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
                    {(data.customer as any).processing_restricted
                      ? "Processing Restricted (Legal Hold)"
                      : erasureBusy
                      ? "Processing Erasure..."
                      : "Process Right to Erasure"}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </DetailLoad>
  );
}
