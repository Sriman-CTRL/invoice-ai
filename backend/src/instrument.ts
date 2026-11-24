/**
 * Error reporting setup. Must be the FIRST import of the server entry (server.ts) so it also runs first in the
 * api/index.js bundle. Does nothing unless SENTRY_DSN is set. Errors only: no tracing, no personal data.
 * Everything that leaves the server goes through lib/sentryScrub.ts.
 */
import "dotenv/config";
import * as Sentry from "@sentry/node";
import { scrubBreadcrumb, scrubEvent } from "./lib/sentryScrub";

const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { allow: ["user-agent"] },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
};

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    // Sentry 11 replaced `sendDefaultPii` with `dataCollection`; this is the strict equivalent of
    // sendDefaultPii: false, plus no request bodies, cookies or query strings. Only the user-agent header is kept.
    dataCollection: DATA_COLLECTION,
    tracesSampleRate: 0,
    // Do not add sentry-trace/baggage headers to calls to Resend, Gemini and other services.
    tracePropagationTargets: [],
    maxBreadcrumbs: 30,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
}
