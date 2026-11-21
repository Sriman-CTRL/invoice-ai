# n8n Integration

Your n8n workflows are the **execution layer**; this backend is the **brain + ledger**. All endpoints required by your active n8n workflows are implemented, tested, and aligned with your workflow definitions.

> **Architecture note:** The backend does not send emails directly. n8n claims due actions, sends messages via Gmail, then reports completion or failure back. Financial state is never touched by AI — only verified payment records update invoice statuses.

---

## Endpoint Map

| n8n Node | Method | URL (both work) | Body | Expected Response Shape |
|---|---|---|---|---|
| **backend login** | `POST` | `/api/auth/login` | `{ "email": "...", "password": "..." }` | `{ "token": "...", "user": { ... } }` |
| **Resolve Conversation** | `POST` | `/api/conversations/resolve` | `{ "thread_id": "...", "customer_email": "..." }` | `200/201`: `{ "conversation_id": "...", ... }`<br>`404`: `{ "error": "Unknown sender" }` |
| **Store Customer Message** | `POST` | `/api/messages` | `{ "conversation_id": "...", "direction": "INBOUND", "channel": "EMAIL", "sender": "...", "recipient": "...", "subject": "...", "body": "...", "external_message_id": "..." }` | `201`: Message record with `id` |
| **Classify Customer Message** | `POST` | `/api/messages/:id/classify` | `{}` | `{ "message_id": "...", "classification": { ... }, "collection_action": { "action_created": bool, "action_type": "...", ... } }` |
| **Claim Due Follow-ups** | `POST` | `/api/collection-actions/claim-due`<br>*(alias: `/claim`)* | `{ "action_type": "FOLLOW_UP_SCHEDULED", "limit": 20 }` | `{ "claimed": [ { "action_id", "customer_name", "customer_email", "invoice_number", "promised_date", "reply_to_message_id", ... } ], "count": N }` |
| **Mark Completed** | `PATCH` | `/api/collection-actions/:id/status` | `{ "status": "COMPLETED", "sent_message_id": "..." }` | Updated collection action record |
| **Mark Failed** | `PATCH` | `/api/collection-actions/:id/status` | `{ "status": "FAILED", "error": "..." }` | Updated collection action record |
| **Reprocess Unclassified** | `POST` | `/api/messages/reprocess-unclassified`<br>*(alias: `/reprocess`)* | `{ "limit": 3 }` | `{ "processed": [ { "status": 200, "message_id": "...", "external_message_id": "...", "result": { "collection_action": { ... } } } ], "count": N }` |

All authenticated endpoints require `Authorization: Bearer <token>` from the `backend login` node. The tenant (`organization_id`) is automatically inferred from the JWT.

---

## Detailed Endpoint Contracts

### 1. `POST /api/conversations/resolve`
Used by **Collections – Inbound Replies**:
- **Request Body:**
  ```json
  {
    "thread_id": "18f5abc12345",
    "customer_email": "sana@bloominteriors.co"
  }
  ```
- **Response if Customer Found (`200 OK` or `201 Created`):**
  ```json
  {
    "conversation_id": "ed4a9273-4c62-40c0-b61b-6bb6f9941487",
    "customer_id": "c37da0c8-b8a4-4fc1-8b1c-0f0b228e68f8",
    "customer_email": "sana@bloominteriors.co",
    "invoice_id": "8305cbf8-ff27-48a5-8e49-682ac7500fc6",
    "channel": "EMAIL"
  }
  ```
- **Response if Unknown Sender (`404 Not Found`):**
  ```json
  {
    "error": "Unknown sender"
  }
  ```
  *(n8n checks `$json.statusCode === 404` in the `Resolve Outcome` switch node and branches to `Unknown Sender (logged)`)*.

---

### 2. `POST /api/collection-actions/claim-due` (alias: `/claim`)
Used by **Collections – Scheduled Follow-ups**:
- **Request Body:**
  ```json
  {
    "action_type": "FOLLOW_UP_SCHEDULED",
    "limit": 20,
    "include_future": false
  }
  ```
- **Response:**
  ```json
  {
    "claimed": [
      {
        "action_id": "d2a502af-d8aa-43f6-b772-f5118c3e7106",
        "action_type": "FOLLOW_UP_SCHEDULED",
        "status": "PROCESSING",
        "scheduled_at": "2026-11-20T10:00:00.000Z",
        "customer_name": "Sana Kapoor",
        "customer_email": "sana@bloominteriors.co",
        "invoice_number": "INV-1043",
        "invoice_amount": "78000",
        "promised_date": "2026-11-25",
        "reply_to_message_id": "18f5abc12345"
      }
    ],
    "count": 1
  }
  ```
  *(n8n's `One Item per Action` node splits out `claimed`, and `Build Reminder` constructs the personalized reminder from these exact keys)*.

---

### 3. `PATCH /api/collection-actions/:id/status`
Used by `Mark Completed` and `Mark Failed`:
- Valid transitions: `PROCESSING -> COMPLETED`, `PROCESSING -> FAILED`.
- Automatically stores `sent_message_id` and `error` in `metadata` for audit logging.

---

### 4. `POST /api/messages/reprocess-unclassified` (alias: `/reprocess`)
Used by **Collections – Scheduled Follow-ups**:
- **Request Body:**
  ```json
  {
    "limit": 3
  }
  ```
- **Response:**
  ```json
  {
    "processed": [
      {
        "status": 200,
        "message_id": "638e03b9-7789-45fa-8eaf-37eed5f74a2e",
        "external_message_id": "18f5abc12345",
        "result": {
          "message_id": "638e03b9-7789-45fa-8eaf-37eed5f74a2e",
          "classification": {
            "intent": "INVOICE_ISSUE",
            "confidence": 0.95,
            "promised_date": null,
            "promised_amount": null,
            "reason": "Customer requested re-sending the PDF"
          },
          "collection_action": {
            "action_created": true,
            "action_type": "RESEND_INVOICE",
            "collection_action_id": "a93bf810-..."
          }
        }
      }
    ],
    "count": 1,
    "succeeded": 1
  }
  ```
  *(n8n's `One Item per Message` splits out `processed`, `Needs Resend Reply?` checks `$json.result?.collection_action?.action_type === 'RESEND_INVOICE'`, and `Send Resend Reply` replies to `$json.external_message_id`)*.
