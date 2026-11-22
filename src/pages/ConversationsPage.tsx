import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Mail, Search } from "lucide-react";
import { conversationsApi } from "../api";
import { Badge, EmptyState, ErrorState, PageHeader, SearchInput, TableSkeleton } from "../components";
import { dateTime, titleCase } from "../lib";
import type { Customer } from "../types";
import { useResource } from "./shared";

export function ConversationsPage() {
  const [query, setQuery] = useState("");
  const r = useResource(() => conversationsApi.list(), []);

  const conversations = useMemo(
    () =>
      (r.data || []).filter((c) =>
        `${c.channel} ${c.status}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [r.data, query],
  );

  return (
    <>
      <PageHeader
        title="Customer Inbox"
        detail="AI-classified customer email replies and automated negotiation threads."
        actions={
          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by channel or status..."
            />
          </div>
        }
      />

      {r.loading ? (
        <TableSkeleton rows={5} />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          detail="Inbound customer replies captured via Gmail or the API will show up here."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Thread ID</th>
                  <th className="table-head">Channel</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Last Updated</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversations.map((c) => (
                  <tr
                    key={c.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="table-cell">
                      <Link
                        to={`/conversations/${c.id}`}
                        className="font-mono text-xs font-bold text-brand-600 hover:underline"
                      >
                        {c.id.slice(0, 12)}...
                      </Link>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-slate-800">
                          {titleCase(c.channel)}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge value={c.status} />
                    </td>
                    <td className="table-cell text-right font-mono text-xs text-slate-500">
                      {dateTime(c.updated_at)}
                    </td>
                    <td className="table-cell text-right">
                      <Link
                        to={`/conversations/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                      >
                        <span>Open Thread</span>
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
