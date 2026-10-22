-- ==============================================================================
-- Migration: 005_rls_fix.sql
-- Description: Fix security holes, define RLS for 12 zero-policy tables,
--              prevent expense status tampering, lock down audit_logs and
--              organization_members, and make helper functions deterministic.
-- ==============================================================================

-- 1. Helper functions with search_path and deterministic ORDER BY
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM organization_members
    WHERE profile_id = auth.uid()::text
    ORDER BY created_at ASC
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role::text
    FROM organization_members
    WHERE profile_id = auth.uid()::text
    ORDER BY created_at ASC
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_owner_or_finance()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT role::text IN ('OWNER', 'FINANCE')
    FROM organization_members
    WHERE profile_id = auth.uid()::text
    ORDER BY created_at ASC
    LIMIT 1
  ), false);
END;
$$;

-- 2. Audit Logs: Security Definer helper to write audit logs safely
CREATE OR REPLACE FUNCTION record_audit_log(
  p_organization_id text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id text;
BEGIN
  INSERT INTO audit_logs (
    id,
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  )
  VALUES (
    'log_' || gen_random_uuid()::text,
    p_organization_id,
    auth.uid()::text,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    now()
  )
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- Secure direct audit_logs inserts
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated users can record own audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can record own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()::text
    AND organization_id = get_user_organization_id()
  );

-- 3. Restrict organization_members INSERT (prevent org injection)
DROP POLICY IF EXISTS "Users can create own membership" ON organization_members;
DROP POLICY IF EXISTS "Allow member creation on onboarding or by owner" ON organization_members;
CREATE POLICY "Allow member creation on onboarding or by owner"
  ON organization_members FOR INSERT
  WITH CHECK (
    -- Onboarding: user can only join a brand new organization with 0 members
    (
      profile_id = auth.uid()::text
      AND NOT EXISTS (
        SELECT 1 FROM organization_members om WHERE om.organization_id = organization_members.organization_id
      )
    )
    OR
    -- Existing organization: only OWNER or FINANCE can add members
    is_owner_or_finance()
  );

-- 4. Expenses: Split update policy to prevent status tampering by submitter
DROP POLICY IF EXISTS "Submitter or finance can update expenses" ON expenses;
DROP POLICY IF EXISTS "Submitters can update own draft expenses" ON expenses;
DROP POLICY IF EXISTS "Finance can update expenses" ON expenses;

CREATE POLICY "Submitters can update own draft expenses"
  ON expenses FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND submitted_by = auth.uid()::text
    AND status = 'DRAFT'
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND submitted_by = auth.uid()::text
    AND status = 'DRAFT'
  );

CREATE POLICY "Finance can update expenses"
  ON expenses FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

-- RPC for approved/rejected state transitions with auditing
CREATE OR REPLACE FUNCTION approve_expense(
  p_expense_id text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id text;
  v_current_status text;
BEGIN
  v_org_id := get_user_organization_id();
  IF NOT is_owner_or_finance() THEN
    RAISE EXCEPTION 'Unauthorized: only OWNER or FINANCE can approve expenses';
  END IF;

  SELECT status INTO v_current_status
  FROM expenses
  WHERE id = p_expense_id AND organization_id = v_org_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  IF v_current_status != 'SUBMITTED' AND v_current_status != 'DRAFT' THEN
    RAISE EXCEPTION 'Expense cannot be approved in its current status: %', v_current_status;
  END IF;

  UPDATE expenses
  SET status = 'APPROVED',
      updated_at = now()
  WHERE id = p_expense_id AND organization_id = v_org_id;

  -- Record approval log
  INSERT INTO approvals (
    id,
    expense_id,
    approver_id,
    action,
    action_date,
    comments,
    created_at
  )
  VALUES (
    gen_random_uuid()::text,
    p_expense_id,
    auth.uid()::text,
    'APPROVED',
    now(),
    p_notes,
    now()
  );

  PERFORM record_audit_log(
    v_org_id,
    'APPROVE',
    'EXPENSE',
    p_expense_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', 'APPROVED', 'comments', p_notes)
  );

  RETURN jsonb_build_object('success', true, 'expense_id', p_expense_id, 'status', 'APPROVED');
END;
$$;

CREATE OR REPLACE FUNCTION reject_expense(
  p_expense_id text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id text;
  v_current_status text;
BEGIN
  v_org_id := get_user_organization_id();
  IF NOT is_owner_or_finance() THEN
    RAISE EXCEPTION 'Unauthorized: only OWNER or FINANCE can reject expenses';
  END IF;

  SELECT status INTO v_current_status
  FROM expenses
  WHERE id = p_expense_id AND organization_id = v_org_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  UPDATE expenses
  SET status = 'REJECTED',
      updated_at = now()
  WHERE id = p_expense_id AND organization_id = v_org_id;

  -- Record approval log
  INSERT INTO approvals (
    id,
    expense_id,
    approver_id,
    action,
    action_date,
    comments,
    created_at
  )
  VALUES (
    gen_random_uuid()::text,
    p_expense_id,
    auth.uid()::text,
    'REJECTED',
    now(),
    p_notes,
    now()
  );

  PERFORM record_audit_log(
    v_org_id,
    'REJECT',
    'EXPENSE',
    p_expense_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', 'REJECTED', 'comments', p_notes)
  );

  RETURN jsonb_build_object('success', true, 'expense_id', p_expense_id, 'status', 'REJECTED');
END;
$$;

-- 5. Fix Foreign Key ID matching in project_members & approvals
DROP POLICY IF EXISTS "Project members can view project memberships" ON project_members;
CREATE POLICY "Project members can view project memberships"
  ON project_members FOR SELECT
  USING (
    member_id = auth.uid()::text
    OR member_id IN (
      SELECT id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
    OR project_id IN (
      SELECT id FROM projects
      WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Organization members can view approvals" ON approvals;
CREATE POLICY "Organization members can view approvals"
  ON approvals FOR SELECT
  USING (
    approver_id = auth.uid()::text
    OR approver_id IN (
      SELECT id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
    OR is_owner_or_finance()
  );

-- 6. Define RLS Policies for the 12 Zero-Policy Tables

-- 1. cash_transfers
DROP POLICY IF EXISTS "Users can view cash transfers" ON cash_transfers;
CREATE POLICY "Users can view cash transfers"
  ON cash_transfers FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage cash transfers" ON cash_transfers;
CREATE POLICY "Finance can manage cash transfers"
  ON cash_transfers FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- 2. invoice_items
DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;
CREATE POLICY "Users can view invoice items"
  ON invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage invoice items" ON invoice_items;
CREATE POLICY "Finance can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 3. invoice_allocations
DROP POLICY IF EXISTS "Users can view invoice allocations" ON invoice_allocations;
CREATE POLICY "Users can view invoice allocations"
  ON invoice_allocations FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage invoice allocations" ON invoice_allocations;
CREATE POLICY "Finance can manage invoice allocations"
  ON invoice_allocations FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 4. invoice_payments
DROP POLICY IF EXISTS "Users can view invoice payments" ON invoice_payments;
CREATE POLICY "Users can view invoice payments"
  ON invoice_payments FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage invoice payments" ON invoice_payments;
CREATE POLICY "Finance can manage invoice payments"
  ON invoice_payments FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 5. expense_allocations
DROP POLICY IF EXISTS "Users can view expense allocations" ON expense_allocations;
CREATE POLICY "Users can view expense allocations"
  ON expense_allocations FOR SELECT
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Users can manage expense allocations" ON expense_allocations;
CREATE POLICY "Users can manage expense allocations"
  ON expense_allocations FOR ALL
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id = get_user_organization_id()
    )
  )
  WITH CHECK (
    expense_id IN (
      SELECT id FROM expenses WHERE organization_id = get_user_organization_id()
    )
  );

-- 6. advance_settlements
DROP POLICY IF EXISTS "Users can view advance settlements" ON advance_settlements;
CREATE POLICY "Users can view advance settlements"
  ON advance_settlements FOR SELECT
  USING (
    advance_id IN (
      SELECT id FROM cash_advances WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage advance settlements" ON advance_settlements;
CREATE POLICY "Finance can manage advance settlements"
  ON advance_settlements FOR ALL
  USING (
    advance_id IN (
      SELECT id FROM cash_advances WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    advance_id IN (
      SELECT id FROM cash_advances WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 7. budget_items
DROP POLICY IF EXISTS "Users can view budget items" ON budget_items;
CREATE POLICY "Users can view budget items"
  ON budget_items FOR SELECT
  USING (
    budget_version_id IN (
      SELECT id FROM budget_versions WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage budget items" ON budget_items;
CREATE POLICY "Finance can manage budget items"
  ON budget_items FOR ALL
  USING (
    budget_version_id IN (
      SELECT id FROM budget_versions WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    budget_version_id IN (
      SELECT id FROM budget_versions WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 8. contracts
DROP POLICY IF EXISTS "Users can view contracts" ON contracts;
CREATE POLICY "Users can view contracts"
  ON contracts FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage contracts" ON contracts;
CREATE POLICY "Finance can manage contracts"
  ON contracts FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- 9. commitment_items
DROP POLICY IF EXISTS "Users can view commitment items" ON commitment_items;
CREATE POLICY "Users can view commitment items"
  ON commitment_items FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage commitment items" ON commitment_items;
CREATE POLICY "Finance can manage commitment items"
  ON commitment_items FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- 10. import_batches
DROP POLICY IF EXISTS "Users can view import batches" ON import_batches;
CREATE POLICY "Users can view import batches"
  ON import_batches FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage import batches" ON import_batches;
CREATE POLICY "Finance can manage import batches"
  ON import_batches FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- 11. import_errors
DROP POLICY IF EXISTS "Users can view import errors" ON import_errors;
CREATE POLICY "Users can view import errors"
  ON import_errors FOR SELECT
  USING (
    batch_id IN (
      SELECT id FROM import_batches WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage import errors" ON import_errors;
CREATE POLICY "Finance can manage import errors"
  ON import_errors FOR ALL
  USING (
    batch_id IN (
      SELECT id FROM import_batches WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    batch_id IN (
      SELECT id FROM import_batches WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 12. cash_payments
DROP POLICY IF EXISTS "Users can view cash payments" ON cash_payments;
CREATE POLICY "Users can view cash payments"
  ON cash_payments FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage cash payments" ON cash_payments;
CREATE POLICY "Finance can manage cash payments"
  ON cash_payments FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- Grant execute permissions to authenticated users for RPCs
GRANT EXECUTE ON FUNCTION approve_expense(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_expense(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_audit_log(text, text, text, text, jsonb, jsonb) TO authenticated;
