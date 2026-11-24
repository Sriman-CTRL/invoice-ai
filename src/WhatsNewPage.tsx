import { CHANGELOG } from "./changelog";
import { MarketingShell } from "./marketing";

const fmt = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export function WhatsNewPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:pt-16">
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">What's new</h1>
        <p className="mt-3 text-slate-400">Changes you can see and use, newest first.</p>
        <ol className="mt-10 space-y-8">
          {CHANGELOG.map((entry) => (
            <li key={entry.date} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <time dateTime={entry.date} className="text-xs font-bold uppercase tracking-wider text-indigo-300">{fmt(entry.date)}</time>
              <h2 className="mt-1 text-xl font-bold text-white">{entry.title}</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300">
                {entry.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </MarketingShell>
  );
}
