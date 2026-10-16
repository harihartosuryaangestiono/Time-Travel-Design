-- TimeTravelDesign Finance - RLS Policies
-- Run this SQL in Supabase SQL Editor to enable Row Level Security

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_payments ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization ID
DROP FUNCTION IF EXISTS get_user_organization_id() CASCADE;
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM organization_members
    WHERE profile_id = auth.uid()::text
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT role::text
    FROM organization_members
    WHERE profile_id = auth.uid()::text
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is owner or finance
DROP FUNCTION IF EXISTS is_owner_or_finance() CASCADE;
CREATE OR REPLACE FUNCTION is_owner_or_finance()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role::text IN ('OWNER', 'FINANCE')
    FROM organization_members
    WHERE profile_id = auth.uid()::text
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ORGANIZATIONS Policies
-- ============================================
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id = get_user_organization_id()
  );

-- ============================================
-- PROFILES Policies
-- ============================================
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()::text
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (
    id = auth.uid()::text
  );

-- ============================================
-- ORGANIZATION MEMBERS Policies
-- ============================================
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Only owners can manage organization members"
  ON organization_members FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- PROJECT MEMBERS Policies
-- ============================================
CREATE POLICY "Project members can view project memberships"
  ON project_members FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
  );

-- ============================================
-- CLIENTS Policies
-- ============================================
CREATE POLICY "Organization members can view clients"
  ON clients FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage clients"
  ON clients FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- PROJECTS Policies
-- ============================================
CREATE POLICY "Organization members can view projects"
  ON projects FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance and PM can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

CREATE POLICY "Finance can update projects"
  ON projects FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

CREATE POLICY "Only owners can delete projects"
  ON projects FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- EXPENSES Policies
-- ============================================
CREATE POLICY "Organization members can view expenses"
  ON expenses FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Authenticated users can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Submitter or finance can update expenses"
  ON expenses FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND (
      is_owner_or_finance()
      OR submitted_by = auth.uid()::text
    )
  );

-- ============================================
-- CASH ACCOUNTS Policies
-- ============================================
CREATE POLICY "Organization members can view cash accounts"
  ON cash_accounts FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage cash accounts"
  ON cash_accounts FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- CASH ADVANCES Policies
-- ============================================
CREATE POLICY "Organization members can view cash advances"
  ON cash_advances FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage cash advances"
  ON cash_advances FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- REIMBURSEMENTS Policies
-- ============================================
CREATE POLICY "Organization members can view reimbursements"
  ON reimbursements FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Authenticated users can create reimbursements"
  ON reimbursements FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage reimbursements"
  ON reimbursements FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- INVOICES Policies
-- ============================================
CREATE POLICY "Organization members can view invoices"
  ON invoices FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage invoices"
  ON invoices FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- APPROVALS Policies
-- ============================================
CREATE POLICY "Organization members can view approvals"
  ON approvals FOR SELECT
  USING (
    approver_id IN (
      SELECT id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
  );

CREATE POLICY "Authorized users can create approvals"
  ON approvals FOR INSERT
  WITH CHECK (
    approver_id IN (
      SELECT id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
  );

-- ============================================
-- ACCOUNTS Policies
-- ============================================
CREATE POLICY "Organization members can view accounts"
  ON accounts FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage accounts"
  ON accounts FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- ACCOUNTING PERIODS Policies
-- ============================================
CREATE POLICY "Organization members can view accounting periods"
  ON accounting_periods FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage accounting periods"
  ON accounting_periods FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- JOURNAL ENTRIES Policies
-- ============================================
CREATE POLICY "Organization members can view journal entries"
  ON journal_entries FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage journal entries"
  ON journal_entries FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- JOURNAL LINES Policies
-- ============================================
CREATE POLICY "Organization members can view journal lines"
  ON journal_lines FOR SELECT
  USING (
    journal_id IN (
      SELECT id FROM journal_entries
      WHERE organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Finance can manage journal lines"
  ON journal_lines FOR ALL
  USING (
    journal_id IN (
      SELECT id FROM journal_entries
      WHERE organization_id = get_user_organization_id()
    )
    AND is_owner_or_finance()
  );

-- ============================================
-- AUDIT LOGS Policies
-- ============================================
CREATE POLICY "Finance can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- NOTIFICATIONS Policies
-- ============================================
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid()::text
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (
    user_id = auth.uid()::text
  );

-- ============================================
-- STORAGE Policies (for receipts and documents)
-- ============================================
-- Note: Create bucket named 'receipts' and 'documents' first in Supabase Storage

-- CREATE POLICY "Users can upload receipts to their organization"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'receipts'
--     AND organization_id = get_user_organization_id()
--   );

-- CREATE POLICY "Users can view receipts in their organization"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'receipts'
--     AND organization_id = get_user_organization_id()
--   );

-- CREATE POLICY "Users can delete their own uploads"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'receipts'
--     AND owner_id = auth.uid()
--   );

-- ============================================
-- VENDORS Policies
-- ============================================
CREATE POLICY "Organization members can view vendors"
  ON vendors FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Finance can manage vendors"
  ON vendors FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- ============================================
-- BUDGET VERSIONS Policies
-- ============================================
CREATE POLICY "Organization members can view budget versions"
  ON budget_versions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Finance and PM can manage budget versions"
  ON budget_versions FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id = get_user_organization_id()
    )
    AND is_owner_or_finance()
  );

-- ============================================
-- RECEIPTS Policies
-- ============================================
CREATE POLICY "Organization members can view receipts"
  ON receipts FOR SELECT
  USING (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Authenticated users can upload receipts"
  ON receipts FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Uploaders can update receipts"
  ON receipts FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND uploaded_by = auth.uid()::text
  );
