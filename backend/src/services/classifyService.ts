import prisma from "../lib/prisma";
import { getIntentClassifier } from "./ai/intentClassifier";
import { validateClassificationResult } from "./ai/types";
import { runCollectionActionEngine } from "./collectionActionEngine";

const CONTEXT_MESSAGE_LIMIT = 10;

export type ClassifyErrorCode =
  | "MESSAGE_NOT_FOUND"
  | "NOT_INBOUND"
  | "EMPTY_BODY"
  | "CONVERSATION_NOT_FOUND"
  | "CLASSIFIER_FAILED"
  | "INVALID_CLASSIFICATION";

export class ClassifyError extends Error {
  constructor(public code: ClassifyErrorCode, message: string) {
    super(message);
    this.name = "ClassifyError";
  }
}

export interface ClassifyOutcome {
  message_id: string;
  classification: {
    intent: string;
    confidence: number;
    promised_date: string | null;
    promised_amount: number | null;
    reason: string | null;
  };
  collection_action: {
    action_created: boolean;
    action_type: string | null;
    collection_action_id: string | null;
    skipped_reason: string | null;
    payment_verification?: unknown;
  };
}

/**
 * Classify one inbound message, persist the AI fields, and run the deterministic
 * collection action engine. Shared by the single-message and batch endpoints so
 * the two can never drift apart.
 */
export async function classifyInboundMessage(
  organization_id: string,
  message_id: string,
): Promise<ClassifyOutcome> {
  const message = await prisma.messages.findFirst({
    where: { id: message_id, organization_id },
  });
  if (!message) throw new ClassifyError("MESSAGE_NOT_FOUND", "Message not found");
  if (message.direction !== "INBOUND") {
    throw new ClassifyError("NOT_INBOUND", "Only INBOUND messages can be classified");
  }
  if (!message.body || message.body.trim() === "") {
    throw new ClassifyError("EMPTY_BODY", "Message body is empty — nothing to classify");
  }

  const conversation = await prisma.conversations.findFirst({
    where: { id: message.conversation_id, organization_id },
  });
  if (!conversation) {
    throw new ClassifyError("CONVERSATION_NOT_FOUND", "Conversation not found for this message");
  }

  const contextMessages = await prisma.messages.findMany({
    where: { conversation_id: message.conversation_id, organization_id, id: { not: message_id } },
    orderBy: { created_at: "desc" },
    take: CONTEXT_MESSAGE_LIMIT,
  });
  const context = contextMessages.reverse().map((m) => ({
    direction: m.direction as "INBOUND" | "OUTBOUND",
    body: m.body ?? "",
    created_at: m.created_at.toISOString(),
  }));

  const classifier = getIntentClassifier();
  let rawResult: unknown;
  try {
    rawResult = await classifier.classifyMessage({ message: message.body, context });
  } catch (error) {
    console.error("Classifier error:", error);
    throw new ClassifyError(
      "CLASSIFIER_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }

  let classification;
  try {
    classification = validateClassificationResult(rawResult);
  } catch (error) {
    console.error("Classification validation failed:", error);
    throw new ClassifyError(
      "INVALID_CLASSIFICATION",
      error instanceof Error ? error.message : String(error),
    );
  }

  await prisma.messages.update({
    where: { id: message_id },
    data: { ai_intent: classification.intent, ai_confidence: classification.confidence },
  });

  const actionResult = await runCollectionActionEngine({
    organization_id,
    customer_id: conversation.customer_id,
    invoice_id: conversation.invoice_id ?? null,
    conversation_id: conversation.id,
    message_id,
    classification,
  });

  return {
    message_id,
    classification,
    collection_action: actionResult,
  };
}
