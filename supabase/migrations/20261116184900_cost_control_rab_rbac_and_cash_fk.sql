BEGIN;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_cash_account_id_fkey
  FOREIGN KEY (cash_account_id)
  REFERENCES public.cash_accounts(id)
  ON DELETE SET NULL
  NOT VALID;

DROP POLICY IF EXISTS "Org members view rab_projects" ON public.rab_projects;
DROP POLICY IF EXISTS "Org staff manage rab_projects" ON public.rab_projects;

CREATE POLICY "Org members view rab_projects"
  ON public.rab_projects FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Authorized members create rab_projects"
  ON public.rab_projects FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.projects project
      WHERE project.id = rab_projects.project_id
        AND project.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Authorized members update editable rab_projects"
  ON public.rab_projects FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND status <> 'APPROVED'
    AND NOT is_locked
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.projects project
      WHERE project.id = rab_projects.project_id
        AND project.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Owners and project managers delete editable rab_projects"
  ON public.rab_projects FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'PROJECT_MANAGER')
    AND status <> 'APPROVED'
    AND NOT is_locked
  );

DROP POLICY IF EXISTS "Org members view rab_items" ON public.rab_items;
DROP POLICY IF EXISTS "Org staff manage rab_items" ON public.rab_items;

CREATE POLICY "Org members view rab_items"
  ON public.rab_items FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1
      FROM public.rab_projects rab
      WHERE rab.id = rab_items.rab_id
        AND rab.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Authorized members create rab_items"
  ON public.rab_items FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.rab_projects rab
      WHERE rab.id = rab_items.rab_id
        AND rab.organization_id = get_user_organization_id()
        AND rab.status <> 'APPROVED'
        AND NOT rab.is_locked
    )
  );

CREATE POLICY "Authorized members update editable rab_items"
  ON public.rab_items FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.rab_projects rab
      WHERE rab.id = rab_items.rab_id
        AND rab.organization_id = get_user_organization_id()
        AND rab.status <> 'APPROVED'
        AND NOT rab.is_locked
    )
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.rab_projects rab
      WHERE rab.id = rab_items.rab_id
        AND rab.organization_id = get_user_organization_id()
        AND rab.status <> 'APPROVED'
        AND NOT rab.is_locked
    )
  );

CREATE POLICY "Authorized members delete editable rab_items"
  ON public.rab_items FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.rab_projects rab
      WHERE rab.id = rab_items.rab_id
        AND rab.organization_id = get_user_organization_id()
        AND rab.status <> 'APPROVED'
        AND NOT rab.is_locked
    )
  );

DROP POLICY IF EXISTS "Org members view rab_item_components" ON public.rab_item_components;
DROP POLICY IF EXISTS "Org staff manage rab_item_components" ON public.rab_item_components;

CREATE POLICY "Org members view rab_item_components"
  ON public.rab_item_components FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rab_items item
      JOIN public.rab_projects rab ON rab.id = item.rab_id
      WHERE item.id = rab_item_components.rab_item_id
        AND item.organization_id = get_user_organization_id()
        AND rab.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Authorized members manage editable rab_item_components"
  ON public.rab_item_components FOR ALL
  USING (
    get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.rab_items item
      JOIN public.rab_projects rab ON rab.id = item.rab_id
      WHERE item.id = rab_item_components.rab_item_id
        AND item.organization_id = get_user_organization_id()
        AND rab.organization_id = get_user_organization_id()
        AND rab.status <> 'APPROVED'
        AND NOT rab.is_locked
    )
  )
  WITH CHECK (
    get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
    AND EXISTS (
      SELECT 1
      FROM public.rab_items item
      JOIN public.rab_projects rab ON rab.id = item.rab_id
      WHERE item.id = rab_item_components.rab_item_id
        AND item.organization_id = get_user_organization_id()
        AND rab.organization_id = get_user_organization_id()
        AND rab.status <> 'APPROVED'
        AND NOT rab.is_locked
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
