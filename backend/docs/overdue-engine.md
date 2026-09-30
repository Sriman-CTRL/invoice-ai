# Overdue Invoice Engine

## 1. Concept

The Overdue Invoice Engine provides deterministic business logic to identify invoices that have passed their due date without being fully paid, and automatically creates a corresponding collection action so that the system can follow up.

**Why deterministic?**
Deciding if an invoice is overdue is purely mathematical and relies entirely on concrete database state (the `invoices` table). It does not require artificial intelligence. Therefore, AI is completely isolated from financial state evaluations.

## 2. Overdue Rules

An invoice is considered **overdue** if and only if all of the following conditions are met:
1. `status` is either `OPEN` or `PARTIALLY_PAID`
2. `due_at` is in the past (strictly less than the current time)
3. `organization_id` matches the current execution context

Invoices that are `PAID` or `CANCELLED` are ignored, even if their `due_at` is in the past. 

## 3. Idempotency

The engine is designed to be executed repeatedly (e.g., via a daily cron job) without creating duplicate actions. 

When processing an overdue invoice, the engine checks the `collection_actions` table:
- If there is already an active action (status `PENDING` or `PROCESSING`) of type `FOLLOW_UP_SCHEDULED` for that specific `invoice_id`, the engine **skips** the invoice.
- It only creates a new action if the invoice is overdue and has no active follow-up scheduled.

## 4. Endpoints

### Process Overdue Invoices

`POST /api/overdue-invoices/process`

**Body:**
```json
{
  "organization_id": "uuid"
}
```

**Response:**
Returns a summary of the execution:
```json
{
  "invoices_detected": 1,
  "actions_created": 1,
  "created_action_ids": ["uuid"],
  "skipped": []
}
```

## 5. Security & Isolation

The engine executes on a per-tenant basis. `organization_id` is required, and all database queries (both for invoices and collection actions) are strictly filtered by this ID. This guarantees no cross-tenant data leakage or processing.
