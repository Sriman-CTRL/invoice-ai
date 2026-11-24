import * as Sentry from "@sentry/node";

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

export { Sentry };
