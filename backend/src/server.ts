import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import prisma, { systemContext } from "./lib/prisma";
import customerRoutes from "./routes/customer.routes";
import organizationRoutes from "./routes/organization.routes";
import invoiceRoutes from "./routes/invoice.routes";
import paymentRoutes from "./routes/payment.routes";
import messageRoutes from "./routes/message.routes";
import conversationRoutes from "./routes/conversation.routes";
import collectionActionRoutes from "./routes/collection-action.routes";
import overdueInvoicesRoutes from "./routes/overdue-invoices.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import authRoutes from "./routes/auth.routes";
import inboundRoutes from "./routes/inbound.routes";
import complianceRoutes from "./routes/compliance.routes";
import creditNoteRoutes from "./routes/credit-note.routes";
import publicInvoiceRoutes from "./routes/public-invoice.routes";
import adminRoutes from "./routes/admin.routes";
import eventsRoutes from "./routes/events.routes";
import leadsRoutes from "./routes/leads.routes";
import unsubscribeRoutes from "./routes/unsubscribe.routes";
import clientPortalRoutes from "./routes/client-portal.routes";
import { recurringRouter, cronRouter } from "./routes/recurring.routes";
import { authMiddleware } from "./middleware/auth.middleware";
import { rateLimit } from "./middleware/rateLimit";

const app = express();

// Trust reverse proxy (Cloudflare/Nginx/Docker) so req.ip and rate-limits are accurate
app.set("trust proxy", 1);

app.disable("x-powered-by");

// LAYER 2: Comprehensive Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    dnsPrefetchControl: { allow: false },
  }),
);

// Explicit permissions policy header (disable camera, mic, geolocation)
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});

// LAYER 2: Production-grade CORS
// In production, never reflect origin: true with credentials: true.
const rawCorsOrigin = process.env.CORS_ORIGIN || "https://invoice-ai-nine-beta.vercel.app,http://localhost:5173";
// Our own site addresses are always trusted, on top of anything set in CORS_ORIGIN.
const allowedOrigins = [...rawCorsOrigin.split(",").map((o) => o.trim()).filter(Boolean), "https://paivo.in", "https://www.paivo.in"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, n8n)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/invoice-[a-z0-9-]+-sriman-ctrls-projects\.vercel\.app$/.test(origin) ||
        (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-inbound-key", "Accept"],
    maxAge: 86400, // Preflight cache 24h
  }),
);

app.use(express.json({ limit: "1mb" }));

// LAYER 5: Multi-Tier Rate Limiting
// 1. Auth routes (login/register) - brute force defense
app.use("/api/auth", systemContext, rateLimit({ windowMs: 60_000, max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20), message: "Too many authentication attempts. Please wait 1 minute." }), authRoutes);

// Privacy-friendly first-party analytics (page views only, no cookies/IPs stored)
app.use("/api/events", systemContext, rateLimit({ windowMs: 60_000, max: 120, message: "Too many events." }), eventsRoutes);

// Public waitlist + feedback (strict rate limit; honeypot inside the route)
app.use("/api/unsubscribe", systemContext, rateLimit({ windowMs: 60_000, max: 30, message: "Too many requests." }), unsubscribeRoutes);
app.use("/api/cron", systemContext, cronRouter);
app.use("/api/recurring", authMiddleware, recurringRouter);
app.use("/api/leads", systemContext, rateLimit({ windowMs: 60_000, max: 8, message: "Too many submissions. Please try again in a minute." }), leadsRoutes);

// 2. Inbound webhook endpoint
app.use("/api/inbound", systemContext, inboundRoutes);

// Public customer invoice payment portal (no auth required)
app.use(
  "/api/public/invoices",
  systemContext,
  rateLimit({ windowMs: 60_000, max: 60, message: "Too many requests. Please wait a moment." }),
  publicInvoiceRoutes,
);

app.use("/api/public/client", systemContext, rateLimit({ windowMs: 60_000, max: 60, message: "Too many requests. Please wait a moment." }), clientPortalRoutes);

// 3. Authenticated routes with fine-grained rate limits
app.use("/api/invoices", authMiddleware, invoiceRoutes);

// Rate-limit payment creation to prevent transaction spamming (30/min per tenant)
app.use(
  "/api/payments",
  authMiddleware,
  rateLimit({
    windowMs: 60_000,
    max: 30,
    keyFn: (req) => `${req.user?.organization_id || req.ip}_payments`,
    message: "Payment transaction rate limit exceeded. Please wait a moment.",
  }),
  paymentRoutes,
);

app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/organizations", authMiddleware, organizationRoutes);
app.use("/api/admin", authMiddleware, systemContext, adminRoutes);

// Reprocess & ingest rate limits on messages
app.use(
  "/api/messages",
  authMiddleware,
  rateLimit({
    windowMs: 60_000,
    max: 60,
    keyFn: (req) => `${req.user?.organization_id || req.ip}_messages`,
  }),
  messageRoutes,
);

app.use("/api/conversations", authMiddleware, conversationRoutes);
app.use("/api/collection-actions", authMiddleware, collectionActionRoutes);

// Rate-limit heavy background scan queries (5 per minute per tenant)
app.use(
  "/api/overdue-invoices",
  authMiddleware,
  rateLimit({
    windowMs: 60_000,
    max: 10,
    keyFn: (req) => `${req.user?.organization_id || req.ip}_overdue`,
    message: "Overdue scan rate limit exceeded. Only 10 scans per minute allowed.",
  }),
  overdueInvoicesRoutes,
);

app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/compliance", authMiddleware, complianceRoutes);
app.use("/api/credit-notes", authMiddleware, creditNoteRoutes);

app.get("/health", systemContext, async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// JSON 404 for unknown API routes
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Last-resort error handler: never leak stack traces to clients.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // A blocked browser origin is a refusal, not a server fault.
  if (err instanceof Error && err.message.startsWith("CORS blocked")) {
    res.status(403).json({ error: "This site is not allowed to call the API." });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

export default app;
