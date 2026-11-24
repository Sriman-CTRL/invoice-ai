import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source maps are uploaded to Sentry only when SENTRY_AUTH_TOKEN is set at build time (and SENTRY_ORG).
// They are deleted from dist/ right after upload, so they are never served to the public.
const uploadMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG);

export default defineConfig({
  plugins: [
    react(),
    ...(uploadMaps
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT_WEB || "paivo-web",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            telemetry: false,
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ],
  // "hidden" writes .map files without a sourceMappingURL comment; only needed for the upload above.
  build: { sourcemap: uploadMaps ? "hidden" : false },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_TARGET || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
