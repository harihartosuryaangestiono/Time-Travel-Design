-- ============================================
-- TimeTravelDesign Finance - RLS Fix for Onboarding
-- ============================================
-- Tambahan policy untuk onboarding flow
-- Jalankan di Supabase SQL Editor

-- ============================================
-- ORGANIZATIONS - Allow authenticated users to create organizations
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- ============================================
-- ORGANIZATION_SETTINGS - Allow creation during onboarding
-- ============================================
DROP POLICY IF EXISTS "Users can create organization settings" ON organization_settings;
CREATE POLICY "Users can create organization settings"
  ON organization_settings FOR INSERT
  WITH CHECK (true);

-- ============================================
-- PROFILES - Allow insert during signup
-- ============================================
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid()::text);

-- Allow profile update
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid()::text);

-- ============================================
-- ORGANIZATION_MEMBERS - Allow owner creation during onboarding
-- ============================================
-- Note: This should be done carefully - users should only be able to add themselves
DROP POLICY IF EXISTS "Users can create own membership" ON organization_members;
CREATE POLICY "Users can create own membership"
  ON organization_members FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

-- Allow users to view their own memberships
DROP POLICY IF EXISTS "Users can view own memberships" ON organization_members;
CREATE POLICY "Users can view own memberships"
  ON organization_members FOR SELECT
  USING (profile_id = auth.uid()::text);

-- ============================================
-- ACCOUNTS - Allow owner to create default accounts
-- ============================================
DROP POLICY IF EXISTS "Owners can manage accounts" ON accounts;
CREATE POLICY "Owners can manage accounts"
  ON accounts FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text AND role = 'OWNER'
    )
  );

-- ============================================
-- CASH_ACCOUNTS - Allow owner to create default accounts
-- ============================================
DROP POLICY IF EXISTS "Owners can manage cash accounts" ON cash_accounts;
CREATE POLICY "Owners can manage cash accounts"
  ON cash_accounts FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text AND role = 'OWNER'
    )
  );

-- ============================================
-- ACCOUNTING_PERIODS - Allow owner to create periods
-- ============================================
DROP POLICY IF EXISTS "Owners can manage accounting periods" ON accounting_periods;
CREATE POLICY "Owners can manage accounting periods"
  ON accounting_periods FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text AND role = 'OWNER'
    )
  );

-- ============================================
-- VENDORS - Allow owner/finance to manage
-- ============================================
DROP POLICY IF EXISTS "Users can view vendors in their organization" ON vendors;
CREATE POLICY "Users can view vendors in their organization"
  ON vendors FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Owners can manage vendors" ON vendors;
CREATE POLICY "Owners can manage vendors"
  ON vendors FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text AND role IN ('OWNER', 'FINANCE')
    )
  );

-- ============================================
-- CLIENTS - Allow owner/finance to manage
-- ============================================
DROP POLICY IF EXISTS "Users can view clients in their organization" ON clients;
CREATE POLICY "Users can view clients in their organization"
  ON clients FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Owners can manage clients" ON clients;
CREATE POLICY "Owners can manage clients"
  ON clients FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE profile_id = auth.uid()::text AND role IN ('OWNER', 'FINANCE')
    )
  );

-- ============================================
-- Verify policies are in place
-- ============================================
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
