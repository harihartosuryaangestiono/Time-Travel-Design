-- Migration: 20261022_fase2_kasbon_reimbursement.sql
-- Fase 2: Peningkatan Kasbon (Karyawan & Mandor), Plafon, Pelunasan, Audit Logs, dan Upah Tukang

-- 1. Tambah kolom plafon pada profiles jika belum ada
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS max_advance_amount NUMERIC(15,2) DEFAULT 5000000;

-- 2. Tambah kolom plafon kasbon upah tukang per proyek pada tabel projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS labor_advance_limit NUMERIC(15,2) DEFAULT 0;

-- 3. Tabel master penerima kasbon (Advance Recipients: Karyawan, Owner, atau Mandor Proyek)
CREATE TABLE IF NOT EXISTS advance_recipients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE', -- 'EMPLOYEE' | 'MANDOR' | 'OWNER'
    profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    max_advance_amount NUMERIC(15,2) NOT NULL DEFAULT 5000000,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk performa query advance_recipients
CREATE INDEX IF NOT EXISTS idx_advance_recipients_org ON advance_recipients(organization_id);
CREATE INDEX IF NOT EXISTS idx_advance_recipients_project ON advance_recipients(project_id);

-- 4. Tambah kolom jenis kasbon, relasi penerima, dan approval di cash_advances
ALTER TABLE cash_advances
ADD COLUMN IF NOT EXISTS advance_type VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE', -- 'EMPLOYEE' | 'MANDOR'
ADD COLUMN IF NOT EXISTS recipient_id TEXT REFERENCES advance_recipients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS mandor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS wage_category VARCHAR(100) DEFAULT 'Upah Tukang',
ADD COLUMN IF NOT EXISTS approved_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS disbursed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL;

-- 5. Tambah kolom metode pelunasan pada advance_settlements
ALTER TABLE advance_settlements
ADD COLUMN IF NOT EXISTS settlement_method VARCHAR(30) NOT NULL DEFAULT 'EXPENSE', -- 'CASH' | 'INSTALLMENT' | 'PAYROLL_DEDUCTION' | 'EXPENSE'
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 6. Enable Row Level Security (RLS) pada advance_recipients
ALTER TABLE advance_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advance_recipients_org_access" ON advance_recipients
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
