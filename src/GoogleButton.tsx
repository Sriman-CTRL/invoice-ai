import { useEffect, useRef } from "react";

/**
 * "Sign in with Google" button (Google Identity Services). Renders nothing unless VITE_GOOGLE_CLIENT_ID is set, so the
 * app behaves exactly as before until a key exists. The script is loaded only on pages that show the button.
 */
export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || "";

interface GisId {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
}
declare global {
  interface Window { google?: { accounts?: { id?: GisId } } }
}

const SRC = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Google sign-in could not be loaded.")); };
    document.head.appendChild(s);
  });
  return loading;
}

export function GoogleButton({ onCredential, text = "continue_with" }: { onCredential: (idToken: string) => void; text?: "signin_with" | "signup_with" | "continue_with" }) {
  const box = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        const gis = window.google?.accounts?.id;
        if (cancelled || !gis || !box.current) return;
        gis.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => { if (r.credential) handler.current(r.credential); } });
        gis.renderButton(box.current, { theme: "filled_black", size: "large", text, shape: "rectangular", width: 300 });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [text]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={box} className="flex min-h-[44px] justify-center" aria-label="Sign in with Google" />;
}
