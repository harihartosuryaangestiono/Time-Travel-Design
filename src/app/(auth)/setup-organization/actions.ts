"use server";

import { PrismaClient, Role, AccountType, NormalBalance, CashAccountType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

interface SetupOrganizationInput {
  organizationName: string;
  address?: string;
  phone?: string;
  email?: string;
}

export async function setupOrganization(input: SetupOrganizationInput) {
  // Get current authenticated user from Supabase
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Invalid session. Please sign in again." };
  }

  try {
    // Check if organization already exists for this user
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { profile_id: user.id },
    });

    if (existingMembership) {
      return { error: "An organization workspace already exists for this profile." };
    }

    // Create organization with Prisma (bypasses RLS)
    const organization = await prisma.organization.create({
      data: {
        name: input.organizationName,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || user.email || null,
      },
    });

    // Create organization settings
    await prisma.organizationSettings.create({
      data: {
        organization_id: organization.id,
      },
    });

    // Create profile if not exists
    await prisma.profile.upsert({
      where: { id: user.id },
      update: {
        email: user.email || input.email || "",
      },
      create: {
        id: user.id,
        email: user.email || input.email || "",
      },
    });

    // Create owner membership
    await prisma.organizationMember.create({
      data: {
        organization_id: organization.id,
        profile_id: user.id,
        role: Role.OWNER,
        approval_limit: 100000000,
      },
    });

    // Create default chart of accounts
    const defaultAccounts = [
      { code: "1100", name: "Petty Cash & Studio Float", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: true },
      { code: "1110", name: "BCA Operating Account", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "1120", name: "Mandiri Corporate Account", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "1200", name: "Accounts Receivable", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: true },
      { code: "1300", name: "Staff Travel & Field Advances", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "1400", name: "Material & Sample Inventory", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "1500", name: "Fixed Equipment & Workstations", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "2100", name: "Accounts Payable", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: true },
      { code: "2200", name: "VAT / Tax Payable", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: true },
      { code: "2300", name: "Withholding Tax Payable", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: false },
      { code: "3100", name: "Shareholder Capital", type: AccountType.EQUITY, normal_balance: NormalBalance.CREDIT, is_system: true },
      { code: "3200", name: "Retained Earnings", type: AccountType.EQUITY, normal_balance: NormalBalance.CREDIT, is_system: false },
      { code: "4100", name: "Architectural Design Retainers", type: AccountType.REVENUE, normal_balance: NormalBalance.CREDIT, is_system: true },
      { code: "4200", name: "Interior Turnkey & Consulting Fees", type: AccountType.REVENUE, normal_balance: NormalBalance.CREDIT, is_system: false },
      { code: "5100", name: "Cost of Goods Sold (COGS)", type: AccountType.COST_OF_SALES, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "5200", name: "Direct Subcontractor Labor", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6100", name: "Architectural Staff Salaries", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6200", name: "Studio Premises Lease & Utilities", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6300", name: "CAD, BIM & Cloud Software", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6400", name: "Site Survey & Travel Logistics", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6500", name: "Office & Studio Supplies", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6600", name: "Professional Indemnity Insurance", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6700", name: "Depreciation & Amortization", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
      { code: "6800", name: "Miscellaneous Studio Overhead", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false },
    ];

    await prisma.account.createMany({
      data: defaultAccounts.map((acc) => ({
        ...acc,
        organization_id: organization.id,
      })),
    });

    // Create default cash account
    await prisma.cashAccount.create({
      data: {
        organization_id: organization.id,
        name: "Primary Petty Cash Float",
        type: CashAccountType.CASH,
        opening_balance: 0,
        opening_date: new Date(),
        is_active: true,
      },
    });

    // Create current year accounting period
    const now = new Date();
    await prisma.accountingPeriod.create({
      data: {
        organization_id: organization.id,
        name: `${now.getFullYear()}`,
        start_date: new Date(now.getFullYear(), 0, 1),
        end_date: new Date(now.getFullYear(), 11, 31),
        is_closed: false,
      },
    });

    // Also create profile via Supabase for RLS-based queries
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email || input.email || "",
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    console.error("Setup organization error:", error);
    return { error: error.message || "Failed to initialize organization workspace" };
  }
}
