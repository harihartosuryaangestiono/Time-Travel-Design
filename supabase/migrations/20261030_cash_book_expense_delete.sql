DROP POLICY IF EXISTS "Finance can delete expenses" ON public.expenses;
CREATE POLICY "Finance can delete expenses"
  ON public.expenses FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );
