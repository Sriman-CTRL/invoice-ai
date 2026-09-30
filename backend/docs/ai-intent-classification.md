# AI Intent Classification — Developer Guide

## 1. Why AI Is Used Here

The AI classifier handles the **interpretation** layer of the collections workflow: understanding what a customer *means* in a free-text reply (email, SMS, etc.) before the backend applies a deterministic response.

Without AI, every inbound message would require a human agent to read and categorize. With AI, the backend can:
- Route messages to the correct action automatically
- Schedule follow-ups at the right time
- Escalate disputes without delay
- Flag payment confirmations for human verification

**Critical design principle:** AI outputs are *advisory*. They are never allowed to directly change financial state (invoice status, payment records). Only actual payment records from the `payments` table can affect an invoice's status.

---

## 2. Supported Intents

| Intent | Description |
|---|---|
| `PAYMENT_PROMISED` | Customer says they will pay (future commitment) |
| `PAYMENT_CONFIRMED` | Customer claims they have already paid |
| `PAYMENT_NOT_RECEIVED` | Customer acknowledges they haven't paid yet |
| `INVOICE_ISSUE` | Customer hasn't received the invoice |
| `DISPUTE` | Customer disagrees with the invoice amount or content |
| `REQUEST_EXTENSION` | Customer asks for more time to pay |
| `PAYMENT_PLAN_REQUEST` | Customer asks to pay in installments |
| `WRONG_INVOICE` | Customer received the wrong invoice |
| `OTHER` | Message doesn't match a specific collections intent |

---

## 3. AI Output Schema

The classifier must return a JSON object matching this schema:

```typescript
{
  intent: MessageIntent;        // Required — one of the supported intents above
  confidence: number;           // Required — float in [0, 1]
  promised_date: string | null; // Optional — ISO 8601 date if customer mentions a date
  promised_amount: number | null; // Optional — numeric amount if mentioned
  reason: string | null;        // Optional — human-readable classifier note
}
```

**Example outputs:**

```json
// "I will make the payment tomorrow."
{
  "intent": "PAYMENT_PROMISED",
  "confidence": 0.91,
  "promised_date": "2026-10-01",
  "promised_amount": null,
  "reason": "Customer has promised to make a payment."
}
```

```json
// "I have already paid ₹10,000."
{
  "intent": "PAYMENT_CONFIRMED",
  "confidence": 0.92,
  "promised_date": null,
  "promised_amount": 10000,
  "reason": "Customer states payment has already been made."
}
```

All classifier output is validated by [`src/services/ai/types.ts`](../src/services/ai/types.ts) before use. Malformed or invalid output causes a `502` error — the endpoint never silently accepts bad data.

---

## 4. Why AI Does Not Directly Change Financial State

This is the core safety invariant of the system.

**Wrong (never do this):**
```typescript
if (classification.intent === "PAYMENT_CONFIRMED") {
    await prisma.invoices.update({ where: { id }, data: { status: "PAID" } });
}
```

**Correct:**
```typescript
// AI tells us the customer *claims* payment.
// We check actual payment records. Only records determine status.
```

Reasons:
1. Customers may be mistaken or lying
2. Payment may be pending bank confirmation
3. The amount claimed may differ from what was received
4. Partial payments must be tracked accurately
5. Financial audit trails must be based on real transactions

---

## 5. Payment Confirmation Verification Flow

When `PAYMENT_CONFIRMED` is received:

```
Customer: "I paid ₹25,000."
          ↓
AI: intent = PAYMENT_CONFIRMED
          ↓
Backend: Load invoice for this conversation
          ↓
Backend: SELECT SUM(amount) FROM payments WHERE invoice_id = X AND status = 'SUCCEEDED'
          ↓
Compare claimed vs actual:

FULLY_PAID  → No action created. Invoice already correct per records.
PARTIALLY_PAID → Create PAYMENT_VERIFICATION_REQUIRED action. Return verification details.
NOT_PAID    → Create PAYMENT_VERIFICATION_REQUIRED action. Human must investigate.
```

**Invoice status is only changed by [`payment.routes.ts`](../src/routes/payment.routes.ts)** when an actual payment record is created via `POST /api/payments`.

---

## 6. Collection Action Rules

| Intent | Action Type | Scheduled At |
|---|---|---|
| `PAYMENT_PROMISED` | `FOLLOW_UP_SCHEDULED` | Day after promised_date (or +24h) |
| `REQUEST_EXTENSION` | `ESCALATE_FOR_REVIEW` | Day after promised_date (or +24h) |
| `DISPUTE` | `ESCALATE_DISPUTE` | Immediately |
| `INVOICE_ISSUE` | `RESEND_INVOICE` | Immediately |
| `WRONG_INVOICE` | `RESEND_INVOICE` | Immediately |
| `PAYMENT_PLAN_REQUEST` | `ESCALATE_FOR_REVIEW` | Immediately |
| `PAYMENT_NOT_RECEIVED` | `FOLLOW_UP_SCHEDULED` | None (deferred) |
| `PAYMENT_CONFIRMED` (not verified) | `PAYMENT_VERIFICATION_REQUIRED` | None |
| `PAYMENT_CONFIRMED` (fully paid) | *(no action)* | — |
| `OTHER` | `MANUAL_REVIEW` | None |

**Idempotency:** If a `PENDING` or `PROCESSING` action of the same type already exists for the same conversation, a duplicate is **not** created. The existing action ID is returned instead.

---

## 7. Endpoint Reference

### `POST /api/messages/:message_id/classify`

Classifies an inbound message, persists AI fields, and triggers the collection action engine.

**Request:**
```json
{
  "organization_id": "f55018bf-c8f9-4d11-8509-275e59ce8517"
}
```

**Response:**
```json
{
  "message_id": "3678090e-fecc-4860-a7b4-8a9a9a0832f6",
  "classification": {
    "intent": "PAYMENT_PROMISED",
    "confidence": 0.91,
    "promised_date": "2026-10-01",
    "promised_amount": null,
    "reason": "Customer has promised to make a payment."
  },
  "collection_action": {
    "action_created": true,
    "action_type": "FOLLOW_UP_SCHEDULED",
    "collection_action_id": "52ab208b-d21e-4f1b-8aef-f8e4de9e876a",
    "skipped_reason": null
  }
}
```

**Error responses:**

| Status | Condition |
|---|---|
| `400` | `organization_id` missing |
| `400` | Message is OUTBOUND (not classifiable) |
| `400` | Message body is empty |
| `404` | Message not found or wrong org |
| `404` | Conversation not found |
| `502` | Classifier threw an error |
| `502` | Classifier returned invalid/malformed output |
| `500` | Unexpected server error |

---

## 8. Testing Results

All tests executed against live backend. `npx tsc --noEmit` → exit code 0, 0 errors.

### Core Intent Tests

| Test | Input | Expected Intent | Actual Intent | Action Created | ✅/❌ |
|---|---|---|---|---|---|
| 1 | "I will make the payment tomorrow. Please give me until then." | `PAYMENT_PROMISED` | `PAYMENT_PROMISED` (0.91) | `FOLLOW_UP_SCHEDULED` | ✅ |
| 2 | "I have already paid Rs 10000 for this invoice." | `PAYMENT_CONFIRMED` | `PAYMENT_CONFIRMED` (0.92) | `PAYMENT_VERIFICATION_REQUIRED` | ✅ |
| 3 | "I don't agree with this invoice. The amount is incorrect." | `DISPUTE` | `DISPUTE` (0.93) | `ESCALATE_DISPUTE` | ✅ |
| 4 | "Can you give me another two weeks to pay?" | `REQUEST_EXTENSION` | `REQUEST_EXTENSION` (0.90) | `ESCALATE_FOR_REVIEW` | ✅ |
| 5 | "I never received the invoice. Please send it again." | `INVOICE_ISSUE` | `INVOICE_ISSUE` (0.89) | `RESEND_INVOICE` | ✅ |
| 6 | "I haven't paid yet, I haven't made the payment." | `PAYMENT_NOT_RECEIVED` | `PAYMENT_NOT_RECEIVED` (0.88) | Duplicate prevented | ✅ |

### Edge Case Tests

| Test | Scenario | Expected | Actual | ✅/❌ |
|---|---|---|---|---|
| E1 | Classify OUTBOUND message | `400 Only INBOUND messages...` | `400` | ✅ |
| E2 | Non-existent message ID | `404 Message not found` | `404` | ✅ |
| E3 | Wrong `organization_id` | `404 Message not found` | `404` | ✅ |
| E4 | Missing `organization_id` | `400 organization_id is required` | `400` | ✅ |
| E5 | Duplicate classification (same message, same intent) | No duplicate action | Duplicate prevented, existing ID returned | ✅ |
| E6 | `PAYMENT_CONFIRMED`, partial payment exists (₹20,000 of ₹25,000) | `PAYMENT_VERIFICATION_REQUIRED`, no PAID update | Correct verification result, action created | ✅ |
| E7 | `PAYMENT_CONFIRMED`, no payment records | `PAYMENT_VERIFICATION_REQUIRED` | Verification: NOT_PAID detected | ✅ |
| E8 | `PAYMENT_CONFIRMED`, invoice fully paid (₹25,000/₹25,000) | No action, invoice stays PAID | `skipped_reason: "Invoice is already fully paid per actual payment records"` | ✅ |

---

## 9. AI Provider Architecture

```
src/services/ai/
├── types.ts              — Intent enum, ClassificationResult schema, validation
└── intentClassifier.ts   — IIntentClassifier interface + MockIntentClassifier + factory

src/services/
└── collectionActionEngine.ts  — Deterministic business rules engine
```

The `IIntentClassifier` interface decouples provider from business logic:

```typescript
interface IIntentClassifier {
    classifyMessage(input: ClassifyInput): Promise<ClassificationResult>;
}
```

To add a real LLM provider:
1. Create `src/services/ai/geminiClassifier.ts` implementing `IIntentClassifier`
2. Set `CLASSIFIER=gemini` in `.env`
3. Update the factory in `intentClassifier.ts`

No business logic changes required.

---

## 10. Future Improvements

| Priority | Improvement |
|---|---|
| High | Replace `MockIntentClassifier` with Gemini/OpenAI/Ollama provider |
| High | Add authentication middleware to protect `/classify` |
| High | Add `PAYMENT_PLAN_REQUEST` structured fields (amount, frequency, start date) |
| Medium | Add `collection_actions` list endpoint for dashboard use |
| Medium | n8n webhook integration — trigger workflows when action is created |
| Medium | Webhook support for external payment systems to mark invoices PAID |
| Low | Add confidence threshold config (e.g., only auto-act if confidence > 0.85) |
| Low | Add `ai_model` and `ai_provider` audit fields to messages table |
| Low | Rate limiting on `/classify` endpoint |

---

## Architecture Diagram

```
Inbound Message (email/SMS)
         │
         ▼
POST /api/messages/:id/classify
         │
         ├─► Validate: organization boundary
         ├─► Validate: INBOUND direction
         ├─► Load: conversation context (last 10 messages)
         │
         ├─► IIntentClassifier.classifyMessage()
         │       ├─► MockIntentClassifier (CLASSIFIER=mock, rule-based, no API)
         │       └─► OllamaClassifier (CLASSIFIER=ollama, llama3.2:3b via HTTP)
         │
         ├─► validateClassificationResult() — strict schema validation
         │
         ├─► prisma.messages.update({ ai_intent, ai_confidence })
         │
         └─► runCollectionActionEngine()
                 ├─► PAYMENT_CONFIRMED → verify payments table
                 │       └─► NEVER sets invoice.status directly
                 ├─► Idempotency check (PENDING/PROCESSING)
                 └─► prisma.collection_actions.create()
```

---

## 11. Ollama Integration

### Setup

Ollama must be running locally before starting the backend with `CLASSIFIER=ollama`.

```bash
# Install Ollama: https://ollama.com
# Pull the model
ollama pull llama3.2:3b

# Verify the model is available
ollama list

# Run interactively to test (optional)
ollama run llama3.2:3b
```

### Environment Variables

Add to `.env`:

```env
# Select classifier: "mock" or "ollama"
CLASSIFIER=ollama

# Ollama server (default: local standard install)
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Model to use
OLLAMA_MODEL=llama3.2:3b

# Request timeout in milliseconds (default: 30000)
OLLAMA_TIMEOUT_MS=30000
```

All variables have safe defaults — the code works without `.env` entries.

### Switching Between Providers

| `.env` setting | Behavior |
|---|---|
| `CLASSIFIER=mock` | Rule-based, deterministic, no external calls. For development and CI. |
| `CLASSIFIER=ollama` | Real llama3.2:3b LLM classification via local Ollama HTTP API. |
| *(unset)* | Defaults to `mock` (safe fallback). |

### Model Details

| Property | Value |
|---|---|
| Model | llama3.2:3b |
| Quantization | Q4_K_M |
| Parameter size | 3.2B |
| Context length | 131,072 tokens |
| GPU | NVIDIA RTX 3050 4GB (tested) |
| Average latency | ~1–2 seconds per classification |

### API Used

The classifier uses Ollama's `/api/chat` endpoint with `stream: false` and `temperature: 0` for deterministic output.

```
POST http://127.0.0.1:11434/api/chat
{
  "model": "llama3.2:3b",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Classify: \"<message>\"" }
  ],
  "stream": false,
  "options": { "temperature": 0, "num_predict": 250 }
}
```

### Error Handling

| Failure | HTTP Response |
|---|---|
| Ollama not running / connection refused | `502` with descriptive error |
| Request timeout | `502` with timeout message |
| Non-200 from Ollama (model not found, etc.) | `502` with Ollama error body |
| Model returns non-JSON content | `502` with extraction error |
| Model returns invalid intent/confidence | `502` with validation error |
| Empty model response | `502` with empty response error |

The Express server never crashes — all Ollama failures are caught and converted to controlled HTTP 502 responses.

### JSON Extraction

The classifier handles model output defensively:
1. Strips markdown code fences (` ```json ... ``` `) if present
2. Extracts the first `{ ... }` JSON object from the response
3. Validates the extracted object using the shared `validateClassificationResult`

### Ollama Real Classification Test Results (llama3.2:3b, 2026-09-30)

| # | Input | Expected | Ollama Result | ✅/❌ |
|---|---|---|---|---|
| 1 | "I will make the payment tomorrow. Please give me until then." | `PAYMENT_PROMISED` | `PAYMENT_PROMISED` (0.9) | ✅ |
| 2 | "I have already paid Rs 10000 for this invoice." | `PAYMENT_CONFIRMED` | `PAYMENT_CONFIRMED` (0.92) | ✅ |
| 3 | "I don't agree with this invoice. The amount is incorrect." | `DISPUTE` | `DISPUTE` (0.93) | ✅ |
| 4 | "Can you give me another two weeks to pay?" | `REQUEST_EXTENSION` | `REQUEST_EXTENSION` (0.9) | ✅ |
| 5 | "I never received the invoice. Please send it again." | `INVOICE_ISSUE` | `INVOICE_ISSUE` (1.0) | ✅ |
| 6 | "I haven't paid yet." | `PAYMENT_NOT_RECEIVED` | `PAYMENT_NOT_RECEIVED` (0.9) | ✅ |

### Payment Safety With Real Ollama

The Ollama classifier returns the same `ClassificationResult` contract as the mock. The `CollectionActionEngine` is completely unaware of which classifier produced the result — it only sees a validated struct. The payment safety invariant is preserved regardless of provider.

---

## 12. Future Improvements

| Priority | Improvement |
|---|---|
| High | Add authentication middleware to protect `/classify` |
| High | Add `PAYMENT_PLAN_REQUEST` structured fields (amount, frequency, start date) |
| Medium | Add `collection_actions` list endpoint for dashboard use |
| Medium | n8n webhook integration — trigger workflows when action is created |
| Medium | Webhook support for external payment systems to mark invoices PAID |
| Medium | Add Gemini/OpenAI provider following the same `IIntentClassifier` interface |
| Low | Add confidence threshold config (e.g., only auto-act if confidence > 0.85) |
| Low | Add `ai_model` and `ai_provider` audit fields to messages table |
| Low | Rate limiting on `/classify` endpoint |
| Low | Structured output / JSON mode when Ollama supports it for the chosen model |

