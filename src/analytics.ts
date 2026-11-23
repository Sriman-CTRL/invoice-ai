/**
 * Privacy-friendly page-view counter. No cookies, no IP/user-agent stored, nothing personal.
 * The visitor id is random, lives only in this tab's sessionStorage, and is never linked to an account.
 * Respects Do Not Track / Global Privacy Control.
 */
const KEY = "ll_session";

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

let lastPath = "";
export function trackPageView(path: string): void {
  if (optedOut() || path === lastPath) return;
  lastPath = path;
  const visitor = sessionId();
  if (!visitor) return;
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "pageview", path, referrer: document.referrer || undefined, visitor }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics must never break the page */
  }
}
