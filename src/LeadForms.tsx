import { useState } from "react";
import { Check, MessageSquareHeart, X } from "lucide-react";
import { leadsApi } from "./api";

type Variant = "dark" | "light";

const field: Record<Variant, string> = {
  dark: "h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none",
  light: "input",
};

/** Waitlist sign-up (email) or feedback (message). Includes a hidden honeypot field against bots. */
export function LeadForm({
  kind, plan, defaultEmail = "", variant = "light", cta, onDone,
}: { kind: "waitlist" | "feedback"; plan?: string; defaultEmail?: string; variant?: Variant; cta?: string; onDone?: () => void }) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await leadsApi.submit({ kind, plan, email: email.trim() || undefined, message: message.trim() || undefined, website });
      setDone(r.message);
      onDone?.();
    } catch (err: any) {
      setError(err?.message || "Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold ${variant === "dark" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role="status">
        <Check className="mt-0.5 h-4 w-4 shrink-0" /> {done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* honeypot: hidden from people, tempting to bots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {kind === "feedback" && (
        <textarea
          className={`${variant === "dark" ? "w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-slate-500" : "input h-auto py-2.5"} min-h-[110px] resize-none`}
          placeholder="What's confusing, missing, or annoying? Be as blunt as you like."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          required
        />
      )}
      <input
        className={field[variant]}
        type="email"
        placeholder={kind === "feedback" ? "Your email (optional, if you'd like a reply)" : "you@company.com"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required={kind === "waitlist"}
        autoComplete="email"
      />
      {error && <p className={`text-xs font-semibold ${variant === "dark" ? "text-rose-300" : "text-rose-600"}`} role="alert">{error}</p>}
      <button disabled={busy} className={variant === "dark" ? "h-11 w-full rounded-xl bg-indigo-500 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-60" : "btn-primary w-full"}>
        {busy ? "Sending…" : cta || (kind === "waitlist" ? "Join the waitlist" : "Send feedback")}
      </button>
    </form>
  );
}

export function LeadDialog({
  open, onClose, kind, plan, defaultEmail, title, intro,
}: { open: boolean; onClose: () => void; kind: "waitlist" | "feedback"; plan?: string; defaultEmail?: string; title?: string; intro?: string }) {
  if (!open) return null;
  return (
    <div className="fade-in fixed inset-0 z-[85] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in panel w-full max-w-md p-6" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><MessageSquareHeart className="h-4.5 w-4.5" /></span>
            <h3 className="text-lg font-extrabold text-slate-900">{title || (kind === "waitlist" ? "Join the waitlist" : "Share feedback")}</h3>
          </div>
          <button aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        {intro && <p className="mt-3 text-sm leading-relaxed text-slate-500">{intro}</p>}
        <div className="mt-4"><LeadForm kind={kind} plan={plan} defaultEmail={defaultEmail} /></div>
      </div>
    </div>
  );
}
