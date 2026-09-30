import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

import customerRoutes from "./backend/src/routes/customer.routes";
import organizationRoutes from "./backend/src/routes/organization.routes";
import invoiceRoutes from "./backend/src/routes/invoice.routes";
import paymentRoutes from "./backend/src/routes/payment.routes";
import messageRoutes from "./backend/src/routes/message.routes";
import conversationRoutes from "./backend/src/routes/conversation.routes";
import collectionActionRoutes from "./backend/src/routes/collection-action.routes";
import overdueInvoicesRoutes from "./backend/src/routes/overdue-invoices.routes";
import dashboardRoutes from "./backend/src/routes/dashboard.routes";
import authRoutes from "./backend/src/routes/auth.routes";
import { authMiddleware } from "./backend/src/middleware/auth.middleware";
import prisma from "./backend/src/lib/prisma";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function unwrap(mod: any) {
  if (typeof mod === "function") return mod;
  if (mod && mod.default && typeof mod.default === "function") return mod.default;
  return mod;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use("/api/auth", unwrap(authRoutes));
  app.use("/api/invoices", unwrap(authMiddleware), unwrap(invoiceRoutes));
  app.use("/api/payments", unwrap(authMiddleware), unwrap(paymentRoutes));
  app.use("/api/customers", unwrap(authMiddleware), unwrap(customerRoutes));
  app.use("/api/organizations", unwrap(authMiddleware), unwrap(organizationRoutes));
  app.use("/api/messages", unwrap(authMiddleware), unwrap(messageRoutes));
  app.use("/api/conversations", unwrap(authMiddleware), unwrap(conversationRoutes));
  app.use("/api/collection-actions", unwrap(authMiddleware), unwrap(collectionActionRoutes));
  app.use("/api/overdue-invoices", unwrap(authMiddleware), unwrap(overdueInvoicesRoutes));
  app.use("/api/dashboard", unwrap(authMiddleware), unwrap(dashboardRoutes));

  const db = (prisma as any)?.default || prisma;

  app.get("/health", async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        database: "connected",
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        status: "error",
        database: "disconnected",
      });
    }
  });

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
