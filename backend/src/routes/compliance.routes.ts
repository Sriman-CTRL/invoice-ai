import { Router, Request, Response } from "express";
import { authorizeOutboundSend, addSuppression } from "../services/complianceService";
import prisma from "../lib/prisma";
import { serverError } from "../lib/monitoring";

const router = Router();

/**
 * POST /api/compliance/authorize-send
 * Single compliance gate: checks dispute status, suppressions, cadence cooldown, and returns
 * the mandatory EU AI Act transparency footer.
 */
router.post("/authorize-send", async (req: Request, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { customer_id, customer_email, invoice_id, channel } = req.body ?? {};

    const decision = await authorizeOutboundSend({
      organization_id,
      customer_id,
      customer_email,
      invoice_id,
      channel,
    });

    res.json(decision);
  } catch (error) {
    console.error("Compliance authorization error:", error);
    return serverError(res, error, "Failed to evaluate compliance authorization");
  }
});

/**
 * GET /api/compliance/suppressions
 * List active opt-out / suppressions for this organization.
 */
router.get("/suppressions", async (req: Request, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const suppressions = await prisma.suppressions.findMany({
      where: { organization_id },
      orderBy: { created_at: "desc" },
    });

    res.json(suppressions);
  } catch (error) {
    console.error("Fetch suppressions error:", error);
    return serverError(res, error, "Failed to fetch suppressions");
  }
});

/**
 * POST /api/compliance/suppressions
 * Manually add an address to the opt-out / suppression list.
 */
router.post("/suppressions", async (req: Request, res: Response) => {
  try {
    const organization_id = req.user?.organization_id;
    if (!organization_id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { address, reason } = req.body ?? {};
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    const suppression = await addSuppression(
      organization_id,
      address,
      reason || "MANUAL_OPT_OUT"
    );

    res.status(201).json(suppression);
  } catch (error) {
    console.error("Add suppression error:", error);
    return serverError(res, error, "Failed to add suppression");
  }
});

export default router;
