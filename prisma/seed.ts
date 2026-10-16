// Database Seed for TimeTravelDesign Finance
// This file is for development/demo purposes only

import { PrismaClient, AccountType, NormalBalance } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Create demo organization
  const org = await prisma.organization.create({
    data: {
      name: "TimeTravelDesign",
      address: "Jl. Arsitektur No. 123, Jakarta Selatan",
      phone: "021-12345678",
      email: "info@timetraveldesign.com",
    },
  });

  console.log("Created organization:", org.name);

  // Create organization settings
  await prisma.organizationSettings.create({
    data: {
      organization_id: org.id,
      default_currency: "IDR",
      timezone: "Asia/Jakarta",
      date_format: "dd/MM/yyyy",
      expense_prefix: "EXP",
      invoice_prefix: "INV",
      journal_prefix: "JNL",
      cash_advance_prefix: "CA",
      reimbursement_prefix: "RMB",
      expense_approval_required: true,
      default_approval_limit: 5000000,
      fiscal_year_start_month: 1,
    },
  });

  console.log("Created organization settings");

  // Create demo profile (admin user)
  const adminProfile = await prisma.profile.create({
    data: {
      email: "admin@timetraveldesign.com",
      full_name: "Administrator",
      phone: "081234567890",
    },
  });

  // Create organization member with OWNER role
  await prisma.organizationMember.create({
    data: {
      organization_id: org.id,
      profile_id: adminProfile.id,
      role: "OWNER",
      approval_limit: 100000000,
    },
  });

  console.log("Created admin user");

  // Create chart of accounts with proper types
  const accounts: Array<{
    code: string;
    name: string;
    type: AccountType;
    normal_balance: NormalBalance;
  }> = [
    // Assets
    { code: "1100", name: "Kas", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1110", name: "Bank BCA", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1120", name: "Bank Mandiri", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1200", name: "Piutang Usaha", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1300", name: "Piutang Karyawan (Kasbon)", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1400", name: "Persediaan Material", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1500", name: "Aset Tetap", type: "ASSET", normal_balance: "DEBIT" },
    { code: "1600", name: "Akumulasi Penyusutan", type: "ASSET", normal_balance: "CREDIT" },

    // Liabilities
    { code: "2100", name: "Hutang Usaha", type: "LIABILITY", normal_balance: "CREDIT" },
    { code: "2200", name: "Hutang PPN", type: "LIABILITY", normal_balance: "CREDIT" },
    { code: "2300", name: "Hutang Gaji", type: "LIABILITY", normal_balance: "CREDIT" },
    { code: "2400", name: "Uang Muka Pelanggan", type: "LIABILITY", normal_balance: "CREDIT" },

    // Equity
    { code: "3100", name: "Modal Saham", type: "EQUITY", normal_balance: "CREDIT" },
    { code: "3200", name: "Laba Ditahan", type: "EQUITY", normal_balance: "CREDIT" },
    { code: "3300", name: "Laba/Rugi Tahun Berjalan", type: "EQUITY", normal_balance: "CREDIT" },

    // Revenue
    { code: "4100", name: "Pendapatan Jasa Arsitektur", type: "REVENUE", normal_balance: "CREDIT" },
    { code: "4200", name: "Pendapatan Desain Interior", type: "REVENUE", normal_balance: "CREDIT" },
    { code: "4300", name: "Pendapatan Konstruksi", type: "REVENUE", normal_balance: "CREDIT" },
    { code: "4400", name: "Pendapatan Lainnya", type: "OTHER_INCOME", normal_balance: "CREDIT" },

    // Cost of Sales / Project Costs
    { code: "5100", name: "Biaya Material Proyek", type: "COST_OF_SALES", normal_balance: "DEBIT" },
    { code: "5200", name: "Biaya Tenaga Kerja Proyek", type: "COST_OF_SALES", normal_balance: "DEBIT" },
    { code: "5300", name: "Biaya Subkontrak", type: "COST_OF_SALES", normal_balance: "DEBIT" },

    // Expenses
    { code: "6100", name: "Beban Gaji", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6200", name: "Beban Sewa", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6300", name: "Beban Listrik & Air", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6400", name: "Beban Transportasi", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6500", name: "Beban Komunikasi", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6600", name: "Beban Perlengkapan Kantor", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6700", name: "Beban Penyusutan", type: "EXPENSE", normal_balance: "DEBIT" },
    { code: "6800", name: "Beban Lainnya", type: "OTHER_EXPENSE", normal_balance: "DEBIT" },
  ];

  for (const acc of accounts) {
    await prisma.account.create({
      data: {
        organization_id: org.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normal_balance: acc.normal_balance,
        is_active: true,
        is_system: ["1100", "1110", "1200", "2100", "3100"].includes(acc.code),
      },
    });
  }

  console.log("Created chart of accounts");

  // Create cash accounts
  await prisma.cashAccount.create({
    data: {
      organization_id: org.id,
      name: "Bank BCA - Utama",
      type: "BANK",
      account_number: "123-456-7890",
      bank_name: "BCA",
      opening_balance: 100000000,
      opening_date: new Date("2024-01-01"),
      is_active: true,
    },
  });

  await prisma.cashAccount.create({
    data: {
      organization_id: org.id,
      name: "Bank Mandiri - Operasional",
      type: "BANK",
      account_number: "130-00-1234567-8",
      bank_name: "Mandiri",
      opening_balance: 50000000,
      opening_date: new Date("2024-01-01"),
      is_active: true,
    },
  });

  await prisma.cashAccount.create({
    data: {
      organization_id: org.id,
      name: "Kas Kecil",
      type: "CASH",
      opening_balance: 5000000,
      opening_date: new Date("2024-01-01"),
      is_active: true,
    },
  });

  console.log("Created cash accounts");

  // Create demo client
  await prisma.client.create({
    data: {
      organization_id: org.id,
      name: "PT Contoh Indonesia",
      email: "info@contohindonesia.co.id",
      phone: "021-98765432",
      address: "Jl. Sudirman No. 100, Jakarta Pusat",
      contact_person: "John Doe",
      tax_id: "01.234.567.8-999.000",
    },
  });

  console.log("Created clients");

  // Create demo accounting period
  await prisma.accountingPeriod.create({
    data: {
      organization_id: org.id,
      name: "January 2024",
      start_date: new Date("2024-01-01"),
      end_date: new Date("2024-01-31"),
      is_closed: false,
    },
  });

  console.log("Created accounting periods");

  console.log("\n✅ Database seed completed successfully!");
  console.log("\nDemo credentials:");
  console.log("  Email: admin@timetraveldesign.com");
  console.log("  (Configure Supabase Auth to set password)");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
