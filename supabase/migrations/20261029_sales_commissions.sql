CREATE TABLE IF NOT EXISTS public.sales_persons (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_persons_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS sales_persons_org_name_idx
  ON public.sales_persons (organization_id, name);

ALTER TABLE public.sales_persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view sales persons" ON public.sales_persons;
CREATE POLICY "Organization members can view sales persons"
  ON public.sales_persons FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage sales persons" ON public.sales_persons;
CREATE POLICY "Finance can manage sales persons"
  ON public.sales_persons FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

CREATE TABLE IF NOT EXISTS public.project_sales_assignments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sales_person_id text NOT NULL REFERENCES public.sales_persons(id) ON DELETE RESTRICT,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  commission_rate numeric(7, 4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_sales_assignments_person_project_unique UNIQUE (sales_person_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_sales_assignments_org_project_idx
  ON public.project_sales_assignments (organization_id, project_id);

CREATE INDEX IF NOT EXISTS project_sales_assignments_org_person_idx
  ON public.project_sales_assignments (organization_id, sales_person_id);

ALTER TABLE public.project_sales_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view project sales assignments" ON public.project_sales_assignments;
CREATE POLICY "Organization members can view project sales assignments"
  ON public.project_sales_assignments FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage project sales assignments" ON public.project_sales_assignments;
CREATE POLICY "Finance can manage project sales assignments"
  ON public.project_sales_assignments FOR ALL
  USING (organization_id = get_user_organization_id() AND is_owner_or_finance())
  WITH CHECK (organization_id = get_user_organization_id() AND is_owner_or_finance());

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS sales_person_id text
  REFERENCES public.sales_persons(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS expenses_sales_person_project_idx
  ON public.expenses (organization_id, sales_person_id, project_id)
  WHERE sales_person_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';