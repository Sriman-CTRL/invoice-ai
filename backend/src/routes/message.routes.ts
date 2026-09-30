import { Router } from "express";
import prisma from "../lib/prisma";
import { getIntentClassifier } from "../services/ai/intentClassifier";
import { validateClassificationResult } from "../services/ai/types";
import { runCollectionActionEngine } from "../services/collectionActionEngine";

/** Maximum number of recent messages to include as conversation context */
const CONTEXT_MESSAGE_LIMIT = 10;

const router = Router();

// Create a message
router.post("/", async (req, res) => {
    try {
        let {
            organization_id,
            conversation_id,
            direction,
            channel,
            sender,
            recipient,
            subject,
            body,
            external_message_id,
        } = req.body;

        if (!organization_id && (req as any).user?.organization_id) {
            organization_id = (req as any).user.organization_id;
        }

        if (!organization_id && conversation_id) {
            const conv = await prisma.conversations.findUnique({
                where: { id: conversation_id },
            });
            if (conv) {
                organization_id = conv.organization_id;
            }
        }

        if (
            !organization_id ||
            !conversation_id ||
            !direction ||
            !channel ||
            !sender ||
            !body
        ) {
            return res.status(400).json({
                error:
                    "organization_id, conversation_id, direction, channel, sender and body are required",
            });
        }

        const conversation = await prisma.conversations.findFirst({
            where: {
                id: conversation_id,
                organization_id: organization_id,
            },
        });

        if (!conversation) {
            return res.status(404).json({
                error: "Conversation not found",
            });
        }

        const message = await prisma.messages.create({
            data: {
                organization_id: organization_id,
                conversation_id: conversation_id,
                direction,
                channel,
                sender,
                recipient: recipient || null,
                subject: subject || null,
                body,
                external_message_id: external_message_id || null,
            },
        });

        return res.status(201).json(message);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Failed to create message",
        });
    }
});

// Get messages for a conversation
router.get("/conversation/:conversation_id", async (req, res) => {
    try {
        const organization_id = req.query.organization_id as string;
        const { conversation_id } = req.params;

        if (!organization_id) {
            return res.status(400).json({
                error: "organization_id is required",
            });
        }

        const conversation = await prisma.conversations.findFirst({
            where: {
                id: conversation_id,
                organization_id: organization_id,
            },
        });

        if (!conversation) {
            return res.status(404).json({
                error: "Conversation not found",
            });
        }

        const messages = await prisma.messages.findMany({
            where: {
                conversation_id: conversation_id,
                organization_id: organization_id,
            },
            orderBy: {
                created_at: "asc",
            },
        });

        return res.json(messages);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Failed to fetch messages",
        });
    }
});

// ─── POST /api/messages/:message_id/classify ─────────────────────────────────
//
// Classify an inbound message using the AI intent classifier, persist the
// ai_intent and ai_confidence fields, and run the collection action engine.
//
router.post("/:message_id/classify", async (req, res) => {
    try {
        const { message_id } = req.params;
        let { organization_id } = req.body;

        if (!organization_id && (req as any).user?.organization_id) {
            organization_id = (req as any).user.organization_id;
        }

        if (!organization_id) {
            const existing = await prisma.messages.findUnique({
                where: { id: message_id },
            });
            if (existing) {
                organization_id = existing.organization_id;
            }
        }

        if (!organization_id) {
            return res.status(400).json({
                error: "organization_id is required",
            });
        }

        // 1. Find and validate the message
        const message = await prisma.messages.findFirst({
            where: {
                id: message_id,
                organization_id,
            },
        });

        if (!message) {
            return res.status(404).json({
                error: "Message not found",
            });
        }

        // 2. Only inbound messages are classified
        if (message.direction !== "INBOUND") {
            return res.status(400).json({
                error: "Only INBOUND messages can be classified",
            });
        }

        if (!message.body || message.body.trim() === "") {
            return res.status(400).json({
                error: "Message body is empty — nothing to classify",
            });
        }

        // 3. Load conversation for context
        const conversation = await prisma.conversations.findFirst({
            where: {
                id: message.conversation_id,
                organization_id,
            },
        });

        if (!conversation) {
            return res.status(404).json({
                error: "Conversation not found for this message",
            });
        }

        // 4. Load recent context messages (excluding the current message)
        const contextMessages = await prisma.messages.findMany({
            where: {
                conversation_id: message.conversation_id,
                organization_id,
                id: { not: message_id },
            },
            orderBy: { created_at: "desc" },
            take: CONTEXT_MESSAGE_LIMIT,
        });

        // Reverse so context is chronological (oldest first)
        const context = contextMessages.reverse().map((m) => ({
            direction: m.direction as "INBOUND" | "OUTBOUND",
            body: m.body ?? "",
            created_at: m.created_at instanceof Date
                ? m.created_at.toISOString()
                : (m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString()),
        }));

        // 5. Classify via AI service
        const classifier = getIntentClassifier();
        let rawResult: unknown;
        try {
            rawResult = await classifier.classifyMessage({
                message: message.body,
                context,
            });
        } catch (classifyError) {
            console.error("Classifier error:", classifyError);
            return res.status(502).json({
                error: "AI classifier failed",
                detail: classifyError instanceof Error ? classifyError.message : String(classifyError),
            });
        }

        // 6. Validate the structured output
        let classification;
        try {
            classification = validateClassificationResult(rawResult);
        } catch (validationError) {
            console.error("Classification validation failed:", validationError);
            return res.status(502).json({
                error: "AI classifier returned an invalid response",
                detail: validationError instanceof Error ? validationError.message : String(validationError),
            });
        }

        // 7. Persist ai_intent and ai_confidence into messages table
        const updatedMessage = await prisma.messages.update({
            where: { id: message_id },
            data: {
                ai_intent: classification.intent,
                ai_confidence: classification.confidence,
            },
        });

        // 8. Run deterministic collection action engine
        const actionResult = await runCollectionActionEngine({
            organization_id,
            customer_id: conversation.customer_id,
            invoice_id: conversation.invoice_id ?? null,
            conversation_id: conversation.id,
            message_id,
            classification,
        });

        // 9. Return combined result
        return res.json({
            message_id: updatedMessage.id,
            classification,
            collection_action: actionResult,
        });
    } catch (error) {
        console.error("Classify endpoint error:", error);
        return res.status(500).json({
            error: "Failed to classify message",
        });
    }
});

export default router;