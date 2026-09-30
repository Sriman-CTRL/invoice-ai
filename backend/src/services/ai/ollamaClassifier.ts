import type { ClassificationResult, ClassifyInput, ContextMessage } from "./types";
import { validateClassificationResult } from "./types";
import type { IIntentClassifier } from "./intentClassifier";

// ─── Configuration ─────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

/** Request timeout in milliseconds. 3B model on a 4GB GPU is fast; be generous for cold starts. */
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS ?? "30000", 10);

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an accounts-receivable message intent classifier for an invoice collection system.

Classify the customer message into exactly one intent from this list:
- PAYMENT_CONFIRMED: Customer claims they have already paid (past tense: "I paid", "already paid", "transferred", "sent payment")
- PAYMENT_PROMISED: Customer commits to pay in the future ("will pay", "going to pay", "pay tomorrow", "pay by Friday")
- PAYMENT_NOT_RECEIVED: Customer acknowledges they have not yet paid ("haven't paid", "not paid yet", "still pending")
- INVOICE_ISSUE: Customer has not received the invoice or cannot access it ("never received", "didn't get invoice", "please resend invoice")
- DISPUTE: Customer disagrees with the invoice amount, content, or validity ("wrong amount", "don't agree", "incorrect invoice", "disputing")
- REQUEST_EXTENSION: Customer asks for more time to pay ("give me more time", "extend deadline", "another 2 weeks", "grace period")
- PAYMENT_PLAN_REQUEST: Customer asks to pay in installments ("payment plan", "pay in parts", "installments", "split into monthly")
- WRONG_INVOICE: Customer received the wrong invoice ("wrong invoice", "not my invoice", "this isn't for me")
- OTHER: None of the above apply

Return ONLY a single JSON object. No markdown. No backticks. No explanation outside JSON.

{"intent":"<INTENT>","confidence":<0.0 to 1.0>,"promised_date":<"YYYY-MM-DD" if a specific calendar date like "October 5" or "November 10" is stated, else null>,"promised_amount":<specific number if an explicit amount like "10000" or "25000" is stated, else null>,"reason":"<one sentence explanation>"}

CRITICAL RULES:
1. intent MUST be exactly one of the 9 values listed above. No other strings.
2. confidence is a float 0.0 to 1.0 inclusive.
3. promised_date: ONLY set if a specific calendar date is explicitly mentioned. Vague terms like "tomorrow", "soon", "this week" = null.
4. promised_amount: ONLY set to the raw numeric value (no currency symbols) if an explicit amount is stated.
5. Output must be valid JSON. Single line preferred.`;

// ─── Ollama API Types ──────────────────────────────────────────────────────────

interface OllamaMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface OllamaChatRequest {
    model: string;
    messages: OllamaMessage[];
    stream: boolean;
    options?: {
        temperature?: number;
        num_predict?: number;
    };
}

interface OllamaChatResponse {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
}

// ─── JSON Extraction ──────────────────────────────────────────────────────────

/**
 * Extract the first valid JSON object from a string.
 * Handles cases where the model wraps output in markdown fences or adds extra text.
 */
function extractJson(raw: string): unknown {
    const trimmed = raw.trim();

    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        return JSON.parse(fenceMatch[1].trim());
    }

    // Try to find a JSON object directly
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        return JSON.parse(objectMatch[0]);
    }

    throw new Error(`No JSON object found in model response: ${trimmed.slice(0, 200)}`);
}

// ─── Ollama Classifier ─────────────────────────────────────────────────────────

/**
 * Real LLM-based classifier using a locally running Ollama instance.
 *
 * Uses the /api/chat endpoint with a carefully engineered system prompt.
 * Validates all model output through the shared validateClassificationResult function.
 *
 * Environment variables:
 *   OLLAMA_BASE_URL   — default: http://127.0.0.1:11434
 *   OLLAMA_MODEL      — default: llama3.2:3b
 *   OLLAMA_TIMEOUT_MS — default: 30000
 */
export class OllamaClassifier implements IIntentClassifier {
    private readonly baseUrl: string;
    private readonly model: string;
    private readonly timeoutMs: number;

    constructor(
        baseUrl: string = OLLAMA_BASE_URL,
        model: string = OLLAMA_MODEL,
        timeoutMs: number = OLLAMA_TIMEOUT_MS
    ) {
        this.baseUrl = baseUrl.replace(/\/$/, ""); // strip trailing slash
        this.model = model;
        this.timeoutMs = timeoutMs;
    }

    async classifyMessage(input: ClassifyInput): Promise<ClassificationResult> {
        const userContent = this.buildUserMessage(input);

        const requestBody: OllamaChatRequest = {
            model: this.model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent },
            ],
            stream: false,
            options: {
                temperature: 0,    // Deterministic — no creative variation
                num_predict: 250,  // Enough for our JSON schema, not wasteful
            },
        };

        const rawContent = await this.callOllama(requestBody);

        let parsed: unknown;
        try {
            parsed = extractJson(rawContent);
        } catch (err) {
            throw new Error(
                `Ollama returned non-JSON content: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        // Reuse the shared validator — same rules as mock classifier
        return validateClassificationResult(parsed);
    }

    /**
     * Build the user-turn message that includes the target message and
     * recent conversation context for grounding.
     */
    private buildUserMessage(input: ClassifyInput): string {
        const parts: string[] = [];

        if (input.context.length > 0) {
            parts.push("Recent conversation context:");
            for (const msg of input.context) {
                const speaker = msg.direction === "OUTBOUND" ? "Company" : "Customer";
                parts.push(`  ${speaker}: "${msg.body}"`);
            }
            parts.push("");
        }

        parts.push(`Classify this customer message: "${input.message}"`);
        return parts.join("\n");
    }

    /**
     * Call the Ollama /api/chat endpoint with an AbortController timeout.
     * Returns the raw text content of the model's response.
     *
     * Throws descriptive errors for:
     *   - Connection refused / Ollama not running
     *   - Timeout
     *   - Non-200 HTTP status (e.g. model not found)
     *   - Empty response
     */
    private async callOllama(body: OllamaChatRequest): Promise<string> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (err) {
            clearTimeout(timer);
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(
                    `Ollama request timed out after ${this.timeoutMs}ms. Is the model loaded?`
                );
            }
            throw new Error(
                `Ollama connection failed (${this.baseUrl}). Is Ollama running? Error: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            clearTimeout(timer);
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => "(unreadable body)");
            throw new Error(
                `Ollama returned HTTP ${response.status}: ${errorText.slice(0, 300)}`
            );
        }

        const json = (await response.json()) as OllamaChatResponse;

        const content = json?.message?.content;
        if (!content || content.trim() === "") {
            throw new Error("Ollama returned an empty response body.");
        }

        return content;
    }
}
