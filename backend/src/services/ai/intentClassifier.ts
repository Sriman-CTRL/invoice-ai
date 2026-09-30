import type { ClassificationResult, ClassifyInput, MessageIntent } from "./types";
import { SUPPORTED_INTENTS, validateClassificationResult } from "./types";
import { OllamaClassifier } from "./ollamaClassifier";

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * Abstract interface for an intent classifier provider.
 * Swap implementations without touching business logic.
 *
 * Future providers: Gemini, OpenAI, Ollama, Azure OpenAI, etc.
 */
export interface IIntentClassifier {
    /**
     * Classify an inbound message and return a validated ClassificationResult.
     * Throws if the provider returns a malformed or invalid response.
     */
    classifyMessage(input: ClassifyInput): Promise<ClassificationResult>;
}

// ─── Mock / Rule-Based Classifier ─────────────────────────────────────────────

/**
 * A deterministic, rule-based classifier for development and testing.
 *
 * No external API calls. No API keys required.
 * Applies keyword/regex matching to produce a structured result.
 *
 * Replace this with OllamaClassifier or GeminiClassifier when ready.
 */
export class MockIntentClassifier implements IIntentClassifier {
    async classifyMessage(input: ClassifyInput): Promise<ClassificationResult> {
        const text = input.message.toLowerCase().trim();

        // Extract numeric amounts mentioned in the message (e.g. 10000, ₹25,000)
        const amountMatch = text.match(/[₹$]?\s*(\d[\d,]*(?:\.\d{1,2})?)/);
        const mentionedAmount = amountMatch
            ? parseFloat(amountMatch[1].replace(/,/g, ""))
            : null;

        // Extract date mentions like "tomorrow", "next week", "October 5"
        const tomorrowMatch =
            /\b(tomorrow|tmrw)\b/.test(text);
        const nextWeekMatch =
            /\b(next week|end of week|end of month)\b/.test(text);
        const specificDateMatch = text.match(
            /\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}(?:,? \d{4})?)\b/i
        );

        let promised_date: string | null = null;
        if (tomorrowMatch) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            promised_date = d.toISOString().split("T")[0];
        } else if (nextWeekMatch) {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            promised_date = d.toISOString().split("T")[0];
        } else if (specificDateMatch) {
            const parsed = new Date(specificDateMatch[0]);
            if (!isNaN(parsed.getTime())) {
                promised_date = parsed.toISOString().split("T")[0];
            }
        }

        // ── PAYMENT_CONFIRMED ───────────────────────────────────────────────
        if (
            /\b(already paid|have paid|i paid|payment made|transferred|sent the payment|done the payment|completed the payment)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "PAYMENT_CONFIRMED",
                confidence: 0.92,
                promised_date: null,
                promised_amount: mentionedAmount,
                reason: "Customer states payment has already been made.",
            });
        }

        // ── PAYMENT_PROMISED ────────────────────────────────────────────────
        if (
            /\b(will pay|will make the payment|going to pay|going to transfer|pay by|pay on|pay tomorrow|paying tomorrow|send the money|transfer the amount)\b/.test(text) ||
            /\b(will pay|will transfer)\b/.test(text) ||
            (tomorrowMatch && /\b(pay|payment|transfer)\b/.test(text))
        ) {
            return validateClassificationResult({
                intent: "PAYMENT_PROMISED",
                confidence: 0.91,
                promised_date,
                promised_amount: mentionedAmount,
                reason: "Customer has promised to make a payment.",
            });
        }

        // ── DISPUTE ────────────────────────────────────────────────────────
        if (
            /\b(don't agree|do not agree|incorrect|wrong amount|not correct|dispute|disagree|this is wrong|this is not right|raising a dispute|challenging)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "DISPUTE",
                confidence: 0.93,
                promised_date: null,
                promised_amount: null,
                reason: "Customer is disputing the invoice amount or content.",
            });
        }

        // ── PAYMENT_PLAN_REQUEST ────────────────────────────────────────────
        if (
            /\b(payment plan|installment|instalments|emi|split the payment|pay in parts|pay in installments|monthly payments|part payment)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "PAYMENT_PLAN_REQUEST",
                confidence: 0.90,
                promised_date: null,
                promised_amount: null,
                reason: "Customer is requesting a payment plan or installment arrangement.",
            });
        }

        // ── REQUEST_EXTENSION ───────────────────────────────────────────────
        if (
            /\b(extension|extend|more time|extra time|give me until|another week|another month|two weeks|few more days|grace period|delay|postpone)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "REQUEST_EXTENSION",
                confidence: 0.90,
                promised_date,
                promised_amount: null,
                reason: "Customer is requesting a payment deadline extension.",
            });
        }

        // ── INVOICE_ISSUE ───────────────────────────────────────────────────
        if (
            /\b(never received|didn't receive|did not receive|not received the invoice|send it again|resend|send again|haven't got|haven't received)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "INVOICE_ISSUE",
                confidence: 0.89,
                promised_date: null,
                promised_amount: null,
                reason: "Customer has not received or cannot access the invoice.",
            });
        }

        // ── WRONG_INVOICE ───────────────────────────────────────────────────
        if (
            /\b(wrong invoice|not my invoice|different invoice|sent wrong|wrong document|this isn't mine|this is not mine)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "WRONG_INVOICE",
                confidence: 0.91,
                promised_date: null,
                promised_amount: null,
                reason: "Customer received or is referring to the wrong invoice.",
            });
        }

        // ── PAYMENT_NOT_RECEIVED ────────────────────────────────────────────
        if (
            /\b(haven't paid|have not paid|not paid|not yet|not made the payment|haven't made|still pending|not done yet)\b/.test(text)
        ) {
            return validateClassificationResult({
                intent: "PAYMENT_NOT_RECEIVED",
                confidence: 0.88,
                promised_date: null,
                promised_amount: null,
                reason: "Customer acknowledges payment has not been made.",
            });
        }

        // ── OTHER ───────────────────────────────────────────────────────────
        return validateClassificationResult({
            intent: "OTHER",
            confidence: 0.6,
            promised_date: null,
            promised_amount: null,
            reason: "Message does not match a specific collections intent.",
        });
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns the active classifier instance based on the CLASSIFIER env var.
 *
 * Supported values:
 *   CLASSIFIER=mock   — deterministic rule-based (default, no external calls)
 *   CLASSIFIER=ollama — real LLM via local Ollama (requires OLLAMA_BASE_URL + OLLAMA_MODEL)
 *
 * If CLASSIFIER is unset, defaults to "mock" for safe local development.
 */
export function getIntentClassifier(): IIntentClassifier {
    const provider = (process.env.CLASSIFIER ?? "mock").toLowerCase().trim();

    if (provider === "mock") {
        return new MockIntentClassifier();
    }

    if (provider === "ollama") {
        return new OllamaClassifier();
    }

    throw new Error(
        `Unknown CLASSIFIER provider "${provider}". Supported values: "mock", "ollama".`
    );
}
