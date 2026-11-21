-- TimeTravelDesign Finance - Mandor Labor Rates Dynamic Range Migration
-- Migration: 20261121_mandor_labor_rates.sql

CREATE TABLE IF NOT EXISTS public.mandor_labor_rates (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  labor_rate_id text NOT NULL REFERENCES public.labor_rates(id) ON DELETE CASCADE,
  subcontractor_id text REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  mandor_name text NOT NULL,
  rate numeric(15, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mandor_labor_rates_org_rate_idx ON public.mandor_labor_rates (organization_id, labor_rate_id);
CREATE INDEX IF NOT EXISTS mandor_labor_rates_mandor_name_idx ON public.mandor_labor_rates (organization_id, mandor_name);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.mandor_labor_rates ENABLE ROW LEVEL SECURITY;

-- POLICIES
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Org members view mandor_labor_rates" ON public.mandor_labor_rates';
  EXECUTE 'CREATE POLICY "Org members view mandor_labor_rates" ON public.mandor_labor_rates FOR SELECT USING (organization_id = get_user_organization_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Org staff manage mandor_labor_rates" ON public.mandor_labor_rates';
  EXECUTE 'CREATE POLICY "Org staff manage mandor_labor_rates" ON public.mandor_labor_rates FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id())';
END $$;
