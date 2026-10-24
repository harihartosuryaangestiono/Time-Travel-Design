"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";

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

  const { data: transfers, error } = await supabase
    .from("cash_transfers")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const accountIds = Array.from(
    new Set(
      (transfers || []).flatMap((transfer) => [
        transfer.from_account_id,
        transfer.to_account_id,
      ])
    )
  );
  const creatorIds = Array.from(
    new Set((transfers || []).map((transfer) => transfer.created_by).filter(Boolean))
  ) as string[];

  const [{ data: accounts, error: accountsError }, { data: creators, error: creatorsError }] =
    await Promise.all([
      accountIds.length
        ? supabase
            .from("cash_accounts")
            .select("id, name, account_number")
            .eq("organization_id", user.organizationId)
            .in("id", accountIds)
        : Promise.resolve({ data: [], error: null }),
      creatorIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", creatorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (accountsError) {
    throw new Error(`Gagal memuat rekening transfer: ${accountsError.message}`);
  }
  if (creatorsError) {
    throw new Error(`Gagal memuat pembuat transfer: ${creatorsError.message}`);
  }

  const accountsById = new Map((accounts || []).map((account) => [account.id, account]));
  const creatorsById = new Map((creators || []).map((creator) => [creator.id, creator]));

  return (transfers || []).map((transfer) => ({
    ...transfer,
    from_account: accountsById.get(transfer.from_account_id) || null,
    to_account: accountsById.get(transfer.to_account_id) || null,
    creator: transfer.created_by ? creatorsById.get(transfer.created_by) || null : null,
  }));
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

  // 1. Simpan transfer record (mutasi tercatat di tabel cash_transfers)
  // Aturan: Saldo kas dihitung dari opening_balance + mutasi, jangan menimpa opening_balance.
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

  // 2. Tulis audit logs
  await logAudit(user, {
    action: "CREATE_TRANSFER",
    entityType: "CASH_TRANSFER",
    entityId: transferRecord.id,
    metadata: {
      reference: refCode,
      amount: input.amount,
      from_account_id: input.from_account_id,
      to_account_id: input.to_account_id,
    },
  });

  revalidatePath("/transfers");
  revalidatePath("/cash-accounts");
  revalidatePath("/dashboard");
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

  await logAudit(user, {
    action: "DELETE_TRANSFER",
    entityType: "CASH_TRANSFER",
    entityId: id,
  });

  revalidatePath("/transfers");
  revalidatePath("/cash-accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
