import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { invoicesApi, settingsApi } from "../api";
import { useToast } from "../toast";
import type { OrgSettings } from "../types";

/** Switch for automatic overdue reminders. Off by default; needs email sending on and payment details saved. */
export function AutoRemindersCard({ settings, onSaved }: { settings: OrgSettings; onSaved: () => void }) {
  const toast = useToast();
  const [emailOn, setEmailOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const on = Boolean(settings.auto_reminders);
  const paymentReady = Boolean(settings.upi_id || (settings.bank_account_number && settings.bank_ifsc));

  useEffect(() => {
    invoicesApi.emailStatus().then((s) => setEmailOn(s.email_enabled)).catch(() => setEmailOn(false));
  }, []);

  const blocked = emailOn === false ? "Email sending isn't switched on yet, so this can't be turned on." : !paymentReady ? "Add your UPI ID or bank details above first, so clients can pay when they read a reminder." : null;
  const disabled = busy || emailOn === null || (!on && Boolean(blocked));

  const toggle = async () => {
    setBusy(true);
    try {
      await settingsApi.save({ auto_reminders: !on });
      toast.success(!on ? "Automatic reminders are on" : "Automatic reminders are off");
      onSaved();
    } catch (err: any) {
      toast.error("Could not change this", err?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-6 flex flex-wrap items-start gap-4 p-6">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><BellRing className="h-4.5 w-4.5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-slate-900">Automatic reminders</h2>
        <p className="mt-1 max-w-xl text-sm text-slate-600">
          Email your clients automatically 1, 7 and 14 days after an invoice's due date. Each email has the payment link and an unsubscribe link. Replies go to your email.
        </p>
        {!on && blocked && <p className="mt-2 text-xs font-semibold text-amber-700" role="note">{blocked}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Automatic reminders"
        disabled={disabled}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </section>
  );
}
