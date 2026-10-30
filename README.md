# TimeTravelDesign Finance

Sistem Manajemen Keuangan dan Akuntansi untuk Perusahaan Arsitektur dan Kontraktor.

## Fitur Utama

- **Manajemen Proyek** - Kelola proyek arsitektur, interior, dan konstruksi dengan RAB terperinci
- **Scan Struk & OCR** - Unggah foto struk dan ekstrak data otomatis
- **Kasbon Karyawan** - Kelola kasbon dan pertanggungjawabannya
- **Approval Workflow** - Alur persetujuan pengeluaran yang fleksibel
- **Akuntansi Double-Entry** - Mesin akuntansi lengkap dengan jurnal otomatis
- **Laporan Keuangan** - Laba rugi, neraca, arus kas, dan aging piutang
- **Multi-Proyek** - Kelola banyak proyek dengan alokasi biaya
- **Sales Person & Komisi** - Kelola penugasan sales per proyek, hitung komisi dari nilai kontrak, dan pantau pembayaran serta sisanya

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth
- **File Storage**: Supabase Storage
- **Deployment**: Vercel

## Setup

### 1. Clone dan Install

```bash
cd PembukuanTTD
npm install
```

### 2. Buat Database Supabase

1. Kunjungi [supabase.com](https://supabase.com) dan buat project baru
2. Copy project URL dan anon key ke `.env`
3. Copy service role key untuk server-side operations

### 3. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env dengan credentials Supabase
```

### 4. Push Schema ke Database

```bash
npm run db:push
```

### 5. Setup RLS Policies

Jalankan SQL di `supabase/migrations/001_enable_rls.sql` di Supabase SQL Editor

Untuk memakai halaman Sales Person dan menghubungkan pembayaran komisi ke Buku Kas, jalankan juga `supabase/migrations/20261029_sales_commissions.sql` di Supabase SQL Editor.

Jika menghapus transaksi Buku Kas, jalankan `supabase/migrations/20261030_cash_book_expense_delete.sql` untuk memberi izin hapus pengeluaran khusus Owner/Finance.

### 6. Buat Akun Owner

1. Buat user di Supabase Dashboard > Authentication > Users
2. Jalankan SQL di `supabase/migrations/002_seed_owner.sql` dengan UUID user yang baru dibuat

### 7. Jalankan Development Server

```bash
npm run dev
```

## Setup Owner Account

Setelah membuat user di Supabase Auth:

```sql
-- 1. Get user UUID
SELECT id, email FROM auth.users;

-- 2. Create organization
INSERT INTO organizations (name, address, email)
VALUES ('TimeTravelDesign', 'Jl. Arsitektur No. 123, Jakarta Selatan', 'info@timetraveldesign.com')
RETURNING id;

-- 3. Create profile (ganti UUID dengan hasil dari langkah 2)
INSERT INTO profiles (id, email, full_name)
VALUES ('your-user-uuid', 'your-email@example.com', 'Admin User');

-- 4. Create organization settings
INSERT INTO organization_settings (organization_id)
VALUES ('your-org-uuid');

-- 5. Create owner membership
INSERT INTO organization_members (organization_id, profile_id, role, approval_limit)
VALUES ('your-org-uuid', 'your-user-uuid', 'OWNER', 100000000);

-- 6. Create chart of accounts
INSERT INTO accounts (organization_id, code, name, type, normal_balance, is_system)
VALUES
  ('your-org-uuid', '1100', 'Kas', 'ASSET', 'DEBIT', true),
  ('your-org-uuid', '1110', 'Bank BCA', 'ASSET', 'DEBIT', false),
  ('your-org-uuid', '1200', 'Piutang Usaha', 'ASSET', 'DEBIT', false),
  ('your-org-uuid', '1300', 'Piutang Karyawan', 'ASSET', 'DEBIT', false),
  ('your-org-uuid', '2100', 'Hutang Usaha', 'LIABILITY', 'CREDIT', false),
  ('your-org-uuid', '3100', 'Modal', 'EQUITY', 'CREDIT', true),
  ('your-org-uuid', '4100', 'Pendapatan Jasa', 'REVENUE', 'CREDIT', false),
  ('your-org-uuid', '5100', 'Biaya Material', 'COST_OF_SALES', 'DEBIT', false),
  ('your-org-uuid', '6100', 'Beban Gaji', 'EXPENSE', 'DEBIT', false);
```

## Available Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run db:generate  # Generate Prisma client
npm run db:push     # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Role Permissions

| Role | Expenses | Projects | Reports | Users | Settings |
|------|----------|----------|---------|-------|----------|
| OWNER | Full | Full | Full | Full | Full |
| FINANCE | Full | View | Full | View | View |
| PROJECT_MANAGER | Create/View Own | Full | View Own | - | - |
| SITE_STAFF | Create | View Own | - | - | - |
| VIEWER | View | View | View | - | - |

## License

Proprietary - TimeTravelDesign
