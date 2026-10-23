-- ==============================================================================
-- Migration: 20261023_fix_rls_and_defaults.sql
--
-- Purpose : Perbaiki 2 blocker yang membuat Impor dari UI gagal menulis ke DB:
--   (1) 12 tabel punya RLS ENABLED tapi BELUM punya policy sama sekali, sehingga
--       INSERT/SELECT ditolak: "new row violates row-level security policy".
--   (2) Kolom `id` (text) dan `updated_at` NOT NULL tanpa DEFAULT di sisi
--       PostgreSQL. Prisma meng-generate id di sisi client, tetapi aplikasi
--       menulis lewat PostgREST (supabase-js) yang TIDAK meng-generate id,
--       sehingga gagal: 23502 "null value in column id".
--
-- Sifat : Idempotent (aman dijalankan berulang kali).
-- ==============================================================================

-- ==============================================================================
-- BAGIAN 1 — DEFAULT untuk kolom `id` dan `updated_at`
-- ==============================================================================
-- Prisma mendeklarasikan `id String @id @default(uuid())` dan
-- `updated_at DateTime @updatedAt`. Keduanya sebenarnya Photo 2x: Prisma
-- meng-generate nilainya di sisi aplikasi. Tabel yang dibuat lewat Prisma/
-- PostgREST tidak memiliki DEFAULT di sisi PostgreSQL, sehingga insert lewat
-- supabase-js (PostgREST) selalu gagal. Kita samakan dengan DEFAULT database.

DO $$
DECLARE
    t text;
    id_tables text[] := ARRAY[
        'accounting_periods', 'accounts', 'advance_settlements', 'approvals',
        'audit_logs', 'budget_items', 'budget_versions', 'cash_accounts',
        'cash_advances', 'cash_payments', 'cash_transfers', 'clients',
        'commitment_items', 'contracts', 'expense_allocations', 'expenses',
        'import_batches', 'import_errors', 'invoice_allocations', 'invoice_items',
        'invoice_payments', 'invoices', 'journal_entries', 'journal_lines',
        'notifications', 'organization_members', 'organization_settings',
        'organizations', 'project_members', 'projects', 'receipts',
        'reimbursements', 'vendors'
    ];
    upd_tables text[] := ARRAY[
        'accounts', 'budget_items', 'budget_versions', 'cash_accounts',
        'cash_advances', 'clients', 'commitment_items', 'contracts', 'expenses',
        'invoices', 'journal_entries', 'organization_members',
        'organization_settings', 'organizations', 'projects', 'reimbursements',
        'vendors'
    ];
BEGIN
    FOREACH t IN ARRAY id_tables LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text',
            t
        );
    END LOOP;

    FOREACH t IN ARRAY upd_tables LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP',
            t
        );
    END LOOP;

    RAISE NOTICE 'Default id + updated_at diterapkan ke % dan % tabel',
        array_length(id_tables, 1), array_length(upd_tables, 1);
END;
$$;

-- ==============================================================================
-- BAGIAN 2 — Policy RLS untuk 12 tabel yang belum punya policy
-- ==============================================================================
-- Tabel ini RLS-nya aktif tapi policy-nya kosong => semua INSERT/SELECT ditolak
-- untuk role non-service. Definisi diambil dari 005_rls_fix.sql (migrasi yang
-- belum pernah dijalankan ke database).

-- 1. import_batches
DROP POLICY IF EXISTS "Users can view import batches" ON import_batches;
CREATE POLICY "Users can view import batches"
  ON import_batches FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage import batches" ON import_batches;
CREATE POLICY "Finance can manage import batches"
  ON import_batches FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- 2. import_errors
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
      SELECT id FROM import_batches
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    batch_id IN (
      SELECT id FROM import_batches
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 3. cash_transfers
DROP POLICY IF EXISTS "Users can view cash transfers" ON cash_transfers;
CREATE POLICY "Users can view cash transfers"
  ON cash_transfers FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage cash transfers" ON cash_transfers;
CREATE POLICY "Finance can manage cash transfers"
  ON cash_transfers FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

-- 4. cash_payments
DROP POLICY IF EXISTS "Users can view cash payments" ON cash_payments;
CREATE POLICY "Users can view cash payments"
  ON cash_payments FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage cash payments" ON cash_payments;
CREATE POLICY "Finance can manage cash payments"
  ON cash_payments FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

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
    cash_advance_id IN (
      SELECT id FROM cash_advances WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage advance settlements" ON advance_settlements;
CREATE POLICY "Finance can manage advance settlements"
  ON advance_settlements FOR ALL
  USING (
    cash_advance_id IN (
      SELECT id FROM cash_advances
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    cash_advance_id IN (
      SELECT id FROM cash_advances
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 7. budget_items
DROP POLICY IF EXISTS "Users can view budget items" ON budget_items;
CREATE POLICY "Users can view budget items"
  ON budget_items FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM budget_versions
      WHERE project_id IN (
        SELECT id FROM projects WHERE organization_id = get_user_organization_id()
      )
    )
  );

DROP POLICY IF EXISTS "Finance can manage budget items" ON budget_items;
CREATE POLICY "Finance can manage budget items"
  ON budget_items FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budget_versions
      WHERE project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
      )
    )
  )
  WITH CHECK (
    budget_id IN (
      SELECT id FROM budget_versions
      WHERE project_id IN (
        SELECT id FROM projects
        WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
      )
    )
  );

-- 8. contracts
DROP POLICY IF EXISTS "Users can view contracts" ON contracts;
CREATE POLICY "Users can view contracts"
  ON contracts FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage contracts" ON contracts;
CREATE POLICY "Finance can manage contracts"
  ON contracts FOR ALL
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 9. commitment_items
DROP POLICY IF EXISTS "Users can view commitment items" ON commitment_items;
CREATE POLICY "Users can view commitment items"
  ON commitment_items FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Finance can manage commitment items" ON commitment_items;
CREATE POLICY "Finance can manage commitment items"
  ON commitment_items FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 10. invoice_items
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
      SELECT id FROM invoices
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 11. invoice_allocations
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
      SELECT id FROM invoices
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );

-- 12. invoice_payments
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
      SELECT id FROM invoices
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = get_user_organization_id() AND is_owner_or_finance()
    )
  );
