"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import type { CashAdvanceStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit/auditLogger";
import { EXCEL_CATEGORY_TO_ACCOUNT_CODE } from "@/lib/accounting/defaultCoa";
import {
  GENERAL_EXPENSE_CATEGORIES,
  PROJECT_EXPENSE_CATEGORIES,
  normalizeExpenseCategory,
} from "@/lib/accounting/expenseCategories";
import { createJournal, postJournal, reverseJournal } from "@/lib/accounting/journalService";
import {
  CreateCashAdvanceSchema,
  SaveAdvanceRecipientSchema,
  SettleAdvanceSchema,
  type AdvanceRecapItem,
  type CreateCashAdvanceInput,
  type SaveAdvanceRecipientInput,
  type SettleAdvanceInput,
} from "@/lib/validation/cashAdvance";

// ============================================
// RECIPIENT ACTIONS
// ============================================

export async function getAdvanceRecipients() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: recipients, error } = await supabase
    .from("advance_recipients")
    .select(`
      *,
      project:projects!project_id(id, name, code)
    `)
    .eq("organization_id", user.organizationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching advance recipients:", error.message);
    return [];
  }

  return recipients || [];
}

export async function saveAdvanceRecipient(rawInput: SaveAdvanceRecipientInput) {
  const user = await requireAuthUser();
  const input = SaveAdvanceRecipientSchema.parse(rawInput);
  const supabase = await createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("advance_recipients")
      .update({
        type: input.type,
        profile_id: input.profile_id || null,
        name: input.name,
        phone: input.phone || null,
        project_id: input.project_id || null,
        max_advance_amount: input.max_advance_amount,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("organization_id", user.organizationId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit(user, {
      action: "UPDATE_ADVANCE_RECIPIENT",
      entityType: "ADVANCE_RECIPIENT",
      entityId: input.id,
      metadata: { name: input.name, max_advance_amount: input.max_advance_amount },
    });

    revalidatePath("/cash-advances");
    return data;
  } else {
    const { data, error } = await supabase
      .from("advance_recipients")
      .insert({
        organization_id: user.organizationId,
        type: input.type,
        profile_id: input.profile_id || null,
        name: input.name,
        phone: input.phone || null,
        project_id: input.project_id || null,
        max_advance_amount: input.max_advance_amount,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit(user, {
      action: "CREATE_ADVANCE_RECIPIENT",
      entityType: "ADVANCE_RECIPIENT",
      entityId: data.id,
      metadata: { name: input.name, max_advance_amount: input.max_advance_amount },
    });

    revalidatePath("/cash-advances");
    return data;
  }
}

// ============================================
// CASH ADVANCES ACTIONS
// ============================================

export async function getCashAdvances(filters?: {
  status?: CashAdvanceStatus;
  employee_id?: string;
  advance_type?: string;
  project_id?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("cash_advances")
    .select(`
      *,
      employee:profiles!employee_id(id, full_name, email, max_advance_amount),
      recipient:advance_recipients!recipient_id(id, name, type, max_advance_amount),
      project:projects!project_id(id, name, code, labor_advance_limit)
    `)
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }

  if (filters?.advance_type) {
    query = query.eq("advance_type", filters.advance_type);
  }

  if (filters?.project_id) {
    query = query.eq("project_id", filters.project_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_advances")
    .select(`
      *,
      employee:profiles!employee_id(id, full_name, email, max_advance_amount),
      recipient:advance_recipients!recipient_id(*),
      project:projects!project_id(*),
      settlements:advance_settlements(*)
    `)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Kasbon internal tidak dibatasi plafon. Batas proyek hanya berlaku untuk data kasbon mandor lama.
 */
export async function checkAdvanceLimit(input: {
  advance_type: "EMPLOYEE" | "OWNER" | "MANDOR";
  employee_id?: string | null;
  recipient_id?: string | null;
  project_id?: string | null;
  proposed_amount: number;
  exclude_advance_id?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (input.advance_type !== "MANDOR") {
    return {
      type: input.advance_type,
      recipientName: input.advance_type === "OWNER" ? "Owner" : "Staff",
      maxLimit: 0,
      currentOpenBalance: 0,
      remainingLimit: Infinity,
      isExceeded: false,
      message: "Kasbon internal tidak dibatasi plafon.",
    };
  }

  if (!input.project_id) {
    return {
      type: "MANDOR",
      recipientName: "Mandor",
      maxLimit: 0,
      currentOpenBalance: 0,
      remainingLimit: 0,
      isExceeded: false,
      message: "Kasbon mandor tanpa batas proyek spesifik.",
    };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, labor_advance_limit")
    .eq("organization_id", user.organizationId)
    .eq("id", input.project_id)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memeriksa plafon proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek kasbon tidak ditemukan.");

  const laborLimit = parseFloat(project.labor_advance_limit || "0") || 0;
  if (laborLimit <= 0) {
    return {
      type: "MANDOR",
      recipientName: project.name,
      maxLimit: 0,
      currentOpenBalance: 0,
      remainingLimit: Infinity,
      isExceeded: false,
      message: "Proyek tidak memiliki batasan plafon upah tukang khusus.",
    };
  }

  let query = supabase
    .from("cash_advances")
    .select("id, amount, disbursed_amount, settled_amount, returned_amount")
    .eq("organization_id", user.organizationId)
    .eq("project_id", input.project_id)
    .eq("advance_type", "MANDOR")
    .in("status", ["DISBURSED", "PARTIALLY_SETTLED"]);
  if (input.exclude_advance_id) query = query.neq("id", input.exclude_advance_id);
  const { data: activeProjectAdvances, error: advancesError } = await query;
  if (advancesError) throw new Error(`Gagal memeriksa kasbon aktif proyek: ${advancesError.message}`);

  const currentProjectOpenBalance = (activeProjectAdvances || []).reduce((sum, advance) => {
    const disbursed = parseFloat(advance.disbursed_amount || advance.amount || "0") || 0;
    const settled = parseFloat(advance.settled_amount || "0") || 0;
    const returned = parseFloat(advance.returned_amount || "0") || 0;
    return sum + Math.max(0, disbursed - settled - returned);
  }, 0);

  const remainingLimit = Math.max(0, laborLimit - currentProjectOpenBalance);
  const isExceeded = input.proposed_amount > remainingLimit;
  return {
    type: "MANDOR",
    recipientName: project.name,
    maxLimit: laborLimit,
    currentOpenBalance: currentProjectOpenBalance,
    remainingLimit,
    isExceeded,
    message: isExceeded
      ? `Pengajuan Rp ${input.proposed_amount.toLocaleString("id-ID")} melebihi sisa plafon kasbon Upah Tukang untuk proyek ${project.name} (Sisa Plafon: Rp ${remainingLimit.toLocaleString("id-ID")} dari limit Rp ${laborLimit.toLocaleString("id-ID")}).`
      : "Pengajuan kasbon upah tukang proyek masih dalam batas plafon.",
  };
}

function getCashLedgerCode(type: string, bankName?: string | null, accountName?: string | null) {
  const label = `${bankName || ""} ${accountName || ""}`.toLowerCase();
  if (type === "BANK" && label.includes("mandiri")) return "1120";
  if (type === "BANK" && label.includes("bca")) return "1110";
  return "1100";
}

async function getCashLedgerCodeForAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  cashAccountId: string | null
) {
  if (!cashAccountId) throw new Error("Rekening kas pencairan tidak ditemukan.");
  const { data: cashAccount, error } = await supabase
    .from("cash_accounts")
    .select("name, type, bank_name")
    .eq("organization_id", organizationId)
    .eq("id", cashAccountId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat rekening kas: ${error.message}`);
  if (!cashAccount) throw new Error("Rekening kas tidak ditemukan atau tidak aktif.");
  return getCashLedgerCode(cashAccount.type, cashAccount.bank_name, cashAccount.name);
}

async function postInternalAdvanceJournal(input: {
  id: string;
  date: string;
  amount: number;
  description: string;
  cashAccountId: string;
}): Promise<string> {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const { data: existingJournal, error: existingJournalError } = await supabase
    .from("journal_entries")
    .select("id, status")
    .eq("organization_id", user.organizationId)
    .eq("source_type", "CASH_ADVANCE_DISBURSEMENT")
    .eq("source_id", input.id)
    .maybeSingle();
  if (existingJournalError) {
    throw new Error(`Gagal memeriksa jurnal pencairan kasbon: ${existingJournalError.message}`);
  }
  if (existingJournal) {
    if (existingJournal.status === "POSTED") return existingJournal.id;
    if (existingJournal.status !== "DRAFT") {
      throw new Error(`Jurnal pencairan kasbon berstatus ${existingJournal.status} dan perlu diperiksa.`);
    }
    await postJournal(existingJournal.id);
    return existingJournal.id;
  }
  const { data: cashAccount, error: cashAccountError } = await supabase
    .from("cash_accounts")
    .select("id, name, type, bank_name")
    .eq("organization_id", user.organizationId)
    .eq("id", input.cashAccountId)
    .eq("is_active", true)
    .maybeSingle();
  if (cashAccountError) throw new Error(`Gagal memuat rekening kasbon: ${cashAccountError.message}`);
  if (!cashAccount) throw new Error("Rekening kasbon tidak ditemukan atau tidak aktif.");

  const cashCode = getCashLedgerCode(cashAccount.type, cashAccount.bank_name, cashAccount.name);
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .in("code", ["1300", cashCode]);
  if (accountsError) throw new Error(`Gagal memuat akun jurnal kasbon: ${accountsError.message}`);

  const accountIds = new Map((accounts || []).map((account) => [account.code, account.id]));
  const receivableAccountId = accountIds.get("1300");
  const cashAccountLedgerId = accountIds.get(cashCode);
  if (!receivableAccountId || !cashAccountLedgerId) {
    throw new Error(`Akun buku besar 1300 dan ${cashCode} harus tersedia dan aktif untuk mencairkan kasbon internal.`);
  }

  const journal = await createJournal({
    date: input.date,
    description: `Pencairan kasbon: ${input.description}`,
    source_type: "CASH_ADVANCE_DISBURSEMENT",
    source_id: input.id,
    lines: [
      { account_id: receivableAccountId, debit: input.amount, credit: 0 },
      { account_id: cashAccountLedgerId, debit: 0, credit: input.amount },
    ],
  });

  try {
    await postJournal(journal.id);
  } catch (error) {
    const { error: linesError } = await supabase
      .from("journal_lines")
      .delete()
      .eq("journal_id", journal.id);
    const { error: journalError } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", journal.id)
      .eq("organization_id", user.organizationId)
      .eq("status", "DRAFT");
    if (linesError || journalError) {
      throw new Error(
        `Gagal memposting jurnal kasbon: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}. Pembersihan jurnal Draft juga gagal: ${linesError?.message || journalError?.message}`
      );
    }
    throw error;
  }
  return journal.id;
}

async function postInternalAdvanceEditJournal(input: {
  id: string;
  date: string;
  oldAmount: number;
  oldCashAccountId: string;
  newAmount: number;
  newCashAccountId: string;
  description: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const oldCashCode = await getCashLedgerCodeForAccount(
    supabase,
    user.organizationId,
    input.oldCashAccountId
  );
  const newCashCode = await getCashLedgerCodeForAccount(
    supabase,
    user.organizationId,
    input.newCashAccountId
  );
  const codes = Array.from(new Set(["1300", oldCashCode, newCashCode]));
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .in("code", codes);
  if (error) throw new Error(`Gagal memuat akun jurnal perubahan kasbon: ${error.message}`);

  const accountIds = new Map((accounts || []).map((account) => [account.code, account.id]));
  const receivableAccountId = accountIds.get("1300");
  const oldCashAccountLedgerId = accountIds.get(oldCashCode);
  const newCashAccountLedgerId = accountIds.get(newCashCode);
  if (!receivableAccountId || !oldCashAccountLedgerId || !newCashAccountLedgerId) {
    throw new Error("Akun piutang kasbon atau akun kas/bank yang aktif tidak ditemukan.");
  }

  const journal = await createJournal({
    date: input.date,
    description: `Penyesuaian perubahan kasbon: ${input.description}`,
    source_type: "CASH_ADVANCE_EDIT",
    source_id: `${input.id}:${crypto.randomUUID()}`,
    lines: [
      { account_id: oldCashAccountLedgerId, debit: input.oldAmount, credit: 0 },
      { account_id: receivableAccountId, debit: 0, credit: input.oldAmount },
      { account_id: receivableAccountId, debit: input.newAmount, credit: 0 },
      { account_id: newCashAccountLedgerId, debit: 0, credit: input.newAmount },
    ],
  });

  try {
    await postJournal(journal.id);
  } catch (postError) {
    const { error: linesError } = await supabase
      .from("journal_lines")
      .delete()
      .eq("journal_id", journal.id);
    const { error: journalError } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", journal.id)
      .eq("organization_id", user.organizationId)
      .eq("status", "DRAFT");
    if (linesError || journalError) {
      throw new Error(
        `Gagal memposting penyesuaian kasbon: ${postError instanceof Error ? postError.message : "kesalahan tidak diketahui"}. Pembersihan jurnal Draft juga gagal: ${linesError?.message || journalError?.message}`
      );
    }
    throw postError;
  }

  return journal.id;
}

/**
 * Menyimpan atau memperbarui data kasbon dengan pengecekan plafon dan audit logs
 */
export async function saveCashAdvanceRecord(rawInput: CreateCashAdvanceInput) {
  const user = await requireAuthUser();
  const input = CreateCashAdvanceSchema.parse(rawInput);
  const supabase = await createClient();
  let recipientId = input.recipient_id || null;
  if (!input.id && input.status === "APPROVED") {
    throw new Error("Setujui kasbon melalui proses persetujuan.");
  }
  if (
    !input.id &&
    (input.status === "PARTIALLY_SETTLED" || input.status === "SETTLED")
  ) {
    throw new Error("Catat pelunasan melalui proses pelunasan kasbon.");
  }

  if (input.advance_type !== "MANDOR") {
    const recipientName = input.recipient_name?.trim();
    if (!recipientName) throw new Error("Nama penerima kasbon wajib diisi.");
    if (
      input.advance_type === "OWNER" &&
      !["Dustin", "Emir", "Om Dodi"].includes(recipientName)
    ) {
      throw new Error("Pilih owner yang terdaftar.");
    }

    const { data: existingRecipient, error: recipientLookupError } = await supabase
      .from("advance_recipients")
      .select("id")
      .eq("organization_id", user.organizationId)
      .eq("type", input.advance_type)
      .ilike("name", recipientName)
      .eq("is_active", true)
      .maybeSingle();
    if (recipientLookupError) {
      throw new Error(`Gagal memeriksa penerima kasbon: ${recipientLookupError.message}`);
    }
    if (existingRecipient) {
      recipientId = existingRecipient.id;
    } else {
      const { data: newRecipient, error: recipientInsertError } = await supabase
        .from("advance_recipients")
        .insert({
          organization_id: user.organizationId,
          type: input.advance_type,
          name: recipientName,
          max_advance_amount: 0,
          is_active: true,
        })
        .select("id")
        .single();
      if (recipientInsertError || !newRecipient) {
        throw new Error(`Gagal menambahkan penerima kasbon: ${recipientInsertError?.message || "Data tidak tersedia."}`);
      }
      recipientId = newRecipient.id;
    }
  }

  // 1. Cek Batasan Plafon
  if (input.advance_type === "MANDOR") {
    const limitCheck = await checkAdvanceLimit({
      advance_type: input.advance_type,
      employee_id: input.employee_id,
      recipient_id: recipientId,
      project_id: input.project_id,
      proposed_amount: input.amount,
      exclude_advance_id: input.id,
    });
    if (limitCheck.isExceeded) {
      throw new Error(limitCheck.message);
    }
  }

  const isInternalAdvance = input.advance_type !== "MANDOR";
  const isDisbursed = input.status === "DISBURSED";
  if (
    isInternalAdvance &&
    isDisbursed &&
    !["OWNER", "FINANCE"].includes(user.role)
  ) {
    throw new Error("Hanya Bagian Keuangan atau Owner yang dapat mencairkan kasbon internal.");
  }
  if (isInternalAdvance && isDisbursed && !input.cash_account_id) {
    throw new Error("Pilih rekening/kas yang digunakan untuk mencairkan kasbon.");
  }

  if (input.id) {
    // UPDATE
    const { data: existing, error: existingError } = await supabase
      .from("cash_advances")
      .select("status, organization_id, created_by, employee_id, advance_type, amount, disbursed_amount, settled_amount, returned_amount, cash_account_id, date, disbursed_by, disbursed_at")
      .eq("id", input.id)
      .single();

    if (existingError) throw new Error(`Gagal memuat kasbon: ${existingError.message}`);
    if (!existing || existing.organization_id !== user.organizationId) {
      throw new Error("Data kasbon tidak ditemukan.");
    }
    const wasDisbursed = ["DISBURSED", "PARTIALLY_SETTLED", "SETTLED"].includes(existing.status);
    if (!wasDisbursed && input.status === "APPROVED") {
      throw new Error("Setujui kasbon melalui proses persetujuan.");
    }
    if (
      !wasDisbursed &&
      (input.status === "PARTIALLY_SETTLED" || input.status === "SETTLED")
    ) {
      throw new Error("Catat pelunasan melalui proses pelunasan kasbon.");
    }
    if (wasDisbursed && !["OWNER", "FINANCE"].includes(user.role)) {
      throw new Error("Hanya Owner atau Bagian Keuangan yang dapat mengedit kasbon yang sudah dicairkan.");
    }
    if (wasDisbursed && existing.advance_type !== input.advance_type) {
      throw new Error("Jenis kasbon tidak dapat diubah setelah kasbon dicairkan.");
    }
    if (wasDisbursed && input.date !== String(existing.date).slice(0, 10)) {
      throw new Error("Tanggal kasbon yang sudah dicairkan tidak dapat diubah karena terkait jurnal akuntansi.");
    }
    if (!wasDisbursed && existing.status === "APPROVED" && input.status !== "DISBURSED") {
      throw new Error("Kasbon yang disetujui hanya dapat dilanjutkan ke proses pencairan.");
    }

    const settledAmount = Number(existing.settled_amount || 0);
    const returnedAmount = Number(existing.returned_amount || 0);
    const totalSettled = settledAmount + returnedAmount;
    if (wasDisbursed && input.amount < totalSettled) {
      throw new Error("Nominal kasbon tidak boleh lebih kecil dari total nota dan pengembalian yang sudah dicatat.");
    }
    if (
      wasDisbursed &&
      returnedAmount > 0 &&
      input.cash_account_id !== existing.cash_account_id
    ) {
      throw new Error("Rekening pencairan tidak dapat diubah setelah ada pengembalian tunai.");
    }
    if (wasDisbursed && existing.advance_type !== "MANDOR" && !input.cash_account_id) {
      throw new Error("Pilih rekening/kas pencairan.");
    }

    const finalStatus = wasDisbursed
      ? totalSettled >= input.amount
        ? "SETTLED"
        : totalSettled > 0
          ? "PARTIALLY_SETTLED"
          : "DISBURSED"
      : input.status;
    const shouldBeDisbursed = wasDisbursed || finalStatus === "DISBURSED";
    let adjustmentJournalId: string | null = null;
    if (
      wasDisbursed &&
      existing.advance_type !== "MANDOR" &&
      (Number(existing.disbursed_amount || existing.amount) !== input.amount ||
        existing.cash_account_id !== input.cash_account_id)
    ) {
      const { data: disbursementJournal, error: journalLookupError } = await supabase
        .from("journal_entries")
        .select("id, status")
        .eq("organization_id", user.organizationId)
        .eq("source_type", "CASH_ADVANCE_DISBURSEMENT")
        .eq("source_id", input.id)
        .maybeSingle();
      if (journalLookupError) {
        throw new Error(`Gagal memeriksa jurnal pencairan: ${journalLookupError.message}`);
      }

      if (disbursementJournal?.status === "POSTED") {
        adjustmentJournalId = await postInternalAdvanceEditJournal({
          id: input.id,
          date: existing.date,
          oldAmount: Number(existing.disbursed_amount || existing.amount),
          oldCashAccountId: existing.cash_account_id!,
          newAmount: input.amount,
          newCashAccountId: input.cash_account_id!,
          description: input.purpose,
        });
      } else if (disbursementJournal) {
        throw new Error("Jurnal pencairan kasbon tidak berstatus Posted. Periksa jurnal sebelum mengedit.");
      } else {
        adjustmentJournalId = await postInternalAdvanceJournal({
          id: input.id,
          date: existing.date,
          amount: input.amount,
          description: input.purpose,
          cashAccountId: input.cash_account_id!,
        });
      }
    }

    const { data, error } = await supabase
      .from("cash_advances")
      .update({
        date: input.date,
        advance_type: input.advance_type,
        recipient_id: recipientId,
        employee_id: input.employee_id || existing.employee_id,
        mandor_name: input.mandor_name || null,
        wage_category: input.advance_type === "MANDOR" ? "Upah Tukang" : input.wage_category,
        project_id: input.project_id || null,
        cash_account_id: input.cash_account_id || null,
        purpose: input.purpose,
        amount: input.amount,
        disbursed_by: wasDisbursed
          ? existing.disbursed_by
          : shouldBeDisbursed
            ? user.profileId || user.id
            : null,
        disbursed_at: wasDisbursed
          ? existing.disbursed_at
          : shouldBeDisbursed
            ? new Date().toISOString()
            : null,
        disbursed_amount: shouldBeDisbursed ? input.amount : 0,
        status: finalStatus,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      if (adjustmentJournalId) {
        try {
          await reverseJournal(
            adjustmentJournalId,
            `Pembatalan otomatis karena perubahan data kasbon gagal: ${error.message}`,
            existing.date
          );
        } catch (reversalError) {
          throw new Error(
            `Gagal memperbarui kasbon: ${error.message}. Jurnal penyesuaian ${adjustmentJournalId} juga gagal dibalik: ${reversalError instanceof Error ? reversalError.message : "kesalahan tidak diketahui"}`
          );
        }
      }
      throw new Error(error.message);
    }

    if (
      isInternalAdvance &&
      shouldBeDisbursed &&
      !wasDisbursed
    ) {
      try {
        await postInternalAdvanceJournal({
          id: data.id,
          date: input.date,
          amount: input.amount,
          description: input.purpose,
          cashAccountId: input.cash_account_id!,
        });
      } catch (journalError) {
        const { error: rollbackError } = await supabase
          .from("cash_advances")
          .update({
            status: existing.status,
            disbursed_amount: 0,
            cash_account_id: null,
            disbursed_by: null,
            disbursed_at: null,
          })
          .eq("id", input.id)
          .eq("organization_id", user.organizationId);
        if (rollbackError) {
          throw new Error(
            `Gagal membuat jurnal kasbon: ${journalError instanceof Error ? journalError.message : "kesalahan tidak diketahui"}. Pengembalian status juga gagal: ${rollbackError.message}`
          );
        }
        throw journalError;
      }
    }

    await logAudit(user, {
      action: "UPDATE_CASH_ADVANCE",
      entityType: "CASH_ADVANCE",
      entityId: input.id,
      metadata: {
        number: input.number,
        amount: input.amount,
        status: input.status,
        advance_type: input.advance_type,
      },
    });

    revalidatePath("/cash-advances");
    revalidatePath("/cash-book");
    revalidatePath("/cash-accounts");
    revalidatePath("/reports/general-ledger");
    revalidatePath("/reports/trial-balance");
    revalidatePath("/reports/income-statement");
    revalidatePath("/reports/balance-sheet");
    return data;
  } else {
    // CREATE NEW
    const targetDate = new Date(input.date || Date.now());
    const yearMonth = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const randNum = String(Math.floor(Math.random() * 9000) + 1000);
    const number = input.number || `CA-${yearMonth}-${randNum}`;

    const effectiveEmployeeId = input.employee_id || user.profileId || user.id;

    const { data, error } = await supabase
      .from("cash_advances")
      .insert({
        organization_id: user.organizationId,
        number,
        date: input.date,
        advance_type: input.advance_type,
        recipient_id: recipientId,
        employee_id: effectiveEmployeeId,
        mandor_name: input.mandor_name || null,
        wage_category: input.advance_type === "MANDOR" ? "Upah Tukang" : input.wage_category,
        project_id: input.project_id || null,
        cash_account_id: input.cash_account_id || null,
        purpose: input.purpose,
        amount: input.amount,
        disbursed_by: isDisbursed ? user.profileId || user.id : null,
        disbursed_at: isDisbursed ? new Date().toISOString() : null,
        disbursed_amount: isDisbursed ? input.amount : 0,
        settled_amount: 0,
        returned_amount: 0,
        status: input.status,
        notes: input.notes,
        created_by: user.profileId || user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (isInternalAdvance && isDisbursed) {
      try {
        await postInternalAdvanceJournal({
          id: data.id,
          date: input.date,
          amount: input.amount,
          description: input.purpose,
          cashAccountId: input.cash_account_id!,
        });
      } catch (journalError) {
        const { error: cleanupError } = await supabase
          .from("cash_advances")
          .delete()
          .eq("id", data.id)
          .eq("organization_id", user.organizationId);
        if (cleanupError) {
          throw new Error(
            `Gagal membuat jurnal kasbon: ${journalError instanceof Error ? journalError.message : "kesalahan tidak diketahui"}. Penghapusan kasbon juga gagal: ${cleanupError.message}`
          );
        }
        throw journalError;
      }
    }

    await logAudit(user, {
      action: "CREATE_CASH_ADVANCE",
      entityType: "CASH_ADVANCE",
      entityId: data.id,
      metadata: {
        number,
        amount: input.amount,
        advance_type: input.advance_type,
        mandor_name: input.mandor_name,
      },
    });

    revalidatePath("/cash-advances");
    revalidatePath("/cash-book");
    revalidatePath("/cash-accounts");
    revalidatePath("/reports/general-ledger");
    revalidatePath("/reports/trial-balance");
    revalidatePath("/reports/income-statement");
    revalidatePath("/reports/balance-sheet");
    return data;
  }
}

/**
 * Approve Kasbon:
 * Kebutuhan Bisnis:
 * - Larang approve pengajuan sendiri (employee_id === user.profileId ATAU created_by === user.profileId)
 * - Tulis audit_logs
 */
export async function approveCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Anda tidak memiliki kewenangan untuk menyetujui pengajuan kasbon.");
  }

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("id, number, status, organization_id, employee_id, recipient_id, created_by, amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  if (existing.status !== "SUBMITTED" && existing.status !== "DRAFT") {
    throw new Error("Kasbon harus berstatus Draft atau Diajukan sebelum disetujui.");
  }

  // ATURAN: Larang approve pengajuan sendiri
  const actorProfileId = user.profileId || user.id;
  if (
    (!existing.recipient_id && existing.employee_id === actorProfileId) ||
    existing.created_by === actorProfileId ||
    existing.created_by === user.id
  ) {
    throw new Error("Anda tidak dapat menyetujui pengajuan kasbon yang Anda ajukan sendiri.");
  }

  const { error } = await supabase
    .from("cash_advances")
    .update({
      status: "APPROVED",
      approved_by: actorProfileId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "APPROVE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: id,
    metadata: { number: existing.number, amount: existing.amount },
  });

  revalidatePath("/cash-advances");
  return { success: true };
}

/**
 * Pencairan Kasbon:
 * - Memeriksa akun kas
 * - Mengupdate disbursed_amount
 * - Tulis audit_logs
 */
export async function disburseCashAdvance(id: string, cash_account_id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Bagian Keuangan atau Owner yang dapat mencairkan kasbon.");
  }

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("id, number, status, organization_id, amount, date, purpose, advance_type")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  if (existing.status !== "APPROVED") {
    throw new Error("Kasbon harus disetujui terlebih dahulu sebelum dicairkan.");
  }

  // Validasi akun kas aktif
  const { data: account, error: accountError } = await supabase
    .from("cash_accounts")
    .select("id, name, type, bank_name")
    .eq("id", cash_account_id)
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .single();

  if (accountError) throw new Error(`Gagal memvalidasi rekening kas: ${accountError.message}`);
  if (!account) {
    throw new Error("Rekening kas tidak valid atau tidak aktif.");
  }

  const actorProfileId = user.profileId || user.id;

  const { error } = await supabase
    .from("cash_advances")
    .update({
      status: "DISBURSED",
      disbursed_amount: existing.amount,
      cash_account_id,
      disbursed_by: actorProfileId,
      disbursed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  if (existing.advance_type !== "MANDOR") {
    try {
      await postInternalAdvanceJournal({
        id: existing.id,
        date: existing.date,
        amount: Number(existing.amount),
        description: existing.purpose,
        cashAccountId: account.id,
      });
    } catch (journalError) {
      const { error: rollbackError } = await supabase
        .from("cash_advances")
        .update({
          status: "APPROVED",
          disbursed_amount: 0,
          cash_account_id: null,
          disbursed_by: null,
          disbursed_at: null,
        })
        .eq("id", id)
        .eq("organization_id", user.organizationId);
      if (rollbackError) {
        throw new Error(
          `Gagal membuat jurnal pencairan kasbon: ${journalError instanceof Error ? journalError.message : "kesalahan tidak diketahui"}. Pengembalian status juga gagal: ${rollbackError.message}`
        );
      }
      throw journalError;
    }
  }

  await logAudit(user, {
    action: "DISBURSE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: id,
    metadata: {
      number: existing.number,
      amount: existing.amount,
      cash_account_id,
      account_name: account.name,
    },
  });

  revalidatePath("/cash-advances");
  revalidatePath("/cash-book");
  revalidatePath("/cash-accounts");
  revalidatePath("/reports/general-ledger");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/income-statement");
  revalidatePath("/reports/balance-sheet");
  return { success: true };
}

/**
 * Pelunasan Kasbon (Settlement):
 * Kebutuhan Bisnis:
 * - Metode pelunasan: Tunai (CASH), Cicilan (INSTALLMENT), Potong Gaji (PAYROLL_DEDUCTION), Bukti Nota (EXPENSE)
 * - Otomatis transisi: DISBURSED -> PARTIALLY_SETTLED -> SETTLED
 * - Tulis audit_logs
 */
export async function settleCashAdvanceRecord(rawInput: SettleAdvanceInput) {
  const user = await requireAuthUser();
  const input = SettleAdvanceSchema.parse(rawInput);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("id, number, status, organization_id, amount, disbursed_amount, settled_amount, returned_amount, advance_type, cash_account_id")
    .eq("id", input.cash_advance_id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  if (existing.status !== "DISBURSED" && existing.status !== "PARTIALLY_SETTLED") {
    throw new Error("Hanya kasbon yang sudah dicairkan atau belum lunas yang dapat diproses pelunasannya.");
  }

  const disbursed = parseFloat(existing.disbursed_amount || existing.amount || "0") || 0;
  const currentSettled = parseFloat(existing.settled_amount || "0") || 0;
  const currentReturned = parseFloat(existing.returned_amount || "0") || 0;
  const currentOpenBalance = Math.max(0, disbursed - currentSettled - currentReturned);

  if (input.amount > currentOpenBalance) {
    throw new Error(
      `Nominal pelunasan (Rp ${input.amount.toLocaleString("id-ID")}) melebihi sisa kasbon yang belum lunas (Rp ${currentOpenBalance.toLocaleString("id-ID")}).`
    );
  }

  const actorProfileId = user.profileId || user.id;
  const isReturnCash = input.settlement_method === "CASH";
  const isInternalAdvance = existing.advance_type !== "MANDOR";
  let expenseCategory: string | null = null;
  if (isInternalAdvance) {
    if (!["CASH", "EXPENSE"].includes(input.settlement_method)) {
      throw new Error("Kasbon internal hanya dapat diselesaikan dengan pengembalian tunai atau nota pengeluaran.");
    }
    if (input.settlement_method === "EXPENSE") {
      expenseCategory =
        normalizeExpenseCategory(input.category, "GENERAL") ||
        normalizeExpenseCategory(input.category, "PROJECT");
      if (!expenseCategory) {
        throw new Error("Pilih kategori pengeluaran untuk mencatat nota kasbon.");
      }
    }
    if (isReturnCash && !existing.cash_account_id) {
      throw new Error("Kasbon ini belum memiliki rekening pencairan. Hubungi bagian keuangan.");
    }
  }

  // 1. Simpan baris pelunasan ke advance_settlements
  const { data: settlementRecord, error: settleErr } = await supabase
    .from("advance_settlements")
    .insert({
      cash_advance_id: input.cash_advance_id,
      date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
      description: input.description,
      amount: input.amount,
      type: isReturnCash ? "RETURN" : "EXPENSE",
      settlement_method: input.settlement_method,
      expense_id: input.expense_id || null,
      notes: input.notes || null,
      created_by: actorProfileId,
    })
    .select()
    .single();

  if (settleErr) {
    throw new Error(settleErr.message);
  }

  let settlementJournalId: string | null = null;
  const settlementDate = input.date || new Date().toISOString().slice(0, 10);
  if (isInternalAdvance) {
    try {
      const counterpartCode = isReturnCash
        ? await getCashLedgerCodeForAccount(supabase, user.organizationId, existing.cash_account_id)
        : EXCEL_CATEGORY_TO_ACCOUNT_CODE[expenseCategory!] || "6800";
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id, code")
        .eq("organization_id", user.organizationId)
        .eq("is_active", true)
        .in("code", ["1300", counterpartCode]);
      if (accountsError) throw new Error(`Gagal memuat akun jurnal pelunasan: ${accountsError.message}`);

      const accountIds = new Map((accounts || []).map((account) => [account.code, account.id]));
      const receivableAccountId = accountIds.get("1300");
      const counterpartAccountId = accountIds.get(counterpartCode);
      if (!receivableAccountId || !counterpartAccountId) {
        throw new Error(`Akun buku besar 1300 dan ${counterpartCode} harus tersedia dan aktif.`);
      }

      const journal = await createJournal({
        date: settlementDate,
        description: input.description,
        source_type: "CASH_ADVANCE_SETTLEMENT",
        source_id: settlementRecord.id,
        lines: isReturnCash
          ? [
              { account_id: counterpartAccountId, debit: input.amount, credit: 0 },
              { account_id: receivableAccountId, debit: 0, credit: input.amount },
            ]
          : [
              { account_id: counterpartAccountId, debit: input.amount, credit: 0 },
              { account_id: receivableAccountId, debit: 0, credit: input.amount },
            ],
      });
      settlementJournalId = journal.id;
      await postJournal(journal.id);
    } catch (journalError) {
      const { error: cleanupError } = await supabase
        .from("advance_settlements")
        .delete()
        .eq("id", settlementRecord.id);
      if (cleanupError) {
        throw new Error(
          `Gagal membuat jurnal pelunasan: ${journalError instanceof Error ? journalError.message : "kesalahan tidak diketahui"}. Pembersihan pelunasan juga gagal: ${cleanupError.message}`
        );
      }
      throw journalError;
    }
  }

  // 2. Hitung akumulasi baru
  const newSettledAmount = isReturnCash ? currentSettled : currentSettled + input.amount;
  const newReturnedAmount = isReturnCash ? currentReturned + input.amount : currentReturned;
  const totalAccounted = newSettledAmount + newReturnedAmount;

  let newStatus: CashAdvanceStatus = "PARTIALLY_SETTLED";
  if (totalAccounted >= disbursed) {
    newStatus = "SETTLED";
  }

  // 3. Update status dan nominal di cash_advances
  const { error: updateErr } = await supabase
    .from("cash_advances")
    .update({
      status: newStatus,
      settled_amount: newSettledAmount,
      returned_amount: newReturnedAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.cash_advance_id);

  if (updateErr) {
    if (settlementJournalId) {
      try {
        await reverseJournal(
          settlementJournalId,
          `Pembatalan otomatis karena pembaruan kasbon gagal: ${updateErr.message}`,
          settlementDate
        );
      } catch (reversalError) {
        throw new Error(
          `Gagal memperbarui saldo kasbon: ${updateErr.message}. Jurnal pelunasan ${settlementJournalId} juga gagal dibalik: ${reversalError instanceof Error ? reversalError.message : "kesalahan tidak diketahui"}`
        );
      }
    }
    const { error: cleanupError } = await supabase
      .from("advance_settlements")
      .delete()
      .eq("id", settlementRecord.id);
    if (cleanupError) {
      throw new Error(
        `Gagal memperbarui saldo kasbon: ${updateErr.message}. Penghapusan catatan pelunasan juga gagal: ${cleanupError.message}`
      );
    }
    throw new Error(updateErr.message);
  }

  // 4. Catat Audit Log
  await logAudit(user, {
    action: "SETTLE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: input.cash_advance_id,
    metadata: {
      number: existing.number,
      settlement_amount: input.amount,
      method: input.settlement_method,
      new_status: newStatus,
      remaining_open: Math.max(0, disbursed - totalAccounted),
    },
  });

  revalidatePath("/cash-advances");
  revalidatePath("/cash-book");
  revalidatePath("/cash-accounts");
  revalidatePath("/reports/general-ledger");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/income-statement");
  revalidatePath("/reports/balance-sheet");
  return {
    success: true,
    settlement: settlementRecord,
    newStatus,
  };
}

export async function deleteCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("cash_advances")
    .select("number, organization_id, status, advance_type")
    .eq("id", id)
    .single();

  if (existingError) throw new Error(`Gagal memuat kasbon: ${existingError.message}`);
  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }
  const wasDisbursed = ["DISBURSED", "PARTIALLY_SETTLED", "SETTLED"].includes(existing.status);
  if (wasDisbursed && !["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Owner atau Bagian Keuangan yang dapat menghapus kasbon yang sudah dicairkan.");
  }

  const { data: settlements, error: settlementsError } = await supabase
    .from("advance_settlements")
    .select("id")
    .eq("cash_advance_id", id);
  if (settlementsError) {
    throw new Error(`Gagal memuat riwayat pelunasan kasbon: ${settlementsError.message}`);
  }

  const journalQueries = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, status, date")
      .eq("organization_id", user.organizationId)
      .eq("source_type", "CASH_ADVANCE_DISBURSEMENT")
      .eq("source_id", id),
    settlements?.length
      ? supabase
          .from("journal_entries")
          .select("id, status, date")
          .eq("organization_id", user.organizationId)
          .eq("source_type", "CASH_ADVANCE_SETTLEMENT")
          .in("source_id", settlements.map((settlement) => settlement.id))
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("journal_entries")
      .select("id, status, date")
      .eq("organization_id", user.organizationId)
      .eq("source_type", "CASH_ADVANCE_EDIT")
      .like("source_id", `${id}:%`),
  ]);
  const journalError = journalQueries.find((result) => result.error)?.error;
  if (journalError) {
    throw new Error(`Gagal memuat jurnal kasbon: ${journalError.message}`);
  }
  const relatedJournals = journalQueries.flatMap((result) => result.data || []);

  for (const journal of relatedJournals) {
    if (journal.status === "POSTED") {
      await reverseJournal(
        journal.id,
        `Kasbon ${existing.number} dihapus`,
        new Date().toISOString().slice(0, 10)
      );
    } else if (journal.status === "DRAFT") {
      const { error: linesError } = await supabase
        .from("journal_lines")
        .delete()
        .eq("journal_id", journal.id);
      if (linesError) {
        throw new Error(`Gagal menghapus baris jurnal Draft: ${linesError.message}`);
      }
      const { error: draftError } = await supabase
        .from("journal_entries")
        .delete()
        .eq("organization_id", user.organizationId)
        .eq("id", journal.id)
        .eq("status", "DRAFT");
      if (draftError) {
        throw new Error(`Gagal menghapus jurnal Draft: ${draftError.message}`);
      }
    } else if (journal.status !== "REVERSED") {
      throw new Error(`Jurnal ${journal.id} berstatus ${journal.status}; kasbon tidak dapat dihapus.`);
    }
  }

  const { error: deleteSettlementsError } = await supabase
    .from("advance_settlements")
    .delete()
    .eq("cash_advance_id", id);
  if (deleteSettlementsError) {
    throw new Error(
      `Jurnal kasbon sudah dibalik, tetapi riwayat pelunasan gagal dihapus: ${deleteSettlementsError.message}`
    );
  }

  const { error } = await supabase
    .from("cash_advances")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(`Jurnal kasbon sudah dibalik, tetapi data kasbon gagal dihapus: ${error.message}`);
  }

  await logAudit(user, {
    action: "DELETE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: id,
    metadata: { number: existing.number },
  });

  revalidatePath("/cash-advances");
  revalidatePath("/cash-book");
  revalidatePath("/cash-accounts");
  revalidatePath("/reports/general-ledger");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/income-statement");
  revalidatePath("/reports/balance-sheet");
  return { success: true };
}

/**
 * REKAPITULASI KASBON SEMUA ORANG (Karyawan & Mandor):
 * Kebutuhan Bisnis:
 * - Menampilkan Plafon, Total Kasbon Dicairkan, Total Diselesaikan, Open Balance, Sisa Plafon
 * - Menghitung status batas plafon (Aman / Mendekati Limit / Melebihi)
 * - Digunakan untuk tampilan tabel rekap & export Excel
 */
export async function getCashAdvanceRecap(): Promise<AdvanceRecapItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 1. Ambil semua kasbon yang relevan
  const { data: advanceRows, error } = await supabase
    .from("cash_advances")
    .select("id, number, advance_type, recipient_id, employee_id, mandor_name, project_id, amount, disbursed_amount, settled_amount, returned_amount, status")
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(`Gagal memuat kasbon untuk rekapitulasi: ${error.message}`);
  }

  // 2. Ambil master recipients dan profiles untuk memastikan semua orang terdaftar muncul
  const { data: recipientRows, error: recipientsError } = await supabase
    .from("advance_recipients")
    .select("id, name, type, max_advance_amount, project_id")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true);
  if (recipientsError) {
    throw new Error(`Gagal memuat penerima kasbon: ${recipientsError.message}`);
  }

  const employeeIds = Array.from(
    new Set((advanceRows || []).map((advance) => advance.employee_id).filter(Boolean))
  ) as string[];
  const projectIds = Array.from(
    new Set([
      ...(advanceRows || []).map((advance) => advance.project_id),
      ...(recipientRows || []).map((recipient) => recipient.project_id),
    ].filter(Boolean))
  ) as string[];
  const [{ data: employees, error: employeesError }, { data: projects, error: projectsError }] =
    await Promise.all([
      employeeIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, email, max_advance_amount")
            .in("id", employeeIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? supabase
            .from("projects")
            .select("id, name, code, labor_advance_limit")
            .eq("organization_id", user.organizationId)
            .in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (employeesError) throw new Error(employeesError.message);
  if (projectsError) throw new Error(projectsError.message);

  const employeesById = new Map((employees || []).map((employee) => [employee.id, employee]));
  const projectsById = new Map((projects || []).map((project) => [project.id, project]));
  const recipientsById = new Map((recipientRows || []).map((recipient) => [recipient.id, recipient]));
  const registeredRecipients = (recipientRows || []).map((recipient) => ({
    ...recipient,
    project: recipient.project_id ? projectsById.get(recipient.project_id) : null,
  }));
  const advances = (advanceRows || []).map((advance) => ({
    ...advance,
    employee: advance.employee_id ? employeesById.get(advance.employee_id) : null,
    recipient: advance.recipient_id ? recipientsById.get(advance.recipient_id) : null,
    project: advance.project_id ? projectsById.get(advance.project_id) : null,
  }));

  const recapMap = new Map<string, AdvanceRecapItem>();

  // Inisialisasi dari master recipients
  (registeredRecipients || []).forEach((r: any) => {
    const isMandor = r.type === "MANDOR";
    const maxAdvanceAmount = isMandor
      ? parseFloat(r.max_advance_amount || "0") || 0
      : 0;
    recapMap.set(r.id, {
      id: r.id,
      name: r.name,
      type: (r.type as any) || "EMPLOYEE",
      projectName: r.project?.name || null,
      maxAdvanceAmount,
      totalDisbursed: 0,
      totalSettled: 0,
      openBalance: 0,
      remainingLimit: maxAdvanceAmount,
      activeCount: 0,
      statusLimit: isMandor && maxAdvanceAmount > 0 ? "AMAN" : "TIDAK_DIBATASI",
    });
  });

  // Agregasi dari transaksi kasbon
  advances.forEach((ca: any) => {
    const isMandor = ca.advance_type === "MANDOR";
    const key = ca.recipient_id || ca.employee_id || ca.mandor_name || "Lainnya";

    const disb = parseFloat(ca.disbursed_amount || ca.amount || "0") || 0;
    const setl = (parseFloat(ca.settled_amount || "0") || 0) + (parseFloat(ca.returned_amount || "0") || 0);
    const open = Math.max(0, disb - setl);
    const isActive = ca.status === "DISBURSED" || ca.status === "PARTIALLY_SETTLED";

    if (!recapMap.has(key)) {
      const displayName = isMandor
        ? ca.mandor_name || `Mandor (${ca.project?.name || "Proyek"})`
        : ca.recipient?.name || ca.employee?.full_name || ca.employee?.email || "Karyawan";

      const maxLimit = isMandor
        ? parseFloat(ca.project?.labor_advance_limit || "0") || 0
        : 0;
      const recipientType = ca.recipient?.type || (isMandor ? "MANDOR" : "EMPLOYEE");

      recapMap.set(key, {
        id: key,
        name: displayName,
        type: recipientType,
        projectName: ca.project?.name || null,
        maxAdvanceAmount: maxLimit,
        totalDisbursed: 0,
        totalSettled: 0,
        openBalance: 0,
        remainingLimit: maxLimit,
        activeCount: 0,
        statusLimit: maxLimit > 0 ? "AMAN" : "TIDAK_DIBATASI",
      });
    }

    const item = recapMap.get(key)!;
    item.totalDisbursed += disb;
    item.totalSettled += setl;
    item.openBalance += open;
    if (isActive) item.activeCount += 1;
  });

  // Finalisasi Sisa Plafon & Status Limit
  const recapList = Array.from(recapMap.values()).map((item) => {
    const remaining = item.maxAdvanceAmount > 0
      ? Math.max(0, item.maxAdvanceAmount - item.openBalance)
      : 0;
    item.remainingLimit = remaining;

    if (item.maxAdvanceAmount > 0) {
      const usagePercent = (item.openBalance / item.maxAdvanceAmount) * 100;
      if (usagePercent > 100) {
        item.statusLimit = "MELEBIHI_LIMIT";
      } else if (usagePercent >= 80) {
        item.statusLimit = "MENDEKATI_LIMIT";
      } else {
        item.statusLimit = "AMAN";
      }
    } else {
      item.statusLimit = "TIDAK_DIBATASI";
    }

    return item;
  });

  // Urutkan berdasarkan open balance terbesar
  return recapList.sort((a, b) => b.openBalance - a.openBalance);
}
