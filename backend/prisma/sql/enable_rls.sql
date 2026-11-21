-- ============================================================================
-- PostgreSQL Row-Level Security (RLS) Policy for Multi-Tenant Isolation
-- Layer 4 (Zero Trust Multi-Tenancy Defense-in-Depth)
-- ============================================================================

-- Function to safely extract tenant context set by connection or transaction
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_invoices ON invoices;
CREATE POLICY tenant_isolation_invoices ON invoices
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 2. Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 3. Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
CREATE POLICY tenant_isolation_payments ON payments
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 4. Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_messages ON messages;
CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 5. Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_conversations ON conversations;
CREATE POLICY tenant_isolation_conversations ON conversations
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 6. Collection Actions
ALTER TABLE collection_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_collection_actions ON collection_actions;
CREATE POLICY tenant_isolation_collection_actions ON collection_actions
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 7. Suppressions
ALTER TABLE suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_suppressions ON suppressions;
CREATE POLICY tenant_isolation_suppressions ON suppressions
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );

-- 8. Credit Notes
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_credit_notes ON credit_notes;
CREATE POLICY tenant_isolation_credit_notes ON credit_notes
  FOR ALL
  USING (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL 
    OR organization_id = app_current_org_id()
  );
