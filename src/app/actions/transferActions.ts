"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export interface CreateTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date?: string;
  reference?: string;
  notes?: string;
}

export async function getCashTransfers() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_transfers")
    .select(`
      *,
      from_account:cash_accounts!from_account_id(id, name, account_number),
      to_account:cash_accounts!to_account_id(id, name, account_number),
      creator:profiles!created_by(full_name, email)
    `)
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createCashTransfer(input: CreateTransferInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!input.from_account_id || !input.to_account_id) {
    throw new Error("Akun sumber dan akun tujuan wajib dipilih.");
  }

  if (input.from_account_id === input.to_account_id) {
    throw new Error("Akun sumber dan akun tujuan tidak boleh sama.");
  }

  if (!input.amount || input.amount <= 0) {
    throw new Error("Nominal transfer harus lebih besar dari 0.");
  }

  const transferDate = input.date ? new Date(input.date).toISOString() : new Date().toISOString();
  let refCode = input.reference?.trim();
  if (!refCode) {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    refCode = `TRF-${year}-${rand}`;
  }

  // 1. Simpan transfer record
  const { data: transferRecord, error: transferError } = await supabase
    .from("cash_transfers")
    .insert({
      organization_id: user.organizationId,
      from_account_id: input.from_account_id,
      to_account_id: input.to_account_id,
      amount: input.amount,
      date: transferDate,
      reference: refCode,
      notes: input.notes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (transferError) {
    throw new Error(transferError.message);
  }

  // 2. Update saldo akun sumber & tujuan
  const { data: fromAcc } = await supabase
    .from("cash_accounts")
    .select("current_balance")
    .eq("id", input.from_account_id)
    .single();

  const { data: toAcc } = await supabase
    .from("cash_accounts")
    .select("current_balance")
    .eq("id", input.to_account_id)
    .single();

  if (fromAcc) {
    const curFrom = parseFloat(fromAcc.current_balance || "0");
    await supabase
      .from("cash_accounts")
      .update({ current_balance: curFrom - input.amount })
      .eq("id", input.from_account_id);
  }

  if (toAcc) {
    const curTo = parseFloat(toAcc.current_balance || "0");
    await supabase
      .from("cash_accounts")
      .update({ current_balance: curTo + input.amount })
      .eq("id", input.to_account_id);
  }

  revalidatePath("/transfers");
  revalidatePath("/cash-accounts");
  return transferRecord;
}

export async function deleteCashTransfer(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("cash_transfers")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/transfers");
  revalidatePath("/cash-accounts");
  return { success: true };
}
