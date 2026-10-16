"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export interface CashAccountInput {
  name: string;
  type: "BANK" | "CASH";
  account_number?: string;
  bank_name?: string;
  opening_balance?: number;
}

export async function createCashAccountRecord(input: CashAccountInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_accounts")
    .insert({
      organization_id: user.organizationId,
      name: input.name,
      type: input.type,
      account_number: input.account_number || null,
      bank_name: input.bank_name || null,
      opening_balance: input.opening_balance || 0,
      opening_date: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-accounts");
  return data;
}

export async function updateCashAccountRecord(id: string, input: Partial<CashAccountInput>) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_accounts")
    .update(input)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-accounts");
  return data;
}

export async function deleteCashAccountRecord(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("cash_accounts")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-accounts");
  return { success: true };
}
