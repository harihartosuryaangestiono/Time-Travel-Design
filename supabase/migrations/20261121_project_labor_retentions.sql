-- TimeTravelDesign Finance - Project Labor Retentions Migration
-- Migration: 20261121_project_labor_retentions.sql

CREATE TABLE IF NOT EXISTS public.project_labor_retentions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mandor_name text NOT NULL,
  termin_number integer NOT NULL DEFAULT 1,
  claim_date timestamptz NOT NULL DEFAULT now(),
  total_claim numeric(15, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(15, 2) NOT NULL DEFAULT 0,
  retention_amount numeric(15, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'HELD', -- HELD | PAID | LUNAS
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proj_labor_retentions_org_proj_idx ON public.project_labor_retentions (organization_id, project_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.project_labor_retentions ENABLE ROW LEVEL SECURITY;

-- POLICIES
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Org members view project_labor_retentions" ON public.project_labor_retentions';
  EXECUTE 'CREATE POLICY "Org members view project_labor_retentions" ON public.project_labor_retentions FOR SELECT USING (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org staff manage project_labor_retentions" ON public.project_labor_retentions';
  EXECUTE 'CREATE POLICY "Org staff manage project_labor_retentions" ON public.project_labor_retentions FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';
END $$;
