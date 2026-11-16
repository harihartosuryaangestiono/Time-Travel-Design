BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS project_progress_records_project_sched_week_uidx
  ON public.project_progress_records (project_id, schedule_id, period_week);

ALTER TABLE public.labor_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_ahsp_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rab_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rap_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Org staff manage labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Eligible members submit labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Approvers manage labor_claims" ON public.labor_claims;
CREATE POLICY "Org members view labor_claims"
  ON public.labor_claims FOR SELECT
  USING (organization_id = get_user_organization_id());
CREATE POLICY "Eligible members submit labor_claims"
  ON public.labor_claims FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF')
  );
CREATE POLICY "Approvers manage labor_claims"
  ON public.labor_claims FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  );

DROP POLICY IF EXISTS "Org members view master_ahsp_components" ON public.master_ahsp_components;
DROP POLICY IF EXISTS "Org staff manage master_ahsp_components" ON public.master_ahsp_components;
CREATE POLICY "Org members view master_ahsp_components"
  ON public.master_ahsp_components FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.master_ahsp parent
      WHERE parent.id = master_ahsp_components.ahsp_id
        AND parent.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Org staff manage master_ahsp_components"
  ON public.master_ahsp_components FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.master_ahsp parent
      WHERE parent.id = master_ahsp_components.ahsp_id
        AND parent.organization_id = get_user_organization_id()
    )
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.master_ahsp parent
      WHERE parent.id = master_ahsp_components.ahsp_id
        AND parent.organization_id = get_user_organization_id()
    )
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  );

DROP POLICY IF EXISTS "Org members view rab_item_components" ON public.rab_item_components;
DROP POLICY IF EXISTS "Org staff manage rab_item_components" ON public.rab_item_components;
CREATE POLICY "Org members view rab_item_components"
  ON public.rab_item_components FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rab_items parent
      WHERE parent.id = rab_item_components.rab_item_id
        AND parent.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Org staff manage rab_item_components"
  ON public.rab_item_components FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.rab_items parent
      WHERE parent.id = rab_item_components.rab_item_id
        AND parent.organization_id = get_user_organization_id()
    )
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rab_items parent
      WHERE parent.id = rab_item_components.rab_item_id
        AND parent.organization_id = get_user_organization_id()
    )
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  );

DROP POLICY IF EXISTS "Org members view rap_items" ON public.rap_items;
DROP POLICY IF EXISTS "Org staff manage rap_items" ON public.rap_items;
CREATE POLICY "Org members view rap_items"
  ON public.rap_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rap_projects parent
      WHERE parent.id = rap_items.rap_id
        AND parent.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Org staff manage rap_items"
  ON public.rap_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.rap_projects parent
      WHERE parent.id = rap_items.rap_id
        AND parent.organization_id = get_user_organization_id()
    )
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rap_projects parent
      WHERE parent.id = rap_items.rap_id
        AND parent.organization_id = get_user_organization_id()
    )
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
