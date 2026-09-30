# Collection Actions API

## 1. Concept

In the AI Accounts Receivable / Collections Agent architecture, **Collection Actions** represent the intention of the system to perform a specific action in response to a customer's message or invoice state. 

The flow is as follows:
1. **Customer Message**: A customer sends a reply.
2. **AI Intent Classification**: The AI model (e.g. Ollama) classifies the intent of the message.
3. **Collection Action Engine**: The deterministic backend engine interprets the AI intent and the current financial state to create a *Collection Action*.
4. **Collection Actions API**: Provides access to list, read, and update the status of these actions.
5. **Execution (Future)**: An external orchestrator (like n8n) will poll or receive webhooks for pending actions and actually execute them (e.g., sending an email, escalating to human agents).

**Important Note**: The Collection Action Engine only schedules actions. The backend does not send emails or call external APIs directly to execute these actions.

## 2. Statuses & Transitions

A collection action can be in one of the following statuses:
- `PENDING`: Action is scheduled but not yet picked up.
- `PROCESSING`: Action is currently being executed by the orchestrator.
- `COMPLETED`: Action was successfully executed.
- `FAILED`: Action execution failed.
- `CANCELLED`: Action was cancelled (e.g., invoice was paid before the scheduled action).

### Valid Transitions

- `PENDING` → `PROCESSING`
- `PENDING` → `CANCELLED`
- `PROCESSING` → `COMPLETED`
- `PROCESSING` → `FAILED`

Invalid transitions (like `COMPLETED` → `PROCESSING`) will return a `400 Bad Request`.

When transitioning to `COMPLETED`, the `executed_at` timestamp is automatically set if it wasn't already.

## 3. Endpoints

All endpoints require `organization_id` to enforce tenant isolation.

### List Actions

`GET /api/collection-actions`

**Query Parameters:**
- `organization_id` (required)
- `status` (optional)
- `action_type` (optional)
- `customer_id` (optional)
- `invoice_id` (optional)

**Response:**
Returns a list of actions ordered by `scheduled_at` (ascending), then `created_at` (descending).

```json
{
  "value": [
    {
      "id": "uuid",
      "action_type": "FOLLOW_UP_SCHEDULED",
      "status": "PENDING",
      "scheduled_at": "2026-10-02T00:00:00.000Z",
      ...
    }
  ],
  "Count": 1
}
```

### Retrieve Action

`GET /api/collection-actions/:id`

**Query Parameters:**
- `organization_id` (required)

**Response:**
Returns the specific action along with related `customers`, `invoices`, and `conversations`.

### Update Status

`PATCH /api/collection-actions/:id/status`

**Body:**
```json
{
  "organization_id": "uuid",
  "status": "PROCESSING"
}
```

**Response:**
Returns the updated action. Enforces valid status transitions and automatically handles `executed_at`.

## 4. Tenant Isolation

Security is enforced at the database query level. The `organization_id` is mandatory for all requests. Actions are only retrieved or updated if the `organization_id` matches, guaranteeing that no data leaks across tenants.
