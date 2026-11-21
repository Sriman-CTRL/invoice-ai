-- Apply these indexes if you are managing the schema by hand instead of
-- `prisma migrate dev`. They match the @@index declarations in schema.prisma.
-- Run with:  npx prisma db execute --file prisma/sql/indexes.sql

CREATE INDEX IF NOT EXISTS idx_collection_actions_org_status       ON collection_actions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_collection_actions_org_customer     ON collection_actions (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_collection_actions_invoice          ON collection_actions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_collection_actions_conversation     ON collection_actions (conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversations_org_customer          ON conversations (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_invoice               ON conversations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status_updated    ON conversations (organization_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_customers_org_created               ON customers (organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_invoices_org_status                 ON invoices (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due                    ON invoices (organization_id, due_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer                   ON invoices (customer_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created       ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_org_intent                 ON messages (organization_id, ai_intent);

CREATE INDEX IF NOT EXISTS idx_payments_org_invoice                ON payments (organization_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status             ON payments (invoice_id, status);

CREATE INDEX IF NOT EXISTS idx_users_email                          ON users (email);
