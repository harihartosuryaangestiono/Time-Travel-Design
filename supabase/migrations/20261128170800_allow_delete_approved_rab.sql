BEGIN;

DROP POLICY IF EXISTS "Owners and project managers delete editable rab_projects"
  ON public.rab_projects;

CREATE POLICY "Owners and project managers delete rab_projects"
  ON public.rab_projects FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'PROJECT_MANAGER')
  );

COMMIT;
