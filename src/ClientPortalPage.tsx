import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";
import { publicApi } from "./api";
import { date, money } from "./lib";
import { PaivoLogo } from "./Brand";

type Data = Awaited<ReturnType<typeof publicApi.clientPortal>>;

export function ClientPortalPage() {
  const { customerId = "", token = "" } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { publicApi.clientPortal(customerId, token).then(setData).catch((e) => setError(e?.message || "This link isn't valid.")); }, [customerId, token]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-lg font-bold text-white">Link not available</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="grid min-h-screen place-items-center bg-slate-950"><RefreshCw className="h-7 w-7 animate-spin text-slate-500" /></div>;

  const brand = data.organization.brand_color || "#4f46e5";
  const open = data.invoices.filter((i) => i.status !== "PAID");
  const paid = data.invoices.filter((i) => i.status === "PAID");
  const currency = data.invoices[0]?.currency || "INR";

  const Row = ({ inv }: { inv: Data["invoices"][number] }) => {
    const overdue = inv.status !== "PAID" && inv.due_at && new Date(inv.due_at) < new Date();
    return (
      <Link to={`/pay/${inv.id}`} className="group flex items-center gap-4 border-b border-white/5 px-5 py-4 transition last:border-0 hover:bg-white/[0.04]">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-bold text-white">{inv.invoice_number}</p>
          <p className="mt-0.5 text-xs text-slate-400">Issued {date(inv.issued_at)} · Due {date(inv.due_at)}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-white">{money(inv.status === "PAID" ? inv.amount : inv.outstanding, inv.currency)}</p>
          <p className={`mt-0.5 text-[11px] font-semibold ${inv.status === "PAID" ? "text-emerald-400" : overdue ? "text-rose-400" : "text-amber-300"}`}>
            {inv.status === "PAID" ? "Paid" : overdue ? "Overdue" : "Due"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="h-1 w-full" style={{ background: brand }} />
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          {data.organization.logo_data ? (
            <img src={data.organization.logo_data} alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white" style={{ background: brand }}>{data.organization.name[0]?.toUpperCase()}</span>
          )}
          <div>
            <p className="text-sm font-extrabold tracking-tight text-white">{data.organization.name}</p>
            <p className="font-mono text-[10px] text-slate-400">Client portal</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-slate-400">Hello {data.customer.name},</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Your invoices from {data.organization.name}</h1>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          {data.outstanding_total > 0 ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total due</p>
              <p className="mt-1 font-mono text-3xl font-black text-white">{money(data.outstanding_total, currency)}</p>
              <p className="mt-1 text-xs text-slate-400">{open.length} open invoice{open.length === 1 ? "" : "s"}. Choose one below to pay.</p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></span>
              <div><p className="font-bold text-white">You're all paid up</p><p className="text-xs text-slate-400">Nothing is due right now. Thank you.</p></div>
            </div>
          )}
        </div>

        {open.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Open</h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">{open.map((i) => <Row key={i.id} inv={i} />)}</div>
          </section>
        )}
        {paid.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid</h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">{paid.map((i) => <Row key={i.id} inv={i} />)}</div>
          </section>
        )}
        <p className="mt-10 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[11px] text-slate-600">
          <span>Powered by</span>
          <Link to="/" aria-label="Paivo" className="inline-flex text-slate-400 hover:text-slate-200"><PaivoLogo height={14} /></Link>
          <span>· Payments go straight to {data.organization.name}.</span>
        </p>
      </main>
    </div>
  );
}
