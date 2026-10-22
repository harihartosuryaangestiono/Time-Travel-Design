"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { getAccountsWithCalculatedBalance } from "@/lib/accounting/cashBalance";

export interface CashAccountInput {
  name: string;
  type: "BANK" | "CASH";
  account_number?: string;
  bank_name?: string;
  opening_balance?: number;
}

export async function getCashAccountsWithBalances() {
  const user = await requireAuthUser();
  const balances = await getAccountsWithCalculatedBalance(user.organizationId);

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("cash_accounts")
    .select("id, name, type, bank_name, account_number, opening_balance, opening_date")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("name");

  const balanceMap = new Map<string, number>();
  balances.forEach((b) => balanceMap.set(b.accountId, b.currentBalance));

  return (accounts || []).map((acc: any) => {
    const rawOpening = parseFloat(acc.opening_balance || "0");
    const current = balanceMap.has(acc.id)
      ? balanceMap.get(acc.id)!
      : rawOpening;

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      bank_name: acc.bank_name,
      account_number: acc.account_number,
      opening_balance: isNaN(rawOpening) ? 0 : rawOpening,
      current_balance: isNaN(current) ? 0 : current,
    };
  });
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
