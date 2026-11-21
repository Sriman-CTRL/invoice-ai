-- Ledgerlane schema (matches backend/prisma/schema.prisma).
-- Apply with:  npx prisma db push   OR   psql -U invoice_admin -d invoice_ai -f prisma/sql/schema.sql

CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(255) NOT NULL,
  slug        varchar(100) NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           varchar(320) NOT NULL,
  password_hash   varchar(255),
  name            varchar(255),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS customers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                 varchar(255) NOT NULL,
  email                varchar(320) NOT NULL,
  company_name         varchar(255),
  phone                varchar(50),
  external_customer_id varchar(255),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS idx_customers_org_created ON customers (organization_id, created_at);

CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id),
  invoice_number      varchar(100) NOT NULL,
  external_invoice_id varchar(255),
  amount              numeric(14,2) NOT NULL,
  currency            varchar(3) NOT NULL DEFAULT 'INR',
  issued_at           timestamptz,
  due_at              timestamptz,
  status              varchar(30) NOT NULL DEFAULT 'OPEN',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_due    ON invoices (organization_id, due_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer   ON invoices (customer_id);

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id          uuid NOT NULL REFERENCES invoices(id),
  external_payment_id varchar(255),
  amount              numeric(14,2) NOT NULL,
  currency            varchar(3) NOT NULL DEFAULT 'INR',
  status              varchar(30) NOT NULL DEFAULT 'PENDING',
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_org_invoice    ON payments (organization_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status ON payments (invoice_id, status);

CREATE TABLE IF NOT EXISTS conversations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id        uuid NOT NULL REFERENCES customers(id),
  invoice_id         uuid REFERENCES invoices(id),
  channel            varchar(30) NOT NULL,
  external_thread_id varchar(255),
  status             varchar(30) NOT NULL DEFAULT 'OPEN',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_org_customer       ON conversations (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_invoice            ON conversations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status_updated ON conversations (organization_id, status, updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           varchar(10) NOT NULL,
  channel             varchar(30) NOT NULL,
  sender              varchar(320),
  recipient           varchar(320),
  subject             text,
  body                text,
  external_message_id varchar(255),
  ai_intent           varchar(50),
  ai_confidence       numeric(5,4),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_org_intent         ON messages (organization_id, ai_intent);

CREATE TABLE IF NOT EXISTS collection_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES customers(id),
  invoice_id      uuid REFERENCES invoices(id),
  conversation_id uuid REFERENCES conversations(id),
  action_type     varchar(50) NOT NULL,
  status          varchar(30) NOT NULL DEFAULT 'PENDING',
  scheduled_at    timestamptz,
  executed_at     timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collection_actions_org_status   ON collection_actions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_collection_actions_org_customer ON collection_actions (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_collection_actions_invoice      ON collection_actions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_collection_actions_conversation ON collection_actions (conversation_id);
