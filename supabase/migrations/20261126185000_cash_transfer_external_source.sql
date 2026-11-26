BEGIN;

ALTER TABLE public.cash_transfers
  ADD COLUMN IF NOT EXISTS from_account_name text;

ALTER TABLE public.cash_transfers
  ALTER COLUMN from_account_id DROP NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
