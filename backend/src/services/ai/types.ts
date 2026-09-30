/**
 * Supported message intent labels.
 * The AI classifier outputs one of these values.
 * Business rules are then applied deterministically based on the intent.
 */
export const SUPPORTED_INTENTS = [
    "PAYMENT_CONFIRMED",
    "PAYMENT_PROMISED",
    "PAYMENT_NOT_RECEIVED",
    "INVOICE_ISSUE",
    "DISPUTE",
    "REQUEST_EXTENSION",
    "PAYMENT_PLAN_REQUEST",
    "WRONG_INVOICE",
    "OTHER",
] as const;

export type MessageIntent = (typeof SUPPORTED_INTENTS)[number];

/**
 * Structured output from the AI intent classifier.
 * This is the contract the classifier must satisfy.
 */
export interface ClassificationResult {
    /** One of the supported intent labels */
    intent: MessageIntent;

    /** Confidence score between 0 and 1 (inclusive) */
    confidence: number;

    /**
     * ISO 8601 date string if the customer promised a payment date.
     * Null otherwise.
     */
    promised_date: string | null;

    /**
     * Numeric amount if the customer mentioned a specific amount (confirmed or promised).
     * Null otherwise.
     */
    promised_amount: number | null;

    /**
     * Human-readable reason or note from the classifier.
     * Null if not applicable.
     */
    reason: string | null;
}

/**
 * A single message in the conversation context sent to the classifier.
 */
export interface ContextMessage {
    direction: "INBOUND" | "OUTBOUND";
    body: string;
    created_at: string;
}

/**
 * Full input payload sent to the classifier.
 */
export interface ClassifyInput {
    /** The specific inbound message to classify */
    message: string;

    /** Recent conversation context (most recent N messages) */
    context: ContextMessage[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a raw object against the ClassificationResult schema.
 * Returns a typed result or throws a descriptive error.
 *
 * Rules:
 * - intent must be one of SUPPORTED_INTENTS
 * - confidence must be a number in [0, 1]
 * - promised_date must be a valid ISO date string or null
 * - promised_amount must be a non-negative number or null
 * - reason must be a string or null
 */
export function validateClassificationResult(raw: unknown): ClassificationResult {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Classifier response is not an object");
    }

    const obj = raw as Record<string, unknown>;

    // intent
    if (!SUPPORTED_INTENTS.includes(obj.intent as MessageIntent)) {
        throw new Error(
            `Invalid intent "${String(obj.intent)}". Must be one of: ${SUPPORTED_INTENTS.join(", ")}`
        );
    }
    const intent = obj.intent as MessageIntent;

    // confidence
    const confidence = Number(obj.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        throw new Error(
            `Invalid confidence "${obj.confidence}". Must be a number between 0 and 1`
        );
    }

    // promised_date
    let promised_date: string | null = null;
    if (obj.promised_date !== null && obj.promised_date !== undefined) {
        if (typeof obj.promised_date !== "string") {
            throw new Error("promised_date must be a string or null");
        }
        const d = new Date(obj.promised_date);
        if (isNaN(d.getTime())) {
            throw new Error(`promised_date "${obj.promised_date}" is not a valid date`);
        }
        promised_date = obj.promised_date;
    }

    // promised_amount
    let promised_amount: number | null = null;
    if (obj.promised_amount !== null && obj.promised_amount !== undefined) {
        const n = Number(obj.promised_amount);
        if (isNaN(n) || n < 0) {
            throw new Error("promised_amount must be a non-negative number or null");
        }
        promised_amount = n;
    }

    // reason
    let reason: string | null = null;
    if (obj.reason !== null && obj.reason !== undefined) {
        if (typeof obj.reason !== "string") {
            throw new Error("reason must be a string or null");
        }
        reason = obj.reason;
    }

    return { intent, confidence, promised_date, promised_amount, reason };
}
