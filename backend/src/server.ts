import "dotenv/config";
import express from "express";
import cors from "cors";
import prisma from "./lib/prisma";
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
import { authMiddleware } from "./middleware/auth.middleware";
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

app.use("/api/invoices", authMiddleware, invoiceRoutes);
app.use("/api/payments", authMiddleware, paymentRoutes);
app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/organizations", authMiddleware, organizationRoutes); // Note: Could restrict some of this, but following instruction
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/conversations", authMiddleware, conversationRoutes);
app.use("/api/collection-actions", authMiddleware, collectionActionRoutes);
app.use("/api/overdue-invoices", authMiddleware, overdueInvoicesRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
