import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

// End-to-end tests run against the LOCAL stack only (backend :5000 + Vite :5173) and a local database.
// `npm run e2e` starts both servers if they are not already running. Not part of CI.
const env = (() => { try { return readFileSync("backend/.env", "utf8"); } catch { return ""; } })();
const dbUrl = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)/m.exec(env)?.[1] ?? process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
  throw new Error("Refusing to run e2e: DATABASE_URL in backend/.env is not a local database.");
}

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: [
    { command: "npm run dev", cwd: "backend", url: "http://localhost:5000/health", reuseExistingServer: true, timeout: 120_000, env: { AUTH_RATE_LIMIT_MAX: "1000" } },
    { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: true, timeout: 120_000 },
  ],
});
