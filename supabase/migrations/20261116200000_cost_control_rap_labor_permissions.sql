BEGIN;

CREATE OR REPLACE FUNCTION public.create_rap_from_rab(
  p_rab_id text,
  p_rap_number text,
  p_target_savings_percent numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_organization_id text;
  v_profile_id text;
  v_role text;
  v_rab public.rab_projects%ROWTYPE;
  v_rap public.rap_projects%ROWTYPE;
  v_multiplier numeric;
  v_version integer;
  v_total_budget numeric(15, 2);
BEGIN
  v_organization_id := get_user_organization_id();
  v_profile_id := auth.uid()::text;
  v_role := get_user_role();

  IF v_organization_id IS NULL OR v_profile_id IS NULL
     OR v_role NOT IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER') THEN
    RAISE EXCEPTION 'Unauthorized to create RAP';
  END IF;
  IF NULLIF(trim(p_rap_number), '') IS NULL
     OR p_target_savings_percent IS NULL
     OR p_target_savings_percent < 0 OR p_target_savings_percent > 30 THEN
    RAISE EXCEPTION 'Invalid RAP number or target savings percentage';
  END IF;

  SELECT * INTO v_rab
  FROM public.rab_projects
  WHERE id = p_rab_id
    AND organization_id = v_organization_id
    AND status = 'APPROVED'
    AND is_locked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAP requires an approved and locked RAB in this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.rab_items
    WHERE rab_id = v_rab.id AND organization_id = v_organization_id
  ) THEN
    RAISE EXCEPTION 'RAB must contain at least one item';
  END IF;

  v_multiplier := 1 - (p_target_savings_percent / 100);
  SELECT COALESCE(SUM(
    ROUND((
      ROUND(material_unit_cost * v_multiplier, 2)
      + ROUND(labor_unit_cost * v_multiplier, 2)
      + ROUND(equipment_unit_cost * v_multiplier, 2)
    ) * volume, 2)
  ), 0)
  INTO v_total_budget
  FROM public.rab_items
  WHERE rab_id = v_rab.id AND organization_id = v_organization_id;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_version
  FROM public.rap_projects
  WHERE organization_id = v_organization_id AND project_id = v_rab.project_id;

  INSERT INTO public.rap_projects (
    organization_id, project_id, rab_id, rap_number, title, version, status,
    total_planned_budget, target_savings, notes, created_by
  ) VALUES (
    v_organization_id, v_rab.project_id, v_rab.id, trim(p_rap_number),
    'RAP - ' || v_rab.title, v_version, 'DRAFT', v_total_budget,
    GREATEST(0, v_rab.total_hpp - v_total_budget),
    'Diturunkan dari ' || v_rab.rab_number || ' dengan target efisiensi '
      || p_target_savings_percent || '%',
    v_profile_id
  )
  RETURNING * INTO v_rap;

  INSERT INTO public.rap_items (
    rap_id, rab_item_id, division, sub_division, item_name, unit, volume,
    target_material_cost, target_labor_cost, target_equipment_cost,
    target_unit_price, total_budget, procurement_schedule, execution_schedule,
    pic_name, sort_order
  )
  SELECT
    v_rap.id,
    item.id,
    item.division,
    item.sub_division,
    item.item_name,
    item.unit,
    item.volume,
    ROUND(item.material_unit_cost * v_multiplier, 2),
    ROUND(item.labor_unit_cost * v_multiplier, 2),
    ROUND(item.equipment_unit_cost * v_multiplier, 2),
    ROUND(item.material_unit_cost * v_multiplier, 2)
      + ROUND(item.labor_unit_cost * v_multiplier, 2)
      + ROUND(item.equipment_unit_cost * v_multiplier, 2),
    ROUND((
      ROUND(item.material_unit_cost * v_multiplier, 2)
      + ROUND(item.labor_unit_cost * v_multiplier, 2)
      + ROUND(item.equipment_unit_cost * v_multiplier, 2)
    ) * item.volume, 2),
    'Minggu ke-1 s/d ke-2',
    'Sesuai milestone',
    'Site Manager',
    item.sort_order
  FROM public.rab_items item
  WHERE item.rab_id = v_rab.id
    AND item.organization_id = v_organization_id;

  RETURN to_jsonb(v_rap);
END;
$$;

REVOKE ALL ON FUNCTION public.create_rap_from_rab(text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_rap_from_rab(text, text, numeric) TO authenticated;

DROP POLICY IF EXISTS "Org staff manage labor_rates" ON public.labor_rates;
DROP POLICY IF EXISTS "Org members view labor_rates" ON public.labor_rates;
DROP POLICY IF EXISTS "Org staff manage labor_rate_history" ON public.labor_rate_history;
DROP POLICY IF EXISTS "Org members view labor_rate_history" ON public.labor_rate_history;
DROP POLICY IF EXISTS "Org staff manage project_labor_items" ON public.project_labor_items;
DROP POLICY IF EXISTS "Org members view project_labor_items" ON public.project_labor_items;
DROP POLICY IF EXISTS "Org staff manage labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Org members view labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Org members view rap_projects" ON public.rap_projects;
DROP POLICY IF EXISTS "Org staff manage rap_projects" ON public.rap_projects;
DROP POLICY IF EXISTS "Org members view rap_items" ON public.rap_items;
DROP POLICY IF EXISTS "Org members view master_ahsp_components" ON public.master_ahsp_components;
DROP POLICY IF EXISTS "Org staff manage master_ahsp_components" ON public.master_ahsp_components;
DROP POLICY IF EXISTS "Authorized members manage labor_rates" ON public.labor_rates;
DROP POLICY IF EXISTS "Authorized members create labor_rate_history" ON public.labor_rate_history;
DROP POLICY IF EXISTS "Authorized members manage project_labor_items" ON public.project_labor_items;
DROP POLICY IF EXISTS "Authorized members submit labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Authorized members process labor_claims" ON public.labor_claims;
DROP POLICY IF EXISTS "Authorized members create rap_projects" ON public.rap_projects;
DROP POLICY IF EXISTS "Authorized members update draft rap_projects" ON public.rap_projects;
DROP POLICY IF EXISTS "Authorized members delete draft rap_projects" ON public.rap_projects;
DROP POLICY IF EXISTS "Org members view rap_items" ON public.rap_items;
DROP POLICY IF EXISTS "Authorized members manage draft rap_items" ON public.rap_items;
DROP POLICY IF EXISTS "Authorized members manage master_ahsp_components" ON public.master_ahsp_components;

CREATE POLICY "Org members view labor_rates"
  ON public.labor_rates FOR SELECT
  USING (organization_id = get_user_organization_id());
CREATE POLICY "Authorized members manage labor_rates"
  ON public.labor_rates FOR ALL
  USING (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER'))
  WITH CHECK (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER'));

CREATE POLICY "Org members view labor_rate_history"
  ON public.labor_rate_history FOR SELECT
  USING (organization_id = get_user_organization_id());
CREATE POLICY "Authorized members create labor_rate_history"
  ON public.labor_rate_history FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER'));

CREATE POLICY "Org members view master_ahsp_components"
  ON public.master_ahsp_components FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.master_ahsp ahsp
    WHERE ahsp.id = master_ahsp_components.ahsp_id
      AND ahsp.organization_id = get_user_organization_id()
  ));
CREATE POLICY "Authorized members manage master_ahsp_components"
  ON public.master_ahsp_components FOR ALL
  USING (get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.master_ahsp ahsp
      WHERE ahsp.id = master_ahsp_components.ahsp_id
        AND ahsp.organization_id = get_user_organization_id()
    ))
  WITH CHECK (get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.master_ahsp ahsp
      WHERE ahsp.id = master_ahsp_components.ahsp_id
        AND ahsp.organization_id = get_user_organization_id()
    ));

CREATE POLICY "Org members view project_labor_items"
  ON public.project_labor_items FOR SELECT
  USING (organization_id = get_user_organization_id());
CREATE POLICY "Authorized members manage project_labor_items"
  ON public.project_labor_items FOR ALL
  USING (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_labor_items.project_id
        AND project.organization_id = get_user_organization_id()
    ))
  WITH CHECK (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = project_labor_items.project_id
        AND project.organization_id = get_user_organization_id()
    ));

CREATE POLICY "Org members view labor_claims"
  ON public.labor_claims FOR SELECT
  USING (organization_id = get_user_organization_id());
CREATE POLICY "Authorized members submit labor_claims"
  ON public.labor_claims FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER', 'SITE_STAFF')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = labor_claims.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.project_labor_items item
      WHERE item.id = labor_claims.labor_item_id
        AND item.project_id = labor_claims.project_id
        AND item.organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "Authorized members process labor_claims"
  ON public.labor_claims FOR UPDATE
  USING (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER'))
  WITH CHECK (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER'));

CREATE POLICY "Org members view rap_projects"
  ON public.rap_projects FOR SELECT
  USING (organization_id = get_user_organization_id());
CREATE POLICY "Authorized members create rap_projects"
  ON public.rap_projects FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = rap_projects.project_id
        AND project.organization_id = get_user_organization_id()
    )
    AND (rab_id IS NULL OR EXISTS (
      SELECT 1 FROM public.rab_projects rab
      WHERE rab.id = rap_projects.rab_id
        AND rab.organization_id = get_user_organization_id()
        AND rab.project_id = rap_projects.project_id
        AND rab.status = 'APPROVED'
        AND rab.is_locked
    ))
  );
CREATE POLICY "Authorized members update draft rap_projects"
  ON public.rap_projects FOR UPDATE
  USING (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND status = 'DRAFT')
  WITH CHECK (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND status = 'DRAFT');
CREATE POLICY "Authorized members delete draft rap_projects"
  ON public.rap_projects FOR DELETE
  USING (organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'PROJECT_MANAGER')
    AND status = 'DRAFT');

CREATE POLICY "Org members view rap_items"
  ON public.rap_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rap_projects rap
    WHERE rap.id = rap_items.rap_id
      AND rap.organization_id = get_user_organization_id()
  ));
CREATE POLICY "Authorized members manage draft rap_items"
  ON public.rap_items FOR ALL
  USING (get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.rap_projects rap
      WHERE rap.id = rap_items.rap_id
        AND rap.organization_id = get_user_organization_id()
        AND rap.status = 'DRAFT'
    ))
  WITH CHECK (get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1 FROM public.rap_projects rap
      WHERE rap.id = rap_items.rap_id
        AND rap.organization_id = get_user_organization_id()
        AND rap.status = 'DRAFT'
    ));

COMMIT;

NOTIFY pgrst, 'reload schema';
