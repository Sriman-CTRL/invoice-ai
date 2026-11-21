import { Router, Request, Response } from "express";
import { processOverdueInvoices } from "../services/overdueInvoiceEngine";

const router = Router();

/**
 * POST /api/overdue-invoices/process
 * Deterministically finds overdue invoices and creates collection actions.
 */
router.post("/process", async (req: Request, res: Response): Promise<void> => {
    try {
        const organization_id = String(req.body?.organization_id || (req as any).user?.organization_id || "");

        if (!organization_id) {
            res.status(400).json({ error: "organization_id is required" });
            return;
        }

        const result = await processOverdueInvoices(organization_id);

        res.json(result);
    } catch (error) {
        console.error("Error processing overdue invoices:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
