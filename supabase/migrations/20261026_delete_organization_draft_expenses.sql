CREATE OR REPLACE FUNCTION public.delete_organization_draft_expenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id text;
  v_deleted_count integer;
BEGIN
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL OR NOT is_owner_or_finance() THEN
    RAISE EXCEPTION 'Only organization owners or finance members can delete draft expenses';
  END IF;

  DELETE FROM expense_allocations
  WHERE expense_id IN (
    SELECT id
    FROM expenses
    WHERE organization_id = v_org_id
      AND status = 'DRAFT'
  );

  DELETE FROM expenses
  WHERE organization_id = v_org_id
    AND status = 'DRAFT';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organization_draft_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_organization_draft_expenses() TO authenticated;
