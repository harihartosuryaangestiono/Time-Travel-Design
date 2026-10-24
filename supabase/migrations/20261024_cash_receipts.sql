CREATE TABLE IF NOT EXISTS public.cash_receipts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cash_account_id text NOT NULL REFERENCES public.cash_accounts(id) ON DELETE RESTRICT,
  date timestamptz NOT NULL,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Pemasukan Lainnya',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_org_account_date
  ON public.cash_receipts (organization_id, cash_account_id, date);

ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_receipts_org_access" ON public.cash_receipts;
CREATE POLICY "cash_receipts_org_access" ON public.cash_receipts
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = auth.uid()::text
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = auth.uid()::text
    )
  );

NOTIFY pgrst, 'reload schema';
