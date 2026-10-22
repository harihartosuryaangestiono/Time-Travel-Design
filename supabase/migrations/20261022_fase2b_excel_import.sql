-- Migration: 20261022_fase2b_excel_import.sql
-- Fase 2B: Impor Data & Alur Dari Excel (Laporan_Keuangan_2026.xlsx)

-- 1. Tabel Pemasukan / Termin Klien Proyek (Basis Kas)
CREATE TABLE IF NOT EXISTS project_revenues (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cash_account_id TEXT REFERENCES cash_accounts(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    description TEXT NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'MANUAL', -- 'MANUAL' | 'IMPORT_EXCEL'
    external_ref VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_revenues_org ON project_revenues(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_revenues_proj ON project_revenues(project_id);

-- Enable RLS pada project_revenues
ALTER TABLE project_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_revenues_org_access" ON project_revenues
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE profile_id = auth.uid()::text
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE profile_id = auth.uid()::text
        )
    );

-- 2. Tambah kolom pendukung di tabel expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS external_ref VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS needs_category BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_ext_ref ON expenses(external_ref);

-- 3. Tambah kolom pendukung di cash_advances
ALTER TABLE cash_advances
ADD COLUMN IF NOT EXISTS external_ref VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS is_opening_balance BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS idx_cash_advances_ext_ref ON cash_advances(external_ref);
