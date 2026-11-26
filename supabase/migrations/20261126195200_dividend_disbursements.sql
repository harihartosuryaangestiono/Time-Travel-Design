BEGIN;

CREATE TABLE IF NOT EXISTS public.dividend_disbursements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cash_account_id text NOT NULL REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
  recipient_name text NOT NULL,
  date timestamptz NOT NULL,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  reference text,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dividend_disbursements_org_account_date
  ON public.dividend_disbursements (organization_id, cash_account_id, date);

ALTER TABLE public.dividend_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view dividend disbursements"
  ON public.dividend_disbursements;
CREATE POLICY "Organization members can view dividend disbursements"
  ON public.dividend_disbursements FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Finance can manage dividend disbursements"
  ON public.dividend_disbursements;
CREATE POLICY "Finance can manage dividend disbursements"
  ON public.dividend_disbursements FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_owner_or_finance()
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
