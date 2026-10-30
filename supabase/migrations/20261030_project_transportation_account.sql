INSERT INTO public.accounts (
  id,
  organization_id,
  code,
  name,
  type,
  normal_balance,
  is_active,
  is_system
)
SELECT
  gen_random_uuid()::text,
  organization.id,
  '5400',
  'Transportasi Lapangan',
  'COST_OF_SALES',
  'DEBIT',
  true,
  false
FROM public.organizations AS organization
WHERE NOT EXISTS (
  SELECT 1
  FROM public.accounts AS account
  WHERE account.organization_id = organization.id
    AND account.code = '5400'
)
ON CONFLICT (organization_id, code) DO NOTHING;
