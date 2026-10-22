"use server";

import { z } from "zod";
import { Role, CashAccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounting/defaultCoa";
import { revalidatePath } from "next/cache";

const setupOrgSchema = z.object({
  organizationName: z
    .string()
    .min(2, "Nama organisasi minimal 2 karakter")
    .max(100, "Nama organisasi maksimal 100 karakter"),
  address: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable().or(z.literal("")),
});

export type SetupOrganizationInput = z.infer<typeof setupOrgSchema>;

export async function setupOrganization(rawInput: SetupOrganizationInput) {
  // 1. Authenticate user from Supabase
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Sesi tidak valid atau telah berakhir. Silakan masuk kembali." };
  }

  // 2. Validate input schema with Zod
  const validationResult = setupOrgSchema.safeParse(rawInput);
  if (!validationResult.success) {
    const firstErrorMessage = validationResult.error.errors[0]?.message || "Input tidak valid";
    return { error: firstErrorMessage };
  }

  const input = validationResult.data;

  try {
    // 3. Check if user already belongs to an organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { profile_id: user.id },
    });

    if (existingMembership) {
      return { error: "Profil ini sudah terdaftar dalam ruang kerja organisasi." };
    }

    // 4. Execute all setup operations inside an atomic transaction
    await prisma.$transaction(async (tx) => {
      // Create Organization
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          address: input.address || null,
          phone: input.phone || null,
          email: input.email || user.email || null,
        },
      });

      // Create Organization Settings
      await tx.organizationSettings.create({
        data: {
          organization_id: organization.id,
          default_currency: "IDR",
          timezone: "Asia/Jakarta",
          date_format: "dd/MM/yyyy",
          expense_approval_required: true,
          default_approval_limit: 5000000,
          fiscal_year_start_month: 1,
        },
      });

      // Upsert Profile
      await tx.profile.upsert({
        where: { id: user.id },
        update: {
          email: user.email || input.email || "",
          full_name: user.user_metadata?.full_name || undefined,
        },
        create: {
          id: user.id,
          email: user.email || input.email || "",
          full_name: user.user_metadata?.full_name || null,
        },
      });

      // Create Owner Membership
      await tx.organizationMember.create({
        data: {
          organization_id: organization.id,
          profile_id: user.id,
          role: Role.OWNER,
          approval_limit: 100000000,
        },
      });

      // Seed Unified Chart of Accounts (HPP, OPEX, CAPEX, etc.)
      await tx.account.createMany({
        data: DEFAULT_CHART_OF_ACCOUNTS.map((acc) => ({
          organization_id: organization.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          normal_balance: acc.normal_balance,
          is_active: true,
          is_system: acc.is_system,
        })),
      });

      // Create primary bank account (Kas/Bank BCA) matching Excel source
      await tx.cashAccount.create({
        data: {
          organization_id: organization.id,
          name: "Kas/Bank BCA",
          type: CashAccountType.BANK,
          account_number: "BCA-OPERASIONAL",
          bank_name: "Bank Central Asia (BCA)",
          opening_balance: 0,
          opening_date: new Date(),
          is_active: true,
        },
      });

      // Create primary petty cash
      await tx.cashAccount.create({
        data: {
          organization_id: organization.id,
          name: "Kas Kecil (Petty Cash)",
          type: CashAccountType.CASH,
          opening_balance: 0,
          opening_date: new Date(),
          is_active: true,
        },
      });

      // Create current year accounting period
      const now = new Date();
      await tx.accountingPeriod.create({
        data: {
          organization_id: organization.id,
          name: `${now.getFullYear()}`,
          start_date: new Date(now.getFullYear(), 0, 1),
          end_date: new Date(now.getFullYear(), 11, 31),
          is_closed: false,
        },
      });
    });

    // Also sync Supabase profiles for RLS queries
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email || input.email || "",
      full_name: user.user_metadata?.full_name || null,
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error: any) {
    console.error("Setup organization error:", error);
    return { error: error.message || "Gagal menginisialisasi ruang kerja organisasi" };
  }
}
