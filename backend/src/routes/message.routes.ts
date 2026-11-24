import { Router } from "express";
import prisma from "../lib/prisma";
import { processInboundEmail } from "../services/inboundService";
import { classifyInboundMessage, ClassifyError } from "../services/classifyService";
import { serverError } from "../lib/monitoring";

const router = Router();

// Create a message
router.post("/", async (req, res) => {
    try {
        const {
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

        if (!organization_id || !conversation_id || !direction || !channel || !sender || !body) {
            return res.status(400).json({
                error: "organization_id, conversation_id, direction, channel, sender and body are required",
            });
        }

        const conversation = await prisma.conversations.findFirst({
            where: { id: conversation_id, organization_id },
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const message = await prisma.messages.create({
            data: {
                organization_id,
                conversation_id,
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
        return serverError(res, error, "Failed to create message");
    }
});

// ─── POST /api/messages/ingest ───────────────────────────────────────────────
// Authenticated equivalent of the inbound webhook: paste/forward a customer
// reply and get it classified + actioned, all scoped to the caller's tenant.
router.post("/ingest", async (req, res) => {
    try {
        const organization_id = String(req.body?.organization_id || "");
        const { from, subject, text, html, invoice_number, to } = req.body ?? {};

        if (!organization_id) {
            return res.status(400).json({ error: "organization_id is required" });
        }
        if (!from || !(text || html)) {
            return res.status(400).json({ error: "from and text (or html) are required" });
        }

        const result = await processInboundEmail({
            organization_id,
            from,
            to,
            subject,
            text,
            html,
            invoice_number,
            channel: "EMAIL",
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Message ingestion error:", error);
        return res.status(422).json({
            error: "Unable to process the message at this time. Please check the recipient address or contact support.",
            code: "INGEST_FAILED",
        });
    }
});

// ─── POST /api/messages/reprocess-unclassified (alias: /reprocess) ───────────
// Batch-classify inbound messages that have no ai_intent yet. This is the
// "Reprocess Unclassified" step orchestrators (n8n) call on a schedule.
// Returns an array under `processed` to match n8n's splitOut contract.
router.post(["/reprocess", "/reprocess-unclassified"], async (req, res) => {
    try {
        const organization_id = String(req.body?.organization_id || req.user?.organization_id || "");
        if (!organization_id) {
            return res.status(400).json({ error: "organization_id is required" });
        }
        const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 10));

        const messages = await prisma.messages.findMany({
            where: { organization_id, direction: "INBOUND", ai_intent: null, body: { not: null } },
            orderBy: { created_at: "asc" },
            take: limit,
        });

        const processed: Array<{
            status: number;
            message_id: string;
            external_message_id: string | null;
            result: Record<string, unknown>;
        }> = [];

        for (const m of messages) {
            try {
                const outcome = await classifyInboundMessage(organization_id, m.id);
                processed.push({
                    status: 200,
                    message_id: m.id,
                    external_message_id: m.external_message_id,
                    result: outcome as unknown as Record<string, unknown>,
                });
            } catch (error) {
                const statusCode = error instanceof ClassifyError
                    ? (CLASSIFY_ERROR_STATUS[error.code] ?? 400)
                    : 500;
                const errorMsg = error instanceof Error ? error.message : String(error);
                processed.push({
                    status: statusCode,
                    message_id: m.id,
                    external_message_id: m.external_message_id,
                    result: {
                        error: errorMsg,
                        detail: errorMsg,
                    },
                });
            }
        }

        return res.json({
            processed,
            count: processed.length,
            succeeded: processed.filter((r) => r.status === 200).length,
        });
    } catch (error) {
        console.error("Reprocess error:", error);
        return serverError(res, error, "Failed to reprocess unclassified messages");
    }
});

// Get messages for a conversation
router.get("/conversation/:conversation_id", async (req, res) => {
    try {
        const organization_id = req.query.organization_id as string;
        const { conversation_id } = req.params;

        if (!organization_id) {
            return res.status(400).json({ error: "organization_id is required" });
        }

        const conversation = await prisma.conversations.findFirst({
            where: { id: conversation_id, organization_id },
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const messages = await prisma.messages.findMany({
            where: { conversation_id, organization_id },
            orderBy: { created_at: "asc" },
        });

        return res.json(messages);
    } catch (error) {
        console.error(error);
        return serverError(res, error, "Failed to fetch messages");
    }
});

// ─── POST /api/messages/:message_id/classify ─────────────────────────────────
//
// Classify an inbound message using the AI intent classifier, persist the
// ai_intent and ai_confidence fields, and run the collection action engine.
//
const CLASSIFY_ERROR_STATUS: Record<string, number> = {
    MESSAGE_NOT_FOUND: 404,
    CONVERSATION_NOT_FOUND: 404,
    NOT_INBOUND: 400,
    EMPTY_BODY: 400,
    CLASSIFIER_FAILED: 502,
    INVALID_CLASSIFICATION: 502,
};

const CLASSIFY_ERROR_MESSAGE: Record<string, string> = {
    MESSAGE_NOT_FOUND: "Message not found",
    CONVERSATION_NOT_FOUND: "Conversation not found for this message",
    NOT_INBOUND: "Only INBOUND messages can be classified",
    EMPTY_BODY: "Message body is empty — nothing to classify",
    CLASSIFIER_FAILED: "AI classifier failed",
    INVALID_CLASSIFICATION: "AI classifier returned an invalid response",
};

router.post("/:message_id/classify", async (req, res) => {
    try {
        const organization_id = String(req.body?.organization_id || "");
        if (!organization_id) {
            return res.status(400).json({ error: "organization_id is required" });
        }

        const outcome = await classifyInboundMessage(organization_id, req.params.message_id);
        return res.json(outcome);
    } catch (error) {
        if (error instanceof ClassifyError) {
            return res.status(CLASSIFY_ERROR_STATUS[error.code] ?? 400).json({
                error: CLASSIFY_ERROR_MESSAGE[error.code] ?? "Failed to classify message",
                detail: error.message,
            });
        }
        console.error("Classify endpoint error:", error);
        return serverError(res, error, "Failed to classify message");
    }
});

export default router;
