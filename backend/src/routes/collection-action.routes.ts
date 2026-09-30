import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

const VALID_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];

/**
 * GET /api/collection-actions
 * List collection actions with optional filtering
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            organization_id,
            status,
            action_type,
            customer_id,
            invoice_id,
        } = req.query;

        if (!organization_id || typeof organization_id !== "string") {
            res.status(400).json({ error: "organization_id is required" });
            return;
        }

        const filters: any = { organization_id };

        if (status && typeof status === "string") {
            filters.status = status;
        }
        if (action_type && typeof action_type === "string") {
            filters.action_type = action_type;
        }
        if (customer_id && typeof customer_id === "string") {
            filters.customer_id = customer_id;
        }
        if (invoice_id && typeof invoice_id === "string") {
            filters.invoice_id = invoice_id;
        }

        const actions = await prisma.collection_actions.findMany({
            where: filters,
            orderBy: [
                { scheduled_at: "asc" },
                { created_at: "desc" },
            ],
        });

        res.json({
            value: actions,
            Count: actions.length,
        });
    } catch (error) {
        console.error("Error fetching collection actions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/collection-actions/:id
 * Retrieve a specific collection action by ID
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { organization_id } = req.query;

        if (!organization_id || typeof organization_id !== "string") {
            res.status(400).json({ error: "organization_id is required" });
            return;
        }

        const action = await prisma.collection_actions.findFirst({
            where: {
                id: id as string,
                organization_id: organization_id as string,
            },
            include: {
                customers: true,
                invoices: true,
                conversations: true,
            },
        });

        if (!action) {
            res.status(404).json({ error: "Collection action not found" });
            return;
        }

        res.json(action);
    } catch (error) {
        console.error("Error fetching collection action:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /api/collection-actions/:id/status
 * Update the status of a collection action
 */
router.patch("/:id/status", async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { organization_id, status } = req.body;

        if (!organization_id || typeof organization_id !== "string") {
            res.status(400).json({ error: "organization_id is required in body" });
            return;
        }

        if (!status || typeof status !== "string" || !VALID_STATUSES.includes(status)) {
            res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
            return;
        }

        const action = await prisma.collection_actions.findFirst({
            where: {
                id: id as string,
                organization_id: organization_id as string,
            },
        });

        if (!action) {
            res.status(404).json({ error: "Collection action not found" });
            return;
        }

        const currentStatus = action.status;

        // Validate transitions
        const validTransitions: Record<string, string[]> = {
            "PENDING": ["PROCESSING", "CANCELLED"],
            "PROCESSING": ["COMPLETED", "FAILED"],
            "COMPLETED": [],
            "FAILED": [],
            "CANCELLED": []
        };

        if (!validTransitions[currentStatus]?.includes(status as string)) {
            res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${status}` });
            return;
        }

        let executed_at = action.executed_at;

        if (status === "COMPLETED" && !executed_at) {
            executed_at = new Date();
        }

        const updatedAction = await prisma.collection_actions.update({
            where: {
                id: id as string,
            },
            data: {
                status: status as string,
                executed_at,
            },
        });

        res.json(updatedAction);
    } catch (error) {
        console.error("Error updating collection action status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
