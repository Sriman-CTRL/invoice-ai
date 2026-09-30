import { Router, Request, Response } from "express";
import { getDashboardData } from "../services/dashboardService";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/dashboard
 * Fetch deterministic database-backed dashboard information for the organization
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
    try {
        const { organization_id } = req.query;

        if (!organization_id || typeof organization_id !== "string") {
            res.status(400).json({ error: "organization_id is required" });
            return;
        }

        if (!UUID_REGEX.test(organization_id)) {
            res.status(400).json({ error: "organization_id must be a valid UUID" });
            return;
        }

        const data = await getDashboardData(organization_id);

        res.json(data);
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
