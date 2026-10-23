-- Manual, destructive reset. Run only after taking a database backup.
-- Keeps the specified organization, its members/profiles, settings, and master
-- data so the organization remains usable. Clears its transaction/history data,
-- and removes all data/configuration for every other organization.
-- Supabase Auth users and user-scoped notifications are intentionally retained.

BEGIN;

DO $$
DECLARE
  target_org_id CONSTANT text := '492a3053-c806-4c4a-a2ce-2ebb9c56cdbc';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE id::text = target_org_id
  ) THEN
    RAISE EXCEPTION 'Target organization % does not exist; no data was reset.', target_org_id;
  END IF;

  -- Remove child rows before their transaction parents.
  DELETE FROM public.import_errors
  WHERE batch_id IN (
    SELECT id FROM public.import_batches WHERE organization_id::text <> target_org_id
  );

  DELETE FROM public.import_errors
  WHERE batch_id IN (
    SELECT id FROM public.import_batches WHERE organization_id::text = target_org_id
  );

  DELETE FROM public.expense_allocations
  WHERE expense_id IN (SELECT id FROM public.expenses);

  DELETE FROM public.advance_settlements
  WHERE cash_advance_id IN (SELECT id FROM public.cash_advances);

  DELETE FROM public.invoice_items
  WHERE invoice_id IN (SELECT id FROM public.invoices);

  DELETE FROM public.invoice_allocations
  WHERE invoice_id IN (SELECT id FROM public.invoices);

  DELETE FROM public.invoice_payments
  WHERE invoice_id IN (SELECT id FROM public.invoices);

  DELETE FROM public.approvals
  WHERE expense_id IN (SELECT id FROM public.expenses)
     OR reimbursement_id IN (SELECT id FROM public.reimbursements);

  DELETE FROM public.journal_lines
  WHERE journal_id IN (SELECT id FROM public.journal_entries)
     OR account_id IN (
       SELECT id FROM public.accounts WHERE organization_id::text <> target_org_id
     )
     OR project_id IN (
       SELECT id FROM public.projects
     );

  DELETE FROM public.budget_items
  WHERE budget_id IN (
    SELECT bv.id
    FROM public.budget_versions bv
    JOIN public.projects p ON p.id = bv.project_id
  );

  DELETE FROM public.contracts
  WHERE client_id IN (
    SELECT id FROM public.clients WHERE organization_id::text <> target_org_id
  )
     OR client_id IN (
       SELECT id FROM public.clients WHERE organization_id::text = target_org_id
     );

  DELETE FROM public.commitment_items
  WHERE project_id IN (SELECT id FROM public.projects);

  DELETE FROM public.project_members
  WHERE project_id IN (
    SELECT id FROM public.projects WHERE organization_id::text <> target_org_id
  );

  -- Clear all transactions for the target and every other organization.
  DELETE FROM public.expenses WHERE organization_id IS NOT NULL;
  DELETE FROM public.receipts WHERE organization_id IS NOT NULL;
  DELETE FROM public.cash_transfers WHERE organization_id IS NOT NULL;
  DELETE FROM public.cash_advances WHERE organization_id IS NOT NULL;
  DELETE FROM public.project_revenues WHERE organization_id IS NOT NULL;
  DELETE FROM public.reimbursements WHERE organization_id IS NOT NULL;
  DELETE FROM public.invoices WHERE organization_id IS NOT NULL;
  DELETE FROM public.journal_entries WHERE organization_id IS NOT NULL;
  DELETE FROM public.cash_payments WHERE organization_id IS NOT NULL;
  DELETE FROM public.audit_logs WHERE organization_id IS NOT NULL;
  DELETE FROM public.import_batches WHERE organization_id IS NOT NULL;

  -- Clear project budgets for every organization; retain target projects.
  DELETE FROM public.budget_versions
  WHERE project_id IN (SELECT id FROM public.projects);

  -- Delete non-target organization setup and master data.
  DELETE FROM public.advance_recipients
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.projects
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.clients
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.vendors
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.cash_accounts
  WHERE organization_id::text <> target_org_id;

  UPDATE public.accounts
  SET parent_id = NULL
  WHERE organization_id::text <> target_org_id
    AND parent_id IS NOT NULL;

  DELETE FROM public.accounts
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.accounting_periods
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.organization_settings
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.organization_members
  WHERE organization_id::text <> target_org_id;

  DELETE FROM public.organizations
  WHERE id::text <> target_org_id;

  RAISE NOTICE 'Reset completed. Preserved organization: %', target_org_id;
END;
$$;

COMMIT;

SELECT id, name
FROM public.organizations;
