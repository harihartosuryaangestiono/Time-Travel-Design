DROP POLICY IF EXISTS "Finance can update projects" ON public.projects;
DROP POLICY IF EXISTS "Finance and PM can update projects" ON public.projects;

CREATE POLICY "Finance and PM can update projects"
  ON public.projects FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('OWNER', 'FINANCE', 'PROJECT_MANAGER')
  );

NOTIFY pgrst, 'reload schema';
