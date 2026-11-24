import * as Sentry from "@sentry/node";
import type { Response } from "express";

/** Report a failed background job (cron) with a `job` tag, and wait briefly so a frozen serverless function still sends it. */
export async function captureJobFailure(job: string, error: unknown): Promise<void> {
  try {
    Sentry.withScope((scope) => {
      scope.setTag("job", job);
      Sentry.captureException(error);
    });
    await Sentry.flush(2000);
  } catch {
    // Reporting must never break the job's own error handling.
  }
}

/** Send buffered events before the response goes out (Vercel can freeze the function right after it). */
export async function flushErrors(): Promise<void> {
  try {
    await Sentry.flush(2000);
  } catch {
    // ignore
  }
}

/** One place that talks to Sentry for handled errors (tests replace `capture`). */
export const reporter = { capture: (err: unknown): void => void Sentry.captureException(err) };

/**
 * For a route's own catch block: report the error to Sentry (scrubbed by beforeSend), give Sentry a moment to send it,
 * then answer 500 with the route's own public message. Nothing from `err` goes into the response.
 * Only use this for real server faults; expected user errors (4xx) must not be reported.
 */
export async function serverError(res: Response, err: unknown, publicMessage = "Internal server error"): Promise<void> {
  reporter.capture(err);
  await flushErrors();
  res.status(500).json({ error: publicMessage });
}

export { Sentry };
