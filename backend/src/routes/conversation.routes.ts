import { Router } from "express";
import prisma from "../lib/prisma";
import { getConversationDetails } from "../services/conversationService";

const router = Router();

// Create a conversation
router.post("/", async (req, res) => {
    try {
        const {
            organization_id,
            customer_id,
            invoice_id,
            channel,
            external_thread_id,
        } = req.body;

        if (!organization_id || !customer_id || !channel) {
            return res.status(400).json({
                error: "organization_id, customer_id, and channel are required",
            });
        }

        const conversation = await prisma.conversations.create({
            data: {
                organization_id,
                customer_id,
                invoice_id: invoice_id || null,
                channel,
                external_thread_id: external_thread_id || null,
            },
        });

        return res.status(201).json(conversation);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Failed to create conversation",
        });
    }
});

// Get all conversations for an organization
router.get("/", async (req, res) => {
    try {
        const organization_id = req.query.organization_id as string;

        if (!organization_id) {
            return res.status(400).json({
                error: "organization_id is required",
            });
        }

        const conversations = await prisma.conversations.findMany({
            where: {
                organization_id,
            },
            orderBy: {
                created_at: "desc",
            },
        });

        return res.json(conversations);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Failed to fetch conversations",
        });
    }
});

export default router;

// Get one conversation
router.get("/:id", async (req, res) => {
    try {
        const { organization_id } = req.query;
        const { id } = req.params;

        if (!organization_id || typeof organization_id !== "string") {
            return res.status(400).json({ error: "organization_id is required" });
        }

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(organization_id)) {
            return res.status(400).json({ error: "organization_id must be a valid UUID" });
        }
        if (!UUID_REGEX.test(id)) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const details = await getConversationDetails(organization_id, id);

        if (!details) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        return res.json(details);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch conversation" });
    }
});
