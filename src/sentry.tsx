import * as Sentry from "@sentry/react";
import { scrubBreadcrumb, scrubEvent } from "./lib/sentryScrub";

/**
 * Error reporting. Does nothing unless VITE_SENTRY_DSN is set. Errors only: no tracing, no session replay,
 * no personal data. Everything is cleaned by lib/sentryScrub.ts before it leaves the browser.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Sentry 11 replaced `sendDefaultPii` with `dataCollection`; this is the strict equivalent of
    // sendDefaultPii: false, plus no cookies, bodies or query strings. Only the user-agent header is kept.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: { allow: ["user-agent"] }, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    // Errors from browser extensions are not ours and often carry the user's page content.
    denyUrls: [/^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:\/\//i, /extensions\//i],
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
}

export function ErrorFallback() {
  return (
    <div role="alert" style={{ minHeight: "100vh", background: "#070a13", display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "#cbd5e1", fontFamily: "system-ui, sans-serif" }}>
      <div>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 }}>Something went wrong. Please refresh.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "#4f46e5", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <Sentry.ErrorBoundary fallback={<ErrorFallback />}>{children}</Sentry.ErrorBoundary>;
}
