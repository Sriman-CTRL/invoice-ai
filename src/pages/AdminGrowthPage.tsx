import { useState } from "react";
import { Eye, Rocket, UserPlus, Users } from "lucide-react";
import { adminApi } from "../api";
import { ErrorState, PageHeader, TableSkeleton } from "../components";
import { useResource } from "./shared";

function Stat({ label, value, icon: Icon, hint }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; hint?: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function AdminGrowthPage() {
  const [days, setDays] = useState(30);
  const r = useResource(() => adminApi.analytics(days), [days]);
  const header = (
    <PageHeader
      title="Growth"
      detail="Visits, sign-ups and activation. Page views are counted without cookies or personal data."
      actions={
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 ${days === d ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-900"}`}>{d}d</button>
          ))}
        </div>
      }
    />
  );
  if (r.loading) return <>{header}<TableSkeleton rows={5} /></>;
  if (r.error || !r.data) return <>{header}<ErrorState message={r.error || "Could not load analytics."} retry={r.reload} /></>;

  const d = r.data;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "-");
  const steps: Array<[string, number]> = [
    ["Visited home page", d.funnel.landing],
    ["Viewed pricing", d.funnel.pricing],
    ["Opened sign-up page", d.funnel.register_page],
    ["Created an account", d.funnel.signups],
    ["Created a first invoice", d.funnel.activated],
  ];
  const top = Math.max(1, ...steps.map((s) => s[1]));
  const maxViews = Math.max(1, ...d.daily.map((x) => x.views));
  const totalViews = d.daily.reduce((a, x) => a + x.views, 0);

  return (
    <>
      {header}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Page views" value={totalViews} icon={Eye} hint={`last ${days} days`} />
        <Stat label="New accounts" value={d.funnel.signups} icon={UserPlus} hint={d.funnel.landing > 0 ? `${d.funnel.signups} vs ${d.funnel.landing} home-page visitors` : "since the start of this period"} />
        <Stat label="Activated" value={d.funnel.activated} icon={Rocket} hint={`${pct(d.funnel.activated, d.funnel.signups)} of new accounts made an invoice`} />
        <Stat label="Paying businesses" value={d.totals.paid_organizations} icon={Users} hint={`${d.totals.organizations} total · ${d.totals.pending_upgrades} upgrade request(s) waiting`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-6">
          <h2 className="text-base font-bold text-slate-900">Visitors → customers</h2>
          <div className="mt-5 space-y-3">
            {steps.map(([label, n], i) => (
              <div key={label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-700">{label}</span>
                  <span className="font-mono text-slate-500">{n}{[1, 2, 4].includes(i) && steps[i - 1][1] > 0 && <span className="ml-2 text-xs text-slate-400">({pct(n, steps[i - 1][1])} of previous)</span>}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500" style={{ width: `${(n / top) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">The first three steps count unique browser sessions; the last two come straight from your database.</p>
        </section>

        <section className="panel p-6">
          <h2 className="text-base font-bold text-slate-900">Where visitors come from</h2>
          {d.referrers.length ? (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {d.referrers.map((x) => (
                <li key={x.referrer} className="flex justify-between py-2"><span className="truncate text-slate-700">{x.referrer}</span><span className="font-mono text-slate-500">{x.visits}</span></li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-slate-400">No referrers yet. Share your link on LinkedIn, Reddit or WhatsApp and they'll appear here.</p>}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-base font-bold text-slate-900">Views per day</h2>
          {d.daily.length ? (
            <div className="mt-5 flex h-36 items-end gap-1" role="img" aria-label="Page views per day">
              {d.daily.map((x) => (
                <div key={x.day} className="group flex h-full flex-1 flex-col justify-end" title={`${x.day}: ${x.views} views, ${x.visitors} visitors`}>
                  <div className="rounded-t bg-brand-500/80 transition-colors group-hover:bg-brand-600" style={{ height: `${Math.max(4, (x.views / maxViews) * 100)}%` }} />
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-slate-400">No visits recorded yet. Counting started when this feature went live.</p>}
        </section>
        <section className="panel p-6">
          <h2 className="text-base font-bold text-slate-900">Most viewed pages</h2>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {d.pages.map((p) => (
              <li key={p.path} className="flex justify-between py-2"><span className="font-mono text-xs text-slate-700">{p.path}</span><span className="font-mono text-slate-500">{p.views}</span></li>
            ))}
            {!d.pages.length && <li className="py-2 text-slate-400">Nothing yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
