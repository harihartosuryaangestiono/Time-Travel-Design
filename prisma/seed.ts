// Database Seed for TimeTravelDesign Finance
// This file is for development/demo purposes only

import { PrismaClient } from "@prisma/client";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/lib/accounting/defaultCoa";

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

  // Create chart of accounts using unified default COA
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.account.create({
      data: {
        organization_id: org.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normal_balance: acc.normal_balance,
        is_active: true,
        is_system: acc.is_system,
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
