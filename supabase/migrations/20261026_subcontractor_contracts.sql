CREATE TABLE IF NOT EXISTS public.subcontractor_contracts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  description text NOT NULL,
  contract_amount numeric(15, 2) NOT NULL CHECK (contract_amount > 0),
  created_by text NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subcontractor_contracts_org_project_idx
  ON public.subcontractor_contracts (organization_id, project_id);

ALTER TABLE public.subcontractor_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view subcontractor contracts" ON public.subcontractor_contracts;
CREATE POLICY "Organization members can view subcontractor contracts"
  ON public.subcontractor_contracts FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage subcontractor contracts" ON public.subcontractor_contracts;
CREATE POLICY "Finance can manage subcontractor contracts"
  ON public.subcontractor_contracts FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS subcontractor_contract_id text
  REFERENCES public.subcontractor_contracts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS expenses_subcontractor_contract_idx
  ON public.expenses (subcontractor_contract_id)
  WHERE subcontractor_contract_id IS NOT NULL;
