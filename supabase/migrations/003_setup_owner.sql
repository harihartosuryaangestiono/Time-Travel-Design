-- ============================================
-- TimeTravelDesign Finance - Owner Setup Script
-- ============================================
-- INSTRUKSI:
-- 1. Buka Supabase Dashboard > SQL Editor
-- 2. Copy paste seluruh script ini
-- 3. Ganti nilai di bawah sesuai informasi Anda
-- ============================================

-- ============================================
-- KONFIGURASI: Ganti nilai berikut
-- ============================================
-- Ganti dengan email user yang sudah dibuat di Supabase Auth
-- (Authentication > Users > Add User > Buat user baru)
DO $$
DECLARE
  -- Ganti dengan email yang Anda gunakan untuk register/login
  v_user_email TEXT := 'YOUR_EMAIL@example.com';

  -- UUID user dari auth.users (akan dicari otomatis)
  v_user_id UUID;

  -- ID organisasi (akan dibuat otomatis jika belum ada)
  v_org_id UUID;

  -- Nama organisasi default
  v_org_name TEXT := 'TimeTravelDesign';
BEGIN
  -- Cari user berdasarkan email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_user_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User dengan email % belum ditemukan. Pastikan user sudah dibuat di Supabase Auth Dashboard.', v_user_email;
    RAISE NOTICE 'Langkah: Authentication > Users > Add User > Isi email & password > Create User';
    RETURN;
  END IF;

  RAISE NOTICE 'User ditemukan: % (%)', v_user_email, v_user_id;

  -- Buat organisasi jika belum ada
  INSERT INTO organizations (id, name, email)
  VALUES (gen_random_uuid(), v_org_name, 'info@timetraveldesign.com')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_org_id;

  -- Ambil org_id jika sudah ada
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE name = v_org_name LIMIT 1;
  END IF;

  RAISE NOTICE 'Organisasi: % (%)', v_org_name, v_org_id;

  -- Buat profile jika belum ada
  INSERT INTO profiles (id, email, full_name)
  VALUES (v_user_id, v_user_email, 'Owner')
  ON CONFLICT (id) DO NOTHING;

  -- Buat organization_settings jika belum ada
  INSERT INTO organization_settings (organization_id)
  VALUES (v_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Buat membership sebagai OWNER
  INSERT INTO organization_members (organization_id, profile_id, role, approval_limit)
  VALUES (v_org_id, v_user_id, 'OWNER', 100000000)
  ON CONFLICT (organization_id, profile_id) DO UPDATE SET role = 'OWNER', approval_limit = 100000000;

  RAISE NOTICE 'Membership dibuat: User % sekarang adalah OWNER di organisasi %', v_user_email, v_org_name;

  -- Buat chart of accounts default
  INSERT INTO accounts (organization_id, code, name, type, normal_balance, is_system)
  SELECT v_org_id, code, name, type, normal_balance, is_system
  FROM (VALUES
    ('1100', 'Kas', 'ASSET', 'DEBIT', true),
    ('1110', 'Bank BCA', 'ASSET', 'DEBIT', false),
    ('1120', 'Bank Mandiri', 'ASSET', 'DEBIT', false),
    ('1200', 'Piutang Usaha', 'ASSET', 'DEBIT', false),
    ('1300', 'Piutang Karyawan', 'ASSET', 'DEBIT', false),
    ('1400', 'Persediaan', 'ASSET', 'DEBIT', false),
    ('1500', 'Aset Tetap', 'ASSET', 'DEBIT', false),
    ('2100', 'Hutang Usaha', 'LIABILITY', 'CREDIT', true),
    ('2200', 'Hutang PPN', 'LIABILITY', 'CREDIT', true),
    ('2300', 'Hutang Pajak', 'LIABILITY', 'CREDIT', false),
    ('3100', 'Modal', 'EQUITY', 'CREDIT', true),
    ('3200', 'Laba Ditahan', 'EQUITY', 'CREDIT', false),
    ('4100', 'Pendapatan Jasa', 'REVENUE', 'CREDIT', true),
    ('4200', 'Pendapatan Lain', 'REVENUE', 'CREDIT', false),
    ('5100', 'Harga Pokok Penjualan', 'COST_OF_SALES', 'DEBIT', false),
    ('5200', 'Biaya Tenaga Kerja', 'EXPENSE', 'DEBIT', false),
    ('6100', 'Beban Gaji', 'EXPENSE', 'DEBIT', false),
    ('6200', 'Beban Operasional', 'EXPENSE', 'DEBIT', false),
    ('6300', 'Beban Utilities', 'EXPENSE', 'DEBIT', false),
    ('6400', 'Beban Transportasi', 'EXPENSE', 'DEBIT', false),
    ('6500', 'Beban Perlengkapan', 'EXPENSE', 'DEBIT', false),
    ('6600', 'Beban Asuransi', 'EXPENSE', 'DEBIT', false),
    ('6700', 'Beban Penyusutan', 'EXPENSE', 'DEBIT', false),
    ('6800', 'Beban Lainnya', 'EXPENSE', 'DEBIT', false)
  ) AS t(code, name, type, normal_balance, is_system)
  ON CONFLICT (organization_id, code) DO NOTHING;

  RAISE NOTICE 'Chart of accounts dibuat.';

  -- Buat cash account default
  INSERT INTO cash_accounts (organization_id, name, type, opening_balance, opening_date)
  VALUES (v_org_id, 'Kas Utama', 'CASH', 0, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- Buat accounting period tahun berjalan
  INSERT INTO accounting_periods (organization_id, name, start_date, end_date)
  VALUES (v_org_id, EXTRACT(YEAR FROM CURRENT_DATE)::TEXT, DATE_TRUNC('year', CURRENT_DATE), DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')
  ON CONFLICT (organization_id, start_date, end_date) DO NOTHING;

  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'SETUP BERHASIL!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Email: %', v_user_email;
  RAISE NOTICE 'Role: OWNER';
  RAISE NOTICE 'Organisasi: %', v_org_name;
  RAISE NOTICE '';
  RAISE NOTICE 'Silakan login di aplikasi.';

END $$;
