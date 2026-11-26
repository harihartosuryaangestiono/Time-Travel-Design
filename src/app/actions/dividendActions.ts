"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";
import { getCashLedgerAccountCode } from "@/lib/accounting/cashLedgerAccount";
import { buildDividendDisbursementJournalLines } from "@/lib/accounting/dividendJournal";
import { createJournal, postJournal } from "@/lib/accounting/journalService";
import {
  CreateDividendDisbursementSchema,
  type CreateDividendDisbursementInput,
} from "@/lib/validation/dividendDisbursement";

export async function getDividendDisbursements() {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const { data: disbursements, error } = await supabase
    .from("dividend_disbursements")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false });

  if (error) throw new Error(`Gagal memuat pencairan dividen: ${error.message}`);

  const accountIds = Array.from(new Set((disbursements || []).map((item) => item.cash_account_id)));
  const { data: accounts, error: accountError } = accountIds.length
    ? await supabase
        .from("cash_accounts")
        .select("id, name")
        .eq("organization_id", user.organizationId)
        .in("id", accountIds)
    : { data: [], error: null };
  if (accountError) throw new Error(`Gagal memuat rekening dividen: ${accountError.message}`);

  const accountNames = new Map((accounts || []).map((account) => [account.id, account.name]));
  return (disbursements || []).map((item) => ({
    ...item,
    cash_account_name: accountNames.get(item.cash_account_id) || "Rekening perusahaan",
  }));
}

export async function createDividendDisbursement(rawInput: CreateDividendDisbursementInput) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Owner atau Bagian Keuangan yang dapat mencatat pencairan dividen.");
  }

  const input = CreateDividendDisbursementSchema.parse(rawInput);
  const supabase = await createClient();
  const { data: cashAccount, error: cashAccountError } = await supabase
    .from("cash_accounts")
    .select("id, name, type, bank_name")
    .eq("organization_id", user.organizationId)
    .eq("id", input.cash_account_id)
    .eq("is_active", true)
    .maybeSingle();

  if (cashAccountError) throw new Error(`Gagal memvalidasi rekening dividen: ${cashAccountError.message}`);
  if (!cashAccount) throw new Error("Rekening pencairan dividen tidak ditemukan atau tidak aktif.");

  const cashAccountCode = getCashLedgerAccountCode(
    cashAccount.type,
    cashAccount.bank_name,
    cashAccount.name
  );
  const { data: ledgerAccounts, error: ledgerAccountError } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .in("code", ["3200", cashAccountCode]);

  if (ledgerAccountError) {
    throw new Error(`Gagal memuat akun jurnal dividen: ${ledgerAccountError.message}`);
  }
  const ledgerAccountIds = new Map((ledgerAccounts || []).map((account) => [account.code, account.id]));
  const retainedEarningsAccountId = ledgerAccountIds.get("3200");
  const cashLedgerAccountId = ledgerAccountIds.get(cashAccountCode);
  if (!retainedEarningsAccountId || !cashLedgerAccountId) {
    throw new Error(
      `Akun buku besar laba ditahan (3200) dan kas (${cashAccountCode}) harus tersedia dan aktif untuk mencatat dividen.`
    );
  }

  const { data: disbursement, error: insertError } = await supabase
    .from("dividend_disbursements")
    .insert({
      organization_id: user.organizationId,
      cash_account_id: cashAccount.id,
      recipient_name: input.recipient_name,
      date: new Date(`${input.date}T00:00:00.000Z`).toISOString(),
      amount: input.amount,
      reference: input.reference || null,
      notes: input.notes || null,
      created_by: user.profileId || user.id,
    })
    .select()
    .single();
  if (insertError) throw new Error(`Gagal menyimpan pencairan dividen: ${insertError.message}`);

  let journalId: string | null = null;
  try {
    const journal = await createJournal({
      date: input.date,
      description: `Pencairan dividen kepada ${input.recipient_name}`,
      source_type: "DIVIDEND_DISBURSEMENT",
      source_id: disbursement.id,
      lines: buildDividendDisbursementJournalLines({
        retainedEarningsAccountId,
        cashAccountId: cashLedgerAccountId,
        amount: input.amount,
        recipientName: input.recipient_name,
        cashAccountName: cashAccount.name,
      }),
    });

    journalId = journal.id;
    await postJournal(journal.id);
  } catch (journalError) {
    let journalCleanupError: string | null = null;
    if (journalId) {
      const { data: journalState, error: journalStateError } = await supabase
        .from("journal_entries")
        .select("status")
        .eq("id", journalId)
        .eq("organization_id", user.organizationId)
        .maybeSingle();
      if (journalStateError) {
        throw new Error(
          `Pencairan dividen sudah tersimpan, tetapi status jurnal tidak dapat dipastikan: ${journalStateError.message}. Periksa jurnal ${journalId} sebelum mencoba ulang.`
        );
      }
      if (journalState?.status === "POSTED") {
        throw new Error(
          `Jurnal pencairan dividen sudah terposting (${journalId}), tetapi proses tindak lanjut gagal. Pencairan tetap tersimpan; jangan buat ulang.`
        );
      }
      if (journalState && journalState.status !== "DRAFT") {
        throw new Error(
          `Jurnal pencairan dividen berstatus ${journalState.status}; pencatatan tetap tersimpan dan perlu diperiksa sebelum mencoba ulang.`
        );
      }

      const { error: linesError } = await supabase
        .from("journal_lines")
        .delete()
        .eq("journal_id", journalId);
      const { error: draftError } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", journalId)
        .eq("organization_id", user.organizationId)
        .eq("status", "DRAFT");
      journalCleanupError = linesError?.message || draftError?.message || null;
    }

    const { error: rollbackError } = await supabase
      .from("dividend_disbursements")
      .delete()
      .eq("id", disbursement.id)
      .eq("organization_id", user.organizationId);

    if (rollbackError || journalCleanupError) {
      throw new Error(
        `Gagal memposting jurnal dividen: ${journalError instanceof Error ? journalError.message : "kesalahan tidak diketahui"}. Pembersihan juga gagal: ${journalCleanupError || rollbackError?.message}`
      );
    }
    throw journalError;
  }

  await logAudit(user, {
    action: "CREATE_DIVIDEND_DISBURSEMENT",
    entityType: "DIVIDEND_DISBURSEMENT",
    entityId: disbursement.id,
    metadata: {
      recipient_name: input.recipient_name,
      amount: input.amount,
      cash_account_id: cashAccount.id,
      cash_account_name: cashAccount.name,
      journal_id: journalId,
    },
  });

  for (const path of [
    "/cash-advances",
    "/cash-book",
    "/cash-accounts",
    "/reports/general-ledger",
    "/reports/trial-balance",
    "/reports/balance-sheet",
    "/reports/cash-flow",
  ]) {
    revalidatePath(path);
  }

  return disbursement;
}
