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
  account.code,
  account.name,
  'ASSET',
  'DEBIT',
  true,
  false
FROM public.organizations AS organization
CROSS JOIN (
  VALUES
    ('1510', 'Renovasi Kantor'),
    ('1520', 'Legalitas Perusahaan'),
    ('1530', 'Inventaris')
) AS account(code, name)
ON CONFLICT (organization_id, code)
DO UPDATE SET is_active = true;
