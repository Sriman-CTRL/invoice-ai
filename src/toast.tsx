import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; title: string; detail?: string }
interface ToastApi {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const tone: Record<ToastKind, { ring: string; icon: React.ReactNode }> = {
  success: { ring: "border-emerald-400/40", icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
  error: { ring: "border-rose-400/40", icon: <AlertCircle className="h-5 w-5 text-rose-500" /> },
  info: { ring: "border-indigo-400/40", icon: <Info className="h-5 w-5 text-indigo-400" /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = ++seq.current;
    setItems((cur) => [...cur.slice(-3), { id, kind, title, detail }]);
    window.setTimeout(() => dismiss(id), kind === "error" ? 6500 : 4000);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (t, d) => push("success", t, d),
    error: (t, d) => push("error", t, d),
    info: (t, d) => push("info", t, d),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border ${tone[t.kind].ring} bg-midnight-950/95 p-3.5 text-white shadow-2xl backdrop-blur-md`}
          >
            <div className="mt-0.5 shrink-0">{tone[t.kind].icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{t.title}</p>
              {t.detail && <p className="mt-0.5 break-words text-xs text-slate-300">{t.detail}</p>}
            </div>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="shrink-0 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
