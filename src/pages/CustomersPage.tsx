import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { customersApi } from "../api";
import { EmptyState, ErrorState, PageHeader, SearchInput, TableSkeleton } from "../components";
import { date } from "../lib";
import type { Customer } from "../types";
import { useResource } from "./shared";

export function CustomersPage() {
  const [query, setQuery] = useState("");
  const r = useResource(() => customersApi.list(), []);

  const customers = useMemo(
    () =>
      (r.data || []).filter((c) =>
        `${c.name} ${c.company_name || ""} ${c.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [r.data, query],
  );

  return (
    <>
      <PageHeader
        title="Customer Directory"
        detail="All accounts linked to your invoice and receivables ledger."
        actions={
          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search customers or company..."
            />
          </div>
        }
      />

      {r.loading ? (
        <TableSkeleton rows={6} />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers found"
          detail="There are no accounts matching your search."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Customer</th>
                  <th className="table-head">Company</th>
                  <th className="table-head">Contact Email</th>
                  <th className="table-head text-right">Created</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="table-cell">
                      <Link
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-3 font-bold text-slate-900 group-hover:text-brand-600"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>{c.name}</span>
                      </Link>
                    </td>
                    <td className="table-cell font-medium text-slate-600">
                      {c.company_name || "—"}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {c.email}
                    </td>
                    <td className="table-cell text-right font-mono text-xs text-slate-400">
                      {date(c.created_at)}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        to={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-600"
                      >
                        <span>View</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
