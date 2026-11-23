import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, Eye, FileCheck2 } from "lucide-react";
import { invoicesApi } from "./api";
import { money } from "./lib";
import type { ActivityEvent } from "./types";

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

const SEEN_KEY = "paivo_activity_seen";
const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY) || 0); } catch { return 0; } };
const writeSeen = (t: number) => { try { localStorage.setItem(SEEN_KEY, String(t)); } catch { /* storage unavailable */ } };

function Line({ e }: { e: ActivityEvent }) {
  const meta =
    e.type === "viewed"
      ? { icon: Eye, tone: "bg-sky-50 text-sky-600", text: <><b>{e.customer_name}</b> opened invoice {e.invoice_number}</> }
      : e.type === "paid"
        ? { icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", text: <><b>{e.customer_name}</b> paid {e.amount ? money(e.amount, e.currency) : ""} on {e.invoice_number}</> }
        : { icon: FileCheck2, tone: "bg-amber-50 text-amber-600", text: <><b>{e.customer_name}</b> sent a payment reference for {e.invoice_number}. Check your bank, then press 1-Click Settle in the Action Queue.</> };
  const Icon = meta.icon;
  return (
    <Link to={e.type === "proof" ? "/collection-actions" : `/invoices/${e.invoice_id}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${meta.tone}`}><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 text-xs leading-relaxed text-slate-600">
        {meta.text}
        <span className="block text-[11px] text-slate-400">{timeAgo(e.at)}</span>
      </span>
    </Link>
  );
}

/** Bell in the top bar: what clients did recently. Polls once a minute and remembers what you've seen. */
export function ActivityBell() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen());
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => { invoicesApi.activity().then((r) => setEvents(r.events)).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = events.filter((e) => new Date(e.at).getTime() > seen).length;
  const toggle = () => {
    setOpen((o) => !o);
    if (!open && events[0]) { const t = new Date(events[0].at).getTime(); writeSeen(t); setSeen(t); }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-800" aria-label="Client activity">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Client activity</div>
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {events.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-slate-400">Nothing yet. When a client opens an invoice or pays, you'll see it here.</p>
            ) : events.slice(0, 15).map((e, i) => <Line key={i} e={e} />)}
          </div>
        </div>
      )}
    </div>
  );
}
