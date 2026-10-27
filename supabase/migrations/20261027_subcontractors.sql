CREATE TABLE IF NOT EXISTS public.subcontractors (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subcontractors_org_name_idx
  ON public.subcontractors (organization_id, name);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view subcontractors" ON public.subcontractors;
CREATE POLICY "Organization members can view subcontractors"
  ON public.subcontractors FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage subcontractors" ON public.subcontractors;
CREATE POLICY "Finance can manage subcontractors"
  ON public.subcontractors FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

ALTER TABLE public.subcontractor_contracts
  ADD COLUMN IF NOT EXISTS subcontractor_id text
  REFERENCES public.subcontractors(id) ON DELETE RESTRICT;

INSERT INTO public.subcontractors (id, organization_id, name, email, phone, address)
SELECT DISTINCT ON (v.id)
  v.id,
  v.organization_id,
  v.name,
  v.email,
  v.phone,
  v.address
FROM public.subcontractor_contracts sc
JOIN public.vendors v ON v.id = sc.vendor_id
ON CONFLICT (id) DO NOTHING;

UPDATE public.subcontractor_contracts
SET subcontractor_id = vendor_id
WHERE subcontractor_id IS NULL;

ALTER TABLE public.subcontractor_contracts
  ALTER COLUMN subcontractor_id SET NOT NULL,
  DROP COLUMN vendor_id;

CREATE INDEX IF NOT EXISTS subcontractor_contracts_org_subcontractor_idx
  ON public.subcontractor_contracts (organization_id, subcontractor_id);
