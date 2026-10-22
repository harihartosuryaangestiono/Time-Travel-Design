# AUDIT TEKNIS — TimeTravelDesign Finance (`PembukuanTTD`)

> Dokumen ini adalah audit lengkap codebase: memberikan gambaran
> menyeluruh tentang **sistemnya apa, fiturnya apa, bagaimana cara kerjanya, dan apa yang
> rusak/tidak berfungsi** — agar dapat diberikan ke AI agent untuk diperbaiki.
>
> **Lokasi repo:** `/Users/harihartosurya/Developer/PembukuanTTD`
> **Tanggal audit:**Oktober 2026 · **Commit audited:** `a42b6b7` · **Branch:** `main`
> **Metodologi:** pembacaan seluruh 93 file source, `tsc --noEmit` (PASS), `next lint` (4 warning),
> `next build` (PASS, 28 route), analisis RLS/policy, penelusuran import graph, verifikasi model ID Gemini.

---

## 1. RINGKASAN EKSEKUTIF

### 1.1 Apa aplikasi ini

Aplikasi **ERP/akuntansi untuk perusahaan arsitektur & konstruksi di Indonesia** (merek: TimeTravelDesign).
Fungsinya: mengelola proyek dari mulai RAB (Rencana Anggaran Biaya) → pencatatan pengeluaran → penagihan invoice
→ kasbon/reimbursement karyawan → pembukuan double-entry → laporan keuangan.

Secara jargon: ini adalah **sistem akuntansi yang UI-nya sudah jadi, tapi mesin akuntansinya belum tersambung.**

### 1.2 Verdict

| Aspek | Status | Catatan |
|---|---|---|
| Build | ✅ Lulus | `next build` sukses, 28 route, typecheck bersih |
| Lint | ⚠️ 4 warning | `exhaustive-deps` ×3, `<img>` ×1 |
| Test | ❌ Tidak ada | 0 file test, tidak ada test runner |
| Database schema | ✅ Bagus | 34 tabel, 11 domain, lengkap untuk akuntansi |
| RLS policies | ⚠️ Parsial | 12 dari 34 tabel **nol policy** → fitur mati total |
| CRUD UI | ⚠️ Sebagian | 9 modul CRUD jalan (via browser Supabase), 2 modul jalan, sisanya kosong |
| **Mesin akuntansi (double-entry)** | ❌ **Tidak tersambung** | **Tidak ada satu baris pun yang menulis `journal_entries` / `journal_lines`** |
| **5 Laporan keuangan** | ❌ **Mock** | Semua menampilkan data hardcoded, tidak pernah query DB |
| Approval workflow | ⚠️ Rusak | Submitter bisa menyetujui pengajuan sendiri lewat update status bebas |
| OCR struk | ⚠️ Berjalan | Gemini Vision aktif, tapi route **tanpa auth** dan hasilnya **tidak disimpan** |
| Multi-tenant | ⚠️ Sebagian | Isolasi org ada di RLS, tapi ada policy yang bisa ditembus |

### 1.3 Temuan paling penting (5 yang harus diketahui AI agent)

1. **General ledger tidak pernah terisi.** `src/lib/accounting/journalService.ts`, `expensePosting.ts`, dan
   `src/lib/reports/reportService.ts` (total **905 baris**) adalah **dead code** — nol import dari seluruh aplikasi.
   Tidak ada kode di `src/` yang meng-`INSERT` ke `journal_entries` atau `journal_lines`.
   Konsekuensi: **neraca, laba rugi, arus kas, dan buku besar akan kosong selamanya** — bukan karena bug,
   tapi karena tidak pernah ada sumber datanya.
2. **5 halaman laporan keuangan 100% mock.** Semuanya memakai konstanta `defaultReportData` / `defaultBalanceSheetData` /
   `defaultTrialBalanceData` / `defaultLedgerData`. Tombol "Generate" hanya `setTimeout(..., 400)` lalu memasang
   data yang sama. Kode akun di mock (`1120`, `1210`, `1510`, `2110`, `3110`, `7100`, `8100`) **tidak cocok** dengan
   chart of accounts yang benar-benar di-seed (`1100`–`6800`). Jadi mocked *dan* salah.
3. **12 tabel punya RLS aktif tanpa policy apa pun** → PostgREST menolak semua query dari browser.
   Akibatnya fitur Cash Transfer, Invoice Item, Invoice Payment, Expense Allocation, Advance Settlement,
   Budget Item, Contract, Commitment, dan Import **tidak akan bisa dipakai sama sekali**.
   Detail lengkap di §7.
4. **Route `/cash-accounts` dan `/transfers` tidak dilindungi middleware.** Daftar `protectedRoutes` di
   `middleware.ts` tidak memuat keduanya → tamu tanpa login bisa membuka keduanya.
5. **`/api/ocr/scan-receipt` tidak punya autentikasi sama sekali.** Kalau header `x-gemini-api-key` tidak dikirim,
   route memakai **API key server dari `.env`** → siapa pun yang tahu URL-nya bisa menghabiskan AI key Anda.

---

## 2. IDENTITAS PROYEK & STACK

### 2.1 Meta

| Item | Nilai |
|---|---|
| Nama paket | `pembukuanttd` v1.0.0 (private) |
| Nama produk | TimeTravelDesign Finance |
| Bahasa UI | Indonesia (IDR, `Asia/Jakarta`, format `dd/MM/yyyy`) |
| Lisensi | Proprietary — TimeTravelDesign |
| Riwayat git | 5 commit, single developer, belum ada branch/tag/release |
| Deploy target | Vercel (README), Supabase (DB/Auth/Storage) |

### 2.2 Dependency runtime

| Paket | Versi | Dipakai? | Peran |
|---|---|---|---|
| `next` | 14.2.18 | ✅ | App Router |
| `react` / `react-dom` | 18.3.1 | ✅ | UI |
| `typescript` | 5.7.2 | ✅ | strict mode aktif |
| `tailwindcss` | 3.4.16 | ✅ | Styling, design system monokrom |
| `lucide-react` | 0.460 | ✅ | 37 file |
| `@supabase/supabase-js` | 2.47.10 | ✅ | **Layer data utama** |
| `@supabase/ssr` | 0.5.2 | ✅ | Middleware + server cookies |
| `@prisma/client` | 5.22.0 | ⚠️ Hampir tidak dipakai | Hanya `setup-organization/actions.ts` + tipe enum |
| `recharts` | 2.14.1 | ✅ | 1 file (dashboard) |
| `decimal.js` | 10.6.0 | ⚠️ 1 file | Hanya di `expensePosting.ts` (dead code) |
| `@google/genai` | 2.30.0 | ✅ | OCR struk |
| `zod` | 3.23.8 | ❌ **Tidak dipakai** | Tidak ada validasi schema server-side |
| `react-hook-form` | 7.53.2 | ❌ **Tidak dipakai** | Form manual |
| `@hookform/resolvers` | 3.9.1 | ❌ **Tidak dipakai** | — |
| `xlsx` | 0.18.5 | ❌ **Tidak dipakai** | Tidak ada fitur import/export |
| `tesseract.js` | 7.0.0 | ❌ **Tidak dipakai** | Tidak ada OCR lokal |
| `uuid` | 11.0.3 | ❌ **Tidak dipakai** | Pakai `crypto.randomUUID()` |
| `date-fns` | 4.1.0 | ❌ **Tidak dipakai** | Pakai `Intl` |

> **Implikasi untuk AI agent:** 7 dari 19 dependency runtime adalah *dead weight* (≈20% install time & attack surface).
> Sebaliknya, **`zod` sudah terpasang tapi nol dipakai** — artinya validasi input server action **tidak ada sama sekali**
> (lihat §8, H-07).

### 2.3 Struktur direktori

```
PembukuanTTD/
├── prisma/
│   ├── schema.prisma          692 baris — 34 model, DDL sumber kebenaran
│   └── seed.ts                Chart of accounts + data demo
├── supabase/migrations/
│   ├── 001_enable_rls.sql     479 baris — RLS untuk 34 tabel
│   ├── 002_seed_owner.sql     Panduan setup owner
│   ├── 003_setup_owner.sql    Script PL/pgSQL setup owner
│   └── 004_rls_onboarding_fix.sql  146 baris — patch policy onboarding
├── src/
│   ├── app/
│   │   ├── (auth)/            login, register, setup-organization
│   │   ├── (dashboard)/       19 route aplikasi
│   │   ├── actions/            8 berkas server action
│   │   ├── api/                2 route: auth/callback, ocr/scan-receipt
│   │   ├── layout.tsx, page.tsx, globals.css
│   ├── components/            layout/, modals/ (9), ui/ (5), expenses/
│   ├── lib/
│   │   ├── accounting/         journalService, expensePosting   (DEAD CODE)
│   │   ├── reports/            reportService                    (DEAD CODE)
│   │   ├── auth/               auth, actions, permissions
│   │   ├── supabase/           client, server, index
│   │   └── utils.ts
│   └── types/index.ts          289 baris tipe manual
├── middleware.ts               67 baris — proteksi route
├── tailwind.config.ts          Design system monokrom + status colors
└── tsconfig.json               strict: true, paths @/*
```

---

## 3. ARSITEKTUR & ALUR DATA — BAGIAN PALING PENTING

### 3.1 Dualitas Prisma vs Supabase ( sumber kebingungan utama )

Codebase ini punya **dua jalur akses data yang tidak pernah disatukan**:

```
PRISMA  (schema.prisma)          SUPABASE-JS  (supabase-js)
─────────────────────────         ─────────────────────────────
Ddl & sumber kebenaran           Runtime query SEBENARNYA
db:push / db:seed / db:studio    15 client component browser
   │                                     │
   └── dipakai hanya oleh:               └── dipakai oleh:
       src/app/(auth)/setup-organization/actions.ts   semua CRUD UI
                                              │
                                     RLS Supabase = satu-satunya
                                     lapisan keamanan runtime
```

**Konsekuensi:**

- `prisma/schema.prisma` mendefinisikan tabel & kolom; `db:push` yang membuat fisiknya.
- Tapi **tidak ada kode aplikasi (kecuali 1 file onboarding) yang memakai PrismaClient untuk read/write.**
- Semua read/write runtime = **browser Supabase client** (`createBrowserClient` dengan anon key + session user).
- Artinya **satu-satunya gerbang keamanan runtime adalah RLS PostgreSQL.** Kalau policy-nya salah, data bocor.
- Skema Prisma dan query supabase-js bisa **drift** tanpa ada yang-memberi tahu (tidak ada type-checking
  lintas keduanya, tidak ada migration versioning — `db:push` bukan `migrate`).

### 3.2 Peta aliran request

```
Browser
  │
  ├─► middleware.ts ──► supabase.auth.getUser()  (SETIAP request, semua route)
  │     ├─ route protected & !user → redirect /login
  │     └─ route auth & user       → redirect /dashboard
  │
  ├─► Page (⚠️ 17 dari 28 route = "use client", di-prerender STATIC)
  │     └─► createBrowserClient(ANON_KEY)  ──► PostgREST ──► PostgreSQL
  │                                           (RLS applied di sini)
  │
  └─► /api/ocr/scan-receipt  (⚠️ TANPA AUTH)
        └─► Google Gemini API (gemini-3.8-flash, Vision)
```

**Hanya 2 API route yang ada.** Tidak ada BFF (backend-for-frontend). Tidak ada route REST untuk CRUD —
frontend bicara langsung ke PostgREST. Ini menjelaskan kenapa **tidak ada satu pun** endpoint untuk
membuat journal entry, dan kenapa modul-modul yang butuh tabel tanpa policy langsung gagal.

### 3.3 Yang TIDAK ada di arsitektur ini

| Yang hilang | Dampak |
|---|---|
| BFF / API route CRUD | Query Reformation-prone, tidak ada lapisan validasi/otorisasi |
| Service layer terpusat | Logika tersebar: 15 file mengulang pola `createClient` + query + setState |
| Transaction | Multi-tabel write (invoice + items + allocations) bisa setengah jadi |
| Validasi runtime (zod) | Server action menerima objek apa pun |
| Error boundary / `error.tsx` | Exception = layar putih |
| `loading.tsx` | Tidak ada skeleton, hanya spinner manual |
| Test suite | 0 test |
| Audit log di jalur CRUD | `audit_logs` hanya diisi oleh dead code |
| Migrasi versioned | `db:push` bisa destroys data |
| Rate limiting | Tidak ada di API route mana pun |
| Observability | Hanya `console.error` |

---

## 4. MODEL DATA — 34 TABEL, 11 DOMAIN

### 4.1 Peta domain

| Domain | Tabel |
|---|---|
| **Organisasi & Keanggotaan** | `organizations`, `organization_settings`, `profiles`, `organization_members`, `project_members` |
| **Proyek & Klien** | `clients`, `projects`, `contracts` |
| **Anggaran (RAB)** | `budget_versions`, `budget_items` |
| **Vendor** | `vendors` |
| **Pengeluaran & Struk** | `receipts`, `expenses`, `expense_allocations` |
| **Kas & Perbankan** | `cash_accounts`, `cash_transfers`, `cash_payments` |
| **Kasbon & Reimbursement** | `cash_advances`, `advance_settlements`, `reimbursements` |
| **Penagihan** | `invoices`, `invoice_items`, `invoice_allocations`, `invoice_payments` |
| **Persetujuan** | `approvals` |
| **Akuntansi** | `accounts`, `accounting_periods`, `journal_entries`, `journal_lines` |
| **Pendukung** | `notifications`, `audit_logs`, `commitment_items`, `import_batches`, `import_errors` |

Total: **34 tabel**. Enums: `Role`, `ProjectStatus`, `ProjectType`, `BudgetStatus`, `ExpenseStatus`,
`CashAccountType`, `CashAdvanceStatus`, `ReimbursementStatus`, `InvoiceStatus`, `AccountType`,
`NormalBalance`, `JournalStatus`.

### 4.2 Chart of accounts (dari `prisma/seed.ts`)

Kode akun mengikuti konvensi Indonesia:

| Kode | Nama | Tipe | Normal |
|---|---|---|---|
| 1100 / 1110 / 1120 | Kas / Bank BCA / Bank Mandiri | ASSET | DEBIT |
| 1200 / 1300 / 1400 / 1500 / 1600 | Piutang Usaha / Piutang Karyawan / Persediaan / Aset Tetap / Akumulasi Penyusutan | ASSET | DEBIT (1600 CREDIT) |
| 2100 / 2200 / 2300 / 2400 | Hutang Usaha / Hutang PPN / Hutang Gaji / Uang Muka | LIABILITY | CREDIT |
| 3100 / 3200 / 3300 | Modal / Laba Ditahan / Laba-Rugi Tahun Berjalan | EQUITY | CREDIT |
| 4100 / 4200 / 4300 / 4400 | Pendapatan Jasa / Desain Interior / Konstruksi / Lainnya | REVENUE / OTHER_INCOME | CREDIT |
| 5100 / 5200 / 5300 | Biaya Material / Biaya Tenaga Kerja / Biaya Subkontrak | COST_OF_SALES | DEBIT |
| 6100–6800 | Beban Gaji, Sewa, Listrik, Transportasi, Komunikasi, Perlengkapan, Penyusutan, Lainnya | EXPENSE / OTHER_EXPENSE | DEBIT |

> ⚠️ **Catatan:** `setup-organization/actions.ts` membuat chart of accounts **berbeda** dari `seed.ts`
> (nama & beberapa kode account berbeda). Dua sumber kebenaran untuk COA = bug konfigurasi.

### 4.3 Potensi yang belum dipakai

Model `Contract`, `CommitmentItem`, `ImportBatch`, `ImportError`, `BudgetVersion`/`BudgetItem`,
`ProjectMember`, `Notification`, `CashPayment` **ada di skema tapi tidak ada UI-nya** (§6 matriks fitur).
`CommitmentItem` & `ImportBatch` paling menarik: keduanya sudah dirancang untuk fitur "commitment control"
dan "import Excel" yang cocok untuk perusahaan konstruksi — tapi belum dibangun.

---

## 5. MESIN AKUNTANSI (DOUBLE-ENTRY) — DETAIL

### 5.1 Apa yang *sudah ditulis* (kualitasnya bagus, tapi tidak tersambung)

`src/lib/accounting/journalService.ts` (378 baris) mengimplementasikan engine akuntansi yang **berkualitas baik**:

| Fungsi | Perilaku | Catatan |
|---|---|---|
| `validateJournalBalance` | Total debit vs kredit, toleransi < 0.01 | ✅ benar |
| `validateNoNegativeAmounts` | Menolak nominal negatif & baris debit+kredit ganda | ✅ benar |
| `validateMinimumLines` | Minimal 2 baris | ✅ benar |
| `toMoney` | `Math.round(x*100)/100` | ✅ pembulatan aman |
| `generateJournalNumber` | `JNL-YYYYMM-NNNN` per organisasi | ⚠️ race-prone (lihat H-07) |
| `isPeriodOpen` | Cek `accounting_periods.is_closed` | ✅ benar |
| `createJournal` | Insert header (DRAFT) + lines; **rollback** hapus header bila insert lines gagal | ✅ transactional-ish |
| `postJournal` | DRAFT→POSTED, cek periode tertutup, re-validate balance, tulis `audit_logs` | ✅ bagus |
| `reverseJournal` | Buat jurnal pembalik (debit↔credit), tandai `reversed_by_id`/`reverses_id`, auto-post | ✅ bagus |
| `deleteJournal` | Hanya bisa hapus yang masih DRAFT | ✅ benar |
| Semua fungsi | Filter `.eq("organization_id", user.organizationId)` | ✅ tenant-scoped |

`src/lib/accounting/expensePosting.ts` (248 baris) mengotomasi posting expense → jurnal:

```
DEBIT  5100/5200/6400/6800  Biaya (dalam alokasi per proyek)
DEBIT  2200                 Hutang PPN (bila ada pajak)
CREDIT 1100/1110            Kas / Bank
```

`src/lib/reports/reportService.ts` (279 baris) menyediakan 4 report query:
`getTrialBalanceData`, `getIncomeStatementData`, `getBalanceSheetData`, `getCashFlowData`.

### 5.2 Kenapa semuanya tidak berfungsi

```
$ grep -rn "journal_entries\|journal_lines" src/ | grep -v "src/lib/accounting\|src/lib/reports"
(nol hasil)

$ grep -rn "postExpenseToJournal\|postJournal\|createJournal\|getTrialBalanceData|..." src/ | grep -v "src/lib/accounting\|src/lib/reports"
(nol hasil)
```

**Tidak ada satu pun pemanggilan.** Ketiga berkas tersebut adalah **puluhan islands**. Konsekuensi berantai:

1. Tidak ada expense/invoice/transfer yang pernah menghasilkan jurnal → `journal_entries` & `journal_lines` **selalu kosong**.
2. Karena kosong, ke-4 fungsi report akan mengembalikan baris kosong / nol.
3. Tapi halaman laporan **tidak memanggil** fungsi report itu — ia memakai data hardcoded sendiri.
4. Jadi user melihat laporan berisi angka yang **tidak berasal dari data yang ia input**. Ini kondisi paling berbahaya
   secara bisnis: laporan terlihat meyakinkan tapi salah total.

### 5.3 Bug latent di dalam dead code (akan muncul begitu di-wire)

| # | Lokasi | Bug | Dampak |
|---|---|---|---|
| A | `expensePosting.ts:73` | Select `cash_account:cash_accounts(id, code)` — **tabel `cash_accounts` tidak punya kolom `code`** (cek `prisma/schema.prisma`: id, organization_id, name, type, account_number, bank_name, opening_balance, opening_date, is_active). | PostgREST balasan `400 column cash_accounts.code does not exist` → `postExpenseToJournal` **selalu gagal** saat `.single()`. |
| B | `expensePosting.ts:146` | `creditAccountId = expense.cash_account_id` — ini **PK dari tabel `cash_accounts`**, dipakai sebagai `journal_lines.account_id` (FK ke `accounts.id`). Model `CashAccount` **tidak punya** FK ke `Account`. | Pelanggaran foreign key saat insert journal line. Tidak ada mapping cash_account → akun GL sama sekali di skema. |
| C | `expensePosting.ts:118-129` | Alokasi multi-proyek: setiap baris di-`debit` dengan **`baseAmount` penuh**, bukan `alloc.amount`. | 2 alokasi × total penuh → jurnal tidak balance → `createJournal` melempar "out of balance". Expense beralokasi proyek **tidak akan pernah bisa di-post**. |
| D | `expensePosting.ts:16-21` | `PAYMENT_ACCOUNT_MAP`: `CREDIT: "2100"` (Hutang Usaha). Pembayaran kartu kredit seharusnya dijurnalkan ke Hutang Kartu Kredit / Beban Bank, bukan Hutang Usaha. | Neraca Hutang Usaha berubah pada setiap pembayaran kredit. |
| E | `reportService.ts:170-190` | `getBalanceSheetData`: `equity: []` dan `total_equity = current_profit_loss` saja. **Akun bertipe `EQUITY` (3100 Modal, 3200 Laba Ditahan) diabaikan sepenuhnya.** | Assets ≠ Liabilities + Equity. **Neraca tidak akan balance.** |
| F | `reportService.ts:135-145` | `getIncomeStatementData`: `switch (acc.type)` hanya menangani `REVENUE`, `COST_OF_SALES`, `EXPENSE`. Tipe `OTHER_INCOME` (4400 Pendapatan Lainnya) dan `OTHER_EXPENSE` (6800 Beban Lainnya) **di-drop**. | Laba bersih salah. Laba ini lebih besar dari seharusnya. |
| G | `reportService.ts:235-250` | `getCashFlowData`: `operating_activities`, `investing_activities`, `financing_activities` **selalu array kosong** — tidak ada klasifikasi arus kas. `description` berisi `account_id` (UUID), bukan nama akun. | Laporan arus kas tidak berguna; tidak bisa dianalisis. |
| H | `reportService.ts:229` | `.in("account_id", (cashAccounts \|\| []).map(...))` — kalau tidak ada akun kas, hasilnya `IN ()` → error PostgREST. | Halaman arus kas error saat belum ada cash account. |
| I | `reportService.ts` (semua) | `Number(line.debit)` pada kolom `Decimal(15,2)` dari PostgREST yang mengembalikan **string** → akurasi floating point. `decimal.js` sudah terpasang tapi tidak dipakai di sini. | Selisih penny pada total besar. Untuk akuntansi, tidak dapat diterima. |
| J | `journalService.ts:96-112` | `generateJournalNumber` = baca MAX → +1 → insert. Ada UNIQUE `(organization_id, number)`. | Dua posting bersamaan → **unique violation**, transaksi gagal. |
| K | `journalService.ts:186` | `revalidatePath("/expenses/${expenseId}")` — tidak ada route `/expenses/[id]`. | No-op sia-sia. |

### 5.4 Yang TIDAK ada dari mesin akuntansi

Hal-hal standar yang **tidak diimplementasikan** sama sekali dan akan dibutuhkan:

- Auto-numbering FY/prefix per tahun dengan counter atomik (DB sequence).
- **Closing period** enforcement di sisi DB (hanya dicek di app layer, bisa dilewati lewat update langsung).
- Retensi / rekonsiliasi bank.
- **Aging piutang & piutang jatuh tempo** — padahal README menjanjikan "aging piutang" (tidak ada kodenya).
- Depreciation / amortisation schedule (`accounting_periods` ada, tapi tidak ada aset tetap).
- Multi-currency / kurs (semua single currency IDR, tapi `OrganizationSettings.default_currency` menyiratkan mendukung lebih).
- Accrual, prepaid expense, deferred revenue (model `Uang Muka Pelanggan` 2400 ada tapi tidak ada mekanismenya).
- Export laporan ke Excel/PDF (tombol Export ada di UI, `xlsx` terpasang, tapi **tidak terimplementasi**).

---

## 7. AUTENTIKASI, RBAC, MULTI-TENANT, RLS

### 7.1 Alur autentikasi

| Komponen | Implementasi | Penilaian |
|---|---|---|
| Provider | Supabase Auth (email + password) | Sesuai |
| Session | `@supabase/ssr` cookie-based (`sb-*-auth-token`) | ✅ Pola modern & benar |
| Login | `src/lib/auth/actions.ts` → `signIn()` | ✅ Cek profil & keanggotaan; flag `needsSetup` bila belum punya org |
| Register | `signUp()` — buat auth user + insert `profiles` | ✅ Ada cek email duplikat |
| Onboarding | `signIn` → `needsSetup` → `/setup-organization` | ✅ Alur owner's manual |
| Setup org | `setupOrganization()` — Prisma, bypass RLS | ⚠️ Lihat H-05 |
| Logout | `signOut()` + `redirect('/login')` | ✅ |
| Reset password | `resetPassword()` (email) + `updatePassword()` | ⚠️ `redirectTo` menunjuk `/auth/callback/reset-password` — **route itu tidak ada** |
| Route callback | `src/app/api/auth/callback/route.ts` | Exchange code → session |
| Refresh token | `@supabase/ssr` otomatis | ✅ |

**Masalah struktural utama:** `src/app/(dashboard)/layout.tsx` adalah **`"use client"`** dan **tidak melakukan cek auth sama sekali**.
Tidak ada `getAuthUser()` / `requireAuthUser()` di layout. Satu-satunya penjaga adalah `middleware.ts`.

### 7.2 Proteksi route — `middleware.ts`

```ts
const protectedRoutes = ['/dashboard', '/expenses', '/invoices', '/cash-advances',
  '/reimbursements', '/reports', '/settings', '/projects', '/clients', '/vendors',
  '/accounts', '/approvals']
```

Route yang benar-benar ada di build:
`/approvals, /cash-accounts, /cash-advances, /dashboard, /expenses, /invoices, /login, /projects, /projects/[id], /projects/clients, /register, /reimbursements, /reports/*, /settings/*, /setup-organization, /transfers, /vendors`

**❌ TIDAK diprotect: `/cash-accounts` dan `/transfers`.**
(`/accounts` di daftar itu bukan route nyata — route aslinya `/settings/accounts`.)

Dampak: `/cash-accounts` menampilkan saldo kas & bank; `/transfers` menampilkan mutasi antar akun kas.
Keduanya **terbuka untuk tamu tanpa login** (data sendiri tetap-protected RLS, jadi kebocoran data butuh sesi, tapi
UI dan permukaan Modeling tetap terbuka — dan kalau RLS punya celah, ini amplifier-nya).

Catatan lain: middleware memanggil `supabase.auth.getUser()` pada **setiap request ke semua route**
(matcher hampir semua path). `getUser()` melakukan network round-trip ke Supabase Auth API → meng-add latency
ke setiap navigasi. Cache/lazy-check akan lebih baik.

### 7.3 Role & permission

Role enum: `OWNER`, `FINANCE`, `PROJECT_MANAGER`, `SITE_STAFF`, `VIEWER`.

`src/lib/auth/permissions.ts` (18 baris) menyediakan `hasRole()` dan `canApprove()`:

```ts
export function canApprove(user: AuthUser, amount: number): boolean {
  if (user.role === "OWNER" || user.role === "FINANCE") return true;
  if (user.role === "PROJECT_MANAGER" && user.approvalLimit)
    return amount <= user.approvalLimit;
  return false;
}
```

❌ **`permissions.ts` tidak di-import oleh file mana pun** — `hasRole`/`canApprove` adalah dead code.
Tidak ada RBAC enforcement di lapis aplikasi; **semua rely pada RLS PostgreSQL**.

### 7.4 Matriks RLS (hasil audit policy per tabel)

`supabase/migrations/001_enable_rls.sql` mengaktifkan RLS di 34 tabel. Semua tabel punya policy
kecuali **12 tabel berikut — RLS aktif tapi policy = 0 → semua akses dari client DITOLAK**:

| # | Tabel | Modul yang mati |
|---|---|---|
| 1 | `cash_transfers` | Halaman **Transfers** — tidak bisa bikin/list transfer |
| 2 | `invoice_items` | Detail baris invoice — insert item gagal |
| 3 | `invoice_allocations` | Alokasi invoice ke proyek |
| 4 | `invoice_payments` | **Penerimaan pembayaran invoice** — fitur pembayaran invoice mati |
| 5 | `expense_allocations` | **Alokasi biaya ke proyek** — inti fitur konstruksi |
| 6 | `advance_settlements` | Pemenuhan kasbon |
| 7 | `budget_items` | RAB / rincian anggaran |
| 8 | `contracts` | Kontrak kerja |
| 9 | `commitment_items` | Commitment control |
| 10 | `import_batches` | Import Excel |
| 11 | `import_errors` | Import Excel |
| 12 | `cash_payments` | Pembayaran kas |

> **Konsekuensi praktis:** modul yang paling "inti" untuk bisnis konstruksi — **alokasi expense ke proyek**
> (#5) dan **penerimaan pembayaran invoice** (#4) — **tidak akan bisa dipakai**. Kemungkinan besar ini
> belum pernah diuji dengan database sungguhan, atau tabel-tabel itu dibuat manual di dashboard Supabase
> yang tidak pernah diberi policy.

Tabel yang punya policy:

| Tabel | Policies | Catatan |
|---|---|---|
| `organizations` | 2 | SELECT by org; INSERT by any authenticated (patch 004) |
| `organization_settings` | 1 | INSERT by any authenticated (patch 004) |
| `profiles` | 4 | SELECT/UPDATE/INSERT milik sendiri |
| `organization_members` | 4 | SELECT by org; ALL by owner/finance; INSERT by self (patch 004) |
| `project_members` | 1 | SELECT saja |
| `clients` | 4 | SELECT by member; ALL by finance |
| `projects` | 4 | SELECT by member; INSERT/UPDATE by finance; DELETE by finance |
| `vendors` | 4 | SELECT by member; ALL by finance |
| `receipts` | 3 | SELECT by member; INSERT by authenticated; UPDATE by uploader |
| `expenses` | 3 | SELECT by member; INSERT by authenticated; UPDATE by finance **atau submitter** |
| `cash_accounts` | 3 | SELECT by member; ALL by finance |
| `cash_advances` | 2 | SELECT by member; ALL by finance |
| `reimbursements` | 3 | SELECT by member; INSERT by authenticated; UPDATE by finance |
| `invoices` | 2 | SELECT by member; ALL by finance |
| `approvals` | 2 | SELECT & INSERT by approver |
| `accounts` | 3 | SELECT by member; ALL by finance |
| `accounting_periods` | 3 | SELECT by member; ALL by finance |
| `journal_entries` | 2 | SELECT by member; ALL by finance |
| `journal_lines` | 2 | SELECT by member; ALL by finance |
| `audit_logs` | 2 | SELECT by finance; INSERT `WITH CHECK (true)` |
| `notifications` | 2 | SELECT/UPDATE milik sendiri |

### 7.5 Celah RLS yang saya Temukan

**RLS-1 — Approver bisa menyetujui pengajuan sendiri (bypass approval).**
Policy `expenses` untuk UPDATE:

```sql
CREATE POLICY "Submitter or finance can update expenses" ON expenses FOR UPDATE
USING (organization_id = get_user_organization_id()
       AND (is_owner_or_finance() OR submitted_by = auth.uid()::text));
```

Tidak ada pembatasan kolom. `SITE_STAFF` yang mengirim expense bisa UPDATE barisnya sendiri dan
**meng-set `status = 'APPROVED'`** (atau `POSTED`) langsung — melewati `approvals` sepenuhnya.
Perbaikan: pecah policy — izinkan submitter hanya mengubah subset kolom saat status masih `DRAFT`,
dan pindahkan transisi status ke fungsi RPC terotorisasi (SECURITY DEFINER) yang memeriksa `canApprove()`.

**RLS-2 — User bisa menyuntikkan keanggotaan ke organisasi lain.**
Patch 004:

```sql
CREATE POLICY "Users can create own membership" ON organization_members FOR INSERT
WITH CHECK (profile_id = auth.uid()::text);
```

`WITH CHECK` **tidak membatasi `organization_id`** → user bisa INSERT baris ke `organization_members`
dengan `organization_id` milik organisasi lain. Ini.
Dikombinasikan dengan `get_user_organization_id()` yang memakai `LIMIT 1`, ini bisa mengarahkan
sesi attacker ke org korban.

**RLS-3 — Siapa pun bisa menulis audit log palsu.**
```sql
CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);
```
`audit_logs` seharusnya hanya bisa di-insert oleh service role / SECURITY DEFINER function.

**RLS-4 — `profiles` bisa di-update oleh siapa pun.**
`"Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid()::text)`
dengan **tanpa `WITH CHECK`** → `WITH CHECK` default-nya mengikuti `USING`, jadi user **tidak bisa** mengubah
`id` ke nilai lain. Ini aman secara id, tapi `profiles` juga menyimpan `email` — user boleh mengubah
email profilnya sendiri tanpa verifikasi. Minor.

**RLS-5 — `organization_members` FOR ALL oleh finance, namanyaerie "Only owners..."**
Policy bernama `"Only owners can manage organization members"` tapi condition-nya `is_owner_or_finance()`
→ FINANCE juga bisa menambah/menghapus anggota. Ketidaksesuaian nama vs perilaku (README juga menulis
FINANCE = "Users: View"). Perbaiki nama atau condition.

**RLS-6 — `get_user_organization_id()` dan `get_user_role()` pakai `LIMIT 1` tanpa `ORDER BY`.**
Kalau user Somehow punya >1 keanggotaan, hasil **tidak deterministik**. Dan `SECURITY DEFINER` +
`auth.uid()` → perlu `SET search_path` untuk keamanan (search_path hijacking).

**RLS-7 — `project_members` SELECT policy membandingkan `member_id` dengan `organization_members.id`,**
sementara `organization_members.profile_id` berisi **auth user id**, bukan `profiles.id`.
Perbandingan membandingkan id yang berbeda secara semantik. Sama masalahnya di `approvals`:
`approver_id IN (SELECT id FROM organization_members ...)` → `approvals.approver_id` diisi dengan apa?

### 7.6 Multi-tenancy

Isolasi organisasi mengandalkan 2 hal: filter `.eq("organization_id", ...)` di query + RLS.
`organization_members.profile_id` = **auth user id** (bukan `profiles.id`), yang berbeda dari
`prisma/schema.prisma` di mana `Profile.id` = `@default(uuid())` dan `seed.ts` membuat profil
dengan UUID acak. **Perbedaan semantik ini membuat user seed tidak bisa login**, dan membuat
`audit_logs.actor_id` (yang diisi `user.id` = auth uid) tidak konsisten dengan `profiles.id`.


## 8. FITUR OCR / PEMINDAIAN STRUK

Ini fitur paling matang & paling differensiasi — dan satu-satunya yang benar-benar "bekerja" end-to-end.

### 8.1 Arsitektur

```
src/components/expenses/ReceiptCaptureModal.tsx
  └─► POST /api/ocr/scan-receipt
        body: { imageBase64, mimeType }
        header: x-gemini-api-key  (opsional — BYOK dari browser)
        └─► @google/genai  model: "gemini-3.8-flash"
              config: responseMimeType "application/json"
                      responseSchema: Type.OBJECT (strict)
              prompt: 9 poin (merchant, receiptNumber, date, description,
                      category, paymentMethod, items[], totalBilled, notes)
        └─► JSON.parse → normalisasi items[] → response JSON
```

**Model `gemini-3.8-flash` sudah diverifikasi valid** (terdaftar di `@google/genai@2.30.0` dan di
docs resmi Google). Jadi commit `a42b6b7` ("upgrade Gemini model to 3.8-flash") benar secara teknis.
✅

### 8.2 Yang bagus

- **`responseSchema` + `responseMimeType: "application/json"`** → Gemini dipaksa keluar JSON valid.
  Ini cara benar menstabilkan output LLM.
- **Skema response sangat detail** — menyuruh model membaca *setiap* baris tabel, qty, satuan, harga satuan,
  subtotal, dan total keseluruhan. Cocok untuk struk tulisan tangan Indonesia.
- **Fallback perhitungan baris**: `subotal: Number(it.subtotal) || (qty * unit_price)` — jadi baris dengan
  subtotal hilang masih dapat nilai.
- **Normalisasi tipe**: `Number(...) || default` per field, `id` unik per item (`item-${Date.now()}-${idx}`).
- **Prompt经验的**: instruksi konversi tanggal format Indonesia (`15/10/2026` atau `15 Okt 2026`) → `YYYY-MM-DD`.
- **Kategori terkontrol**: `Project Material | Subcontractor | Site Logistics | Equipment & Tools | Hospitality`.
- **Dukungan BYOK**: user bisa masukkan API key sendiri (disimpan di `localStorage`) bila key server tidak ada.

### 8.3 Yang bermasalah

| # | Temuan | Dampak |
|---|---|---|
| OCR-1 | **Route tidak melakukan autentikasi.** Tidak ada `requireAuthUser()`, tidak ada cek session. | Anyone bisa POST gambar danchants membakar kuota. Kalau header `x-gemini-api-key` tidak dikirim, **API key server** (`GEMINI_API_KEY` di `.env`) yang dipakai → biaya ditanggung pemilik. |
| OCR-2 | Tidak ada rate limit, tidak ada batas ukuran request, tidak ada timeout. | B abuse & biaya tak terbatas; gambar besar bisa OOM. |
| OCR-3 | **`confidence: 99.4` di-hardcode.** | Angka keyakinan palsu. User diberi Pretensi akurasi tinggi padahal tidak ada confidence nyata dari Gemini (`generateContent` tidak mengembalikan confidence score). UX berbohong. |
| OCR-4 | **`source: "gemini-2.5-flash-vision"`** di response, padahal model yang dipakai `gemini-3.8-flash`. | Metadata salah / sisa kode lama. |
| OCR-5 | **Hasil OCR tidak pernah disimpan.** Tidak ada insert ke tabel `receipts`, tidak ada upload ke Supabase Storage, tidak ada `expense` yang dibuat dari hasil scan. | Struk diparse lalu dibuang — pengguna harus mengetik ulang manual. Nilai OCR jadi sia-sia. |
| OCR-6 | **Item baris (`items[]`) dibuang.** Tabel `Expense` tidak punya tabel anak line-item (tidak ada `expense_items`), jadi rincian item hilang. | Untuk construction, rincian material per baris itu penting (mis. untuk RAB vs realisasi). |
| OCR-7 | **Kategori OCR tidak cocok dengan peta kategori expense.** OCR mengembalikan `"Project Material"`, `"Site Logistics"`, dll (String bebas), sedangkan `expensePosting.getExpenseAccountCode()` mencari `MATERIAL / LABOR / TRANSPORT / OTHER` (enum-style). | Mapping ke akun GL **tidak akan cocok** → jatuh ke default `"6800"`. Perlu kamus kategori yang konsisten. |
| OCR-8 | Tidak ada validasi server atas hasil parse (tanggal format, angka negatif, total ≠ jumlah baris). | Data sampah masuk DB. |
| OCR-9 | API key disimpan di `localStorage` (plaintext). | Terpapar XSS; juga key bocor kalau ada extension. Untuk BYOK yang acceptable, tapi harus didokumentasikan. |
| OCR-10 | Tidak ada storing audit trail OCR (prompt versi, model, raw response, token usage). | Tidak bisa menelusuri kenapa hasil scan salah. |
| OCR-11 | `tesseract.js` terpasang untuk OCR lokal tapi **tidak dipakai** — tidak ada fallback offline / lokal. | Kalau API down, tidak ada jalur cadangan. |

---

## 9. TEMUAN AUDIT (REGISTER)

Severity: **CRITICAL** = data salah / fitur mati / breach · **HIGH** = bug atau risiko serius ·
**MEDIUM** = kualitas & risikomoderate · **LOW** = polish.

### CRITICAL

| ID | Temuan | Lokasi | Dampak | Arahan Perbaikan |
|---|---|---|---|---|
| **C-01** | General ledger tidak pernah ditulis. 905 baris engine akuntansi = dead code, nol import. | `src/lib/accounting/*`, `src/lib/reports/*` | Neraca, laba rugi, arus kas, buku besar kosong selamanya. | Wire `postExpenseToJournal` ke event approve expense; expose `createJournal`/`postJournal` via route server action; tambahkan UI jurnal. |
| **C-02** | 5 halaman laporan = data hardcoded + `setTimeout` palsu. Kode akun mock ≠ COA asli. | `src/app/(dashboard)/reports/*/page.tsx` | User melihat laporan palsu tapi meyakinkan. Risiko hukum/audit serius. | Ganti dengan query ke `reportService` (setelah C-01 diperbaiki); hapus konstanta mock. |
| **C-03** | 12 tabel RLS aktif tanpa policy → deny-all. | `supabase/migrations/001_enable_rls.sql` | Alokasi expense ke proyek, item & pembayaran invoice, transfer kas, budget item, settlement kasbon, import Excel — **semua mati**. | Tulis policy untuk 12 tabel (pola: SELECT by org, INSERT/UPDATE/DELETE by finance). |
| **C-04** | `/cash-accounts` & `/transfers` tidak ada di `protectedRoutes`. | `middleware.ts:41-42` | Route terbuka tanpa login. | Tambahkan keduanya; lebih baik lagi: pakai matcher allowlist, bukan denylist. |
| **C-05** | `(dashboard)/layout.tsx` = client component tanpa cek auth; 17 route di-prerender STATIC. | `src/app/(dashboard)/layout.tsx` | Tidak ada auth gate server-side. | Jadikan layout server component, panggil `requireAuthUser()`, `redirect('/login')`. Tambahkan `loading.tsx` & `error.tsx`. |
| **C-06** | `/api/ocr/scan-receipt` tanpa autentikasi; memakai API key server bila header absen. | `src/app/api/ocr/scan-receipt/route.ts` | Biaya AI bisa dibakar siapa pun; tidak ada rate limit. | Tambahkan `requireAuthUser()` + rate limit per user + batas ukuran + pakai hanya key server (abaikan header, atau validasi key belongs to user). |
| **C-07** | Approver bisa menyetujui sendiri: policy UPDATE `expenses` mengizinkan submitter mengubah kolom apa pun termasuk `status`. | `supabase/migrations/001_enable_rls.sql` (policy expenses) | Bypass approval total. | Batasi kolom via RPC `SECURITY DEFINER` untuk transisi status; policy UPDATE hanya untuk `status='DRAFT'`. |

### HIGH

| ID | Temuan | Lokasi | Dampak |
|---|---|---|---|
| **H-01** | Select kolom `code` pada `cash_accounts` yang tidak ada → PostgREST error 400. | `expensePosting.ts:73` | `postExpenseToJournal` selalu gagal. |
| **H-02** | `cash_account_id` (PK `cash_accounts`) dipakai sebagai `journal_lines.account_id` (FK `accounts.id`). | `expensePosting.ts:146` | Pelanggaran FK. Model `CashAccount` butuh kolom FK `account_id` → `accounts.id`. |
| **H-03** | Alokasi expense: setiap proyek di-debit dengan `baseAmount` penuh, bukan `alloc.amount`. | `expensePosting.ts:118-129` | Jurnal tidak balance → posting gagal untuk expense beralokasi. |
| **H-04** | `getBalanceSheetData` mengabaikan akun `EQUITY`; `total_equity = laba periode`. | `reportService.ts:170-190` | Neraca tidak balance. |
| **H-05** | `getIncomeStatementData` drop `OTHER_INCOME` & `OTHER_EXPENSE`. | `reportService.ts:135-145` | Laba bersih salah. |
| **H-06** | `getCashFlowData`: 3 kategori arus kas selalu kosong; deskripsi = UUID. | `reportService.ts:235-250` | Laporan arus kas tidak berguna. |
| **H-07** | Penomoran dokumen & jurnal = baca-MAX-lalu-`+1` (race-prone) dengan UNIQUE constraint. | `journalService.ts:96`, `*/actions/*` | Unique violation saat concurrency; nomor bisa bentrok. → Pakai DB sequence / counter table dengan `UPDATE ... RETURNING`, atau retry. |
| **H-08** | `setupOrganization()` memvalidasi input **tanpa zod**; PrismaClient level modul (bukan global singleton); bypass RLS total. | `src/app/(auth)/setup-organization/actions.ts` | Input tidak tervalidasi; connection pool habis di serverless; jalur bypass keamanan. |
| **H-09** | Inkonsistensi semantik `profile_id`: kode menganggap = auth user id; `seed.ts` membuat UUID acak; `Profile.id` di Prisma = `@default(uuid())`. | `prisma/seed.ts`, `src/lib/auth/auth.ts` | User seed tidak bisa login; `audit_logs.actor_id` & `approvals.approver_id` tidak konsisten. → Seragamkan: `profiles.id = auth.uid()`. |
| **H-10** | `permissions.ts` (`hasRole`, `canApprove`) **tidak dipakai** — tidak ada RBAC enforcement di layer aplikasi. | `src/lib/auth/permissions.ts` | Otorisasi hanya bergantung pada RLS yang sudah punya celah (C-07). |
| **H-11** | `cashAdvanceActions.ts` & `dashboardActions.ts` **tidak di-import siapa pun** (dead code). | `src/app/actions/` | Modul kasbon & dashboard bypass validasi server & audit log; pakai query browser mentah. |
| **H-12** | `audit_logs` praktis kosong — hanya diisi oleh dead code. | `src/app/actions/*` | Tidak ada jejak audit untuk aksi CRUD mana pun (padahal tabel & policy-nya sudah ada). |
| **H-13** | Tidak ada validasi runtime di server action mana pun (zod terpasang tapi nol dipakai). | `src/app/actions/*` | Objek seenarbitrary diterima; mass-assignment & data sampah. |

### MEDIUM

| ID | Temuan | Lokasi |
|---|---|---|
| **M-01** | `organization_members` INSERT policy tidak membatasi `organization_id` → bisa join org lain. | `004_rls_onboarding_fix.sql` |
| **M-02** | `audit_logs` INSERT `WITH CHECK (true)` → siapa pun bisa menulis log palsu. | `001_enable_rls.sql` |
| **M-03** | `get_user_organization_id()` / `get_user_role()` `SECURITY DEFINER` tanpa `SET search_path` + `LIMIT 1` tanpa `ORDER BY` (non-deterministik). | `001_enable_rls.sql` |
| **M-04** | `project_members` & `approvals` policy membandingkan id dari domain berbeda (`organization_members.id` vs `profile_id`). | `001_enable_rls.sql` |
| **M-05** | `createServiceClient()` memakai `createServerClient` dengan service-role key; belum dipakai, tapi footgun. Service role绕过 semua RLS. | `src/lib/supabase/server.ts` |
| **M-06** | `Number()` pada kolom Decimal(15,2) di seluruh `reportService` → floating point drift. `decimal.js` sudah terpasang tapi tidak dipakai di sini. | `src/lib/reports/reportService.ts` |
| **M-07** | `parseCurrency()` mengganti "," dengan "." → "1.234,56" jadi `1.23456` (salah). Format Indonesia/Swiss dipakai? | `src/lib/utils.ts` |
| **M-08** | Tidak ada `loading.tsx`, `error.tsx`, `not-found.tsx`, Suspense, atau Error Boundary di seluruh app. | `src/app/` |
| **M-09** | Nol test, tanpa test runner di `package.json`. | root |
| **M-10** | Tidak ada pagination di list panjang (expenses, journal, audit log) — semuanya `.select()` tanpa limit. | `src/app/actions/*`, `*Content.tsx` |
| **M-11** | Tidak ada export Excel/PDF di laporan maupun modul lain, padahal `xlsx` terpasang dan tombol Export ada di UI (tombol itu tidak punya handler). | `src/app/(dashboard)/reports/*` |
| **M-12** | Responsive: sidebar memakai `lg:pl-64`/`lg:pl-20` fixed; `overflow-x-hidden` pada `<main>` menyembunyikan overflow, bukan memperbaiki layout. | `(dashboard)/layout.tsx` |
| **M-13** | `@import url('https://fonts.googleapis.com/...')` diletakkan **setelah** `@tailwind` directives di `globals.css` — CSS `@import` harus mendahului aturan lain; juga render-blocking tanpa `preconnect`. | `src/app/globals.css` |
| **M-14** | `resetPassword` mengarahkan ke `/auth/callback/reset-password` — route tidak ada. | `src/lib/auth/actions.ts` |
| **M-15** | Dua implementasi `cn()` (`utils.ts` & `utils-index.ts`) — duplikasi. | `src/lib/` |
| **M-16** | Chart of accounts berbeda antara `seed.ts` dan `setup-organization/actions.ts` → org yang di-seed vs yang di-onboard punya COA berbeda. | `prisma/seed.ts`, `setup-organization/actions.ts` |
| **M-17** | `tsconfig.tsbuildinfo` ter-track di git (128 KB) — seharusnya di `.gitignore`. | root |
| **M-18** | Tidak ada idempotensi pada pembuatan dokumen: retry user = duplikat. | `src/app/actions/*` |

### LOW

| ID | Temuan | Lokasi |
|---|---|---|
| **L-01** | Lint: 3× `react-hooks/exhaustive-deps` missing dependency. | `projects/[id]/page.tsx:43`, `settings/accounts/page.tsx:51`, `ReceiptCaptureModal.tsx:259` |
| **L-02** | Lint: `<img>` alih-alih `next/image` (LCP). | `ReceiptCaptureModal.tsx:665` |
| **L-03** | Dokumentasi bertentangan: README mengklaim semua fitur lengkap; `IMPLEMENTATION_STATUS.md` menandai Phase 8/9/10 (Accounting, Reports, OCR) sebagai **PENDING** — padahal kodenya sudah ada (tapi tidak terhubung). | `README.md`, `IMPLEMENTATION_STATUS.md` |
| **L-04** | Tabel `Role Permissions` di README tidak cocok dengan RLS (mis. FINANCE "Users: View" padahal bisa manage members). | `README.md` |
| **L-05** | `revalidatePath("/expenses/${expenseId}")` — route tidak ada. | `expensePosting.ts:186` |
| **L-06** | `confidence: 99.4` hardcoded; `source` label salah. | `scan-receipt/route.ts` |
| **L-07** | Tidak ada dokumentasi API / env var contract selain `.env.example` yang sudah usang (mention `OCR_API_KEY`/`OCR_API_URL` yang tak terpakai). | `.env.example` |

---
