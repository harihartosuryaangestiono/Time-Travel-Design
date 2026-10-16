-- Setup Admin/Owner Account
-- Run this SQL in Supabase SQL Editor after creating a user via Supabase Auth

-- 1. First, create the user in Supabase Auth Dashboard:
--    - Go to Authentication > Users
--    - Click "Add User"
--    - Enter email and password
--    - Click "Create User"

-- 2. Get the user ID from the auth.users table
--    SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- 3. Create the organization
-- INSERT INTO organizations (name, address, email)
-- VALUES ('TimeTravelDesign', 'Jl. Arsitektur No. 123, Jakarta', 'info@timetraveldesign.com')
-- RETURNING id;

-- 4. Create the profile
-- INSERT INTO profiles (id, email, full_name)
-- VALUES ('your-user-uuid', 'your-email@example.com', 'Admin User');

-- 5. Create organization settings
-- INSERT INTO organization_settings (organization_id)
-- VALUES ('your-organization-uuid');

-- 6. Create organization member with OWNER role
-- INSERT INTO organization_members (organization_id, profile_id, role, approval_limit)
-- VALUES ('your-organization-uuid', 'your-user-uuid', 'OWNER', 100000000);

-- 7. Create default chart of accounts
-- INSERT INTO accounts (organization_id, code, name, type, normal_balance, is_system)
-- VALUES
--   ('your-organization-uuid', '1100', 'Kas', 'ASSET', 'DEBIT', true),
--   ('your-organization-uuid', '1110', 'Bank BCA', 'ASSET', 'DEBIT', false),
--   ('your-organization-uuid', '1200', 'Piutang Usaha', 'ASSET', 'DEBIT', false),
--   ('your-organization-uuid', '1300', 'Piutang Karyawan', 'ASSET', 'DEBIT', false),
--   ('your-organization-uuid', '2100', 'Hutang Usaha', 'LIABILITY', 'CREDIT', true),
--   ('your-organization-uuid', '3100', 'Modal', 'EQUITY', 'CREDIT', true),
--   ('your-organization-uuid', '4100', 'Pendapatan Jasa', 'REVENUE', 'CREDIT', false),
--   ('your-organization-uuid', '5100', 'Biaya Material', 'COST_OF_SALES', 'DEBIT', false),
--   ('your-organization-uuid', '6100', 'Beban Gaji', 'EXPENSE', 'DEBIT', false),
--   ('your-organization-uuid', '6200', 'Beban Operasional', 'EXPENSE', 'DEBIT', false);

-- 8. Create default cash account
-- INSERT INTO cash_accounts (organization_id, name, type, opening_balance, opening_date)
-- VALUES ('your-organization-uuid', 'Bank BCA - Utama', 'BANK', 0, CURRENT_DATE);

-- 9. Create default accounting period
-- INSERT INTO accounting_periods (organization_id, name, start_date, end_date)
-- VALUES
--   ('your-organization-uuid', 'January 2024', '2024-01-01', '2024-01-31'),
--   ('your-organization-uuid', 'February 2024', '2024-02-01', '2024-02-29'),
--   ('your-organization-uuid', 'March 2024', '2024-03-01', '2024-03-31');

-- Example setup commands:
-- Replace these values with your actual UUIDs

/*
-- Step 1: Get the user ID
-- SELECT id FROM auth.users WHERE email = 'admin@timetraveldesign.com';

-- Step 2: Create organization
-- INSERT INTO organizations (name, address, email)
-- VALUES ('TimeTravelDesign', 'Jl. Arsitektur No. 123, Jakarta Selatan', 'info@timetraveldesign.com')
-- RETURNING id;
-- Let's say it returns: 11111111-1111-1111-1111-111111111111

-- Step 3: Create profile
-- INSERT INTO profiles (id, email, full_name)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'admin@timetraveldesign.com', 'Administrator');

-- Step 4: Create organization settings
-- INSERT INTO organization_settings (organization_id)
-- VALUES ('11111111-1111-1111-1111-111111111111');

-- Step 5: Create owner membership
-- INSERT INTO organization_members (organization_id, profile_id, role, approval_limit)
-- VALUES ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'OWNER', 100000000);
*/
