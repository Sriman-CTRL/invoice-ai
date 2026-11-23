import { useEffect, useState } from "react";
import { ApiError } from "../api";
import { Badge, ErrorState, TableSkeleton } from "../components";
import { dateTime, titleCase } from "../lib";
import type { CollectionAction } from "../types";

export function useResource<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    setError(null);
    load()
      .then(setData)
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, deps);
  return { data, error, loading, reload };
}

export function DetailLoad<T>({
  resource,
  children,
}: {
  resource: ReturnType<typeof useResource<T>>;
  children: (data: T) => React.ReactNode;
}) {
  if (resource.loading) return <TableSkeleton rows={7} />;
  if (resource.error || !resource.data)
    return (
      <ErrorState
        message={resource.error || "This record could not be loaded."}
        retry={resource.reload}
      />
    );
  return <>{children(resource.data)}</>;
}

export function ActionsTable({ actions }: { actions: CollectionAction[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="font-bold text-slate-900">Collection Actions</h3>
      </div>
      {actions.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70 border-b border-slate-100">
              <tr>
                <th className="table-head">Action Type</th>
                <th className="table-head">Status</th>
                <th className="table-head">Scheduled</th>
                <th className="table-head text-right">Executed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="table-cell font-semibold text-slate-800">
                    {titleCase(a.action_type.replace(/_/g, " "))}
                  </td>
                  <td className="table-cell">
                    <Badge value={a.status} />
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-500">
                    {dateTime(a.scheduled_at)}
                  </td>
                  <td className="table-cell text-right font-mono text-xs text-slate-500">
                    {dateTime(a.executed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-6 py-8 text-center text-xs text-slate-400">
          No follow-up tasks yet.
        </p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS PAGE
// ─────────────────────────────────────────────────────────────────────────────
