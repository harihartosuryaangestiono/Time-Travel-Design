"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";
import {
  CreateFastTransactionSchema,
  UpdateCashBookTransactionSchema,
  type CashBookEntry,
  type CreateFastTransactionInput,
  type UpdateCashBookTransactionInput,
} from "@/lib/validation/cashBook";
import {
  validateExpenseBookCategory,
} from "@/lib/accounting/expenseCategories";
import { getSubcontractorPaymentOptions } from "@/app/actions/subcontractorActions";
import { postCashBookEntryToJournal } from "@/lib/accounting/cashBookPosting";
import { EXCEL_CATEGORY_TO_ACCOUNT_CODE } from "@/lib/accounting/defaultCoa";
import { reverseJournal } from "@/lib/accounting/journalService";

/**
 * Mengambil transaksi Buku Kas Perusahaan dengan perhitungan saldo berjalan kumulatif
 */
export async function getCashBookTransactions(filter?: {
  month?: number;
  year?: number;
  category?: string;
  cashAccountId?: string;
  projectId?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: accounts, error: accountsError } = await supabase
    .from("cash_accounts")
    .select("id, name, opening_balance")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("name");

  if (accountsError) throw new Error(`Gagal memuat rekening: ${accountsError.message}`);
  const selectedAccount = (accounts || []).find((account) => account.id === filter?.cashAccountId)
    || accounts?.[0];
  if (!selectedAccount) {
    return { entries: [], currentBalance: 0, openingBalance: 0, accounts: [] };
  }
  const openingBal = Number(selectedAccount.opening_balance || 0);

  const [{ data: expenses, error: expensesError }, { data: receipts, error: receiptsError },
    { data: projectRevenues, error: revenuesError }, { data: invoicePayments, error: paymentsError }] =
    await Promise.all([
      supabase
    .from("expenses")
    .select("id, date, number, description, total_amount, category, needs_category, project_id, source, status")
    .eq("organization_id", user.organizationId)
    .eq("cash_account_id", selectedAccount.id)
    .in("status", ["APPROVED", "POSTED"])
    .order("date", { ascending: true })
    .order("created_at", { ascending: true }),
      supabase
        .from("cash_receipts")
        .select("id, date, amount, description, category")
        .eq("organization_id", user.organizationId)
        .eq("cash_account_id", selectedAccount.id)
        .order("date", { ascending: true }),
      supabase
        .from("project_revenues")
        .select("id, date, amount, description, project_id, source")
        .eq("organization_id", user.organizationId)
        .eq("cash_account_id", selectedAccount.id)
        .order("date", { ascending: true }),
      supabase
        .from("invoice_payments")
        .select("id, payment_date, amount, invoice_id, reference")
        .eq("cash_account_id", selectedAccount.id)
        .order("payment_date", { ascending: true }),
    ]);

  if (expensesError) throw new Error(`Gagal memuat pengeluaran: ${expensesError.message}`);
  if (receiptsError) throw new Error(`Gagal memuat pemasukan: ${receiptsError.message}`);
  if (revenuesError) throw new Error(`Gagal memuat pendapatan proyek: ${revenuesError.message}`);
  if (paymentsError) throw new Error(`Gagal memuat pembayaran invoice: ${paymentsError.message}`);

  const invoiceIds = Array.from(new Set((invoicePayments || []).map((payment) => payment.invoice_id)));
  const { data: invoices, error: invoicesError } = invoiceIds.length
    ? await supabase
        .from("invoices")
        .select("id, project_id")
        .eq("organization_id", user.organizationId)
        .in("id", invoiceIds)
    : { data: [], error: null };
  if (invoicesError) throw new Error(`Gagal memuat proyek pembayaran invoice: ${invoicesError.message}`);
  const projectByInvoiceId = new Map((invoices || []).map((invoice) => [invoice.id, invoice.project_id]));

  const entries: CashBookEntry[] = [{
    id: "OPENING_BALANCE",
    date: `${filter?.year || new Date().getFullYear()}-01-01`,
    description: "Saldo awal rekening",
    debit: openingBal,
    kredit: 0,
    balance: openingBal,
    category: "Saldo Awal",
    needs_category: false,
    type: "OPENING",
    source_type: "CASH_OPENING_BALANCE",
    can_edit: false,
  }];

  (expenses || []).forEach((e: any) => {
    const amt = parseFloat(e.total_amount || "0") || 0;
    entries.push({
      id: e.id,
      date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
      number: e.number,
      description: e.description,
      debit: 0,
      kredit: amt,
      balance: 0,
      category: e.category || "Perlu dikategorikan",
      needs_category: e.needs_category || !e.category,
      project_id: e.project_id,
      type: "EXPENSE",
      source_type: "CASH_BOOK_EXPENSE",
      can_edit: e.source === "MANUAL",
    });
  });

  (receipts || []).forEach((receipt: any) => entries.push({
    id: receipt.id,
    date: receipt.date ? new Date(receipt.date).toISOString().split("T")[0] : "",
    description: receipt.description,
    debit: Number(receipt.amount || 0),
    kredit: 0,
    balance: 0,
    category: receipt.category || "Pemasukan Lainnya",
    needs_category: false,
    type: "INCOME",
    source_type: "CASH_RECEIPT",
    can_edit: true,
  }));
  (projectRevenues || []).forEach((revenue: any) => entries.push({
    id: revenue.id,
    date: revenue.date ? new Date(revenue.date).toISOString().split("T")[0] : "",
    description: revenue.description,
    debit: Number(revenue.amount || 0),
    kredit: 0,
    balance: 0,
    category: "Pendapatan Proyek",
    needs_category: false,
    project_id: revenue.project_id,
    type: "INCOME",
    source_type: "PROJECT_REVENUE",
    can_edit: revenue.source === "MANUAL",
  }));
  (invoicePayments || []).forEach((payment: any) => entries.push({
    id: payment.id,
    date: payment.payment_date ? new Date(payment.payment_date).toISOString().split("T")[0] : "",
    description: `Pembayaran invoice${payment.reference ? ` • ${payment.reference}` : ""}`,
    debit: Number(payment.amount || 0),
    kredit: 0,
    balance: 0,
    category: "Pembayaran Invoice",
    needs_category: false,
    project_id: projectByInvoiceId.get(payment.invoice_id) || null,
    type: "INCOME",
    source_type: "INVOICE_PAYMENT",
    can_edit: false,
  }));

  entries.sort((a, b) => a.date.localeCompare(b.date));
  let runningBalance = 0;
  entries.forEach((entry) => {
    runningBalance += entry.debit - entry.kredit;
    entry.balance = runningBalance;
  });
  const currentBalance = runningBalance;

  let filtered = entries;
  if (filter?.month) {
    filtered = entries.filter((ent) => ent.type === "OPENING" || new Date(ent.date).getMonth() + 1 === filter.month);
  }

  if (filter?.category && filter.category !== "ALL") {
    filtered = filtered.filter((ent) => ent.type === "OPENING" || ent.category === filter.category);
  }

  if (filter?.projectId) {
    filtered = filtered.filter(
      (ent) => ent.type === "OPENING" || ent.project_id === filter.projectId
    );
  }

  return {
    entries: filtered.reverse(),
    currentBalance,
    openingBalance: openingBal,
    accounts: accounts || [],
  };
}

/**
 * Autocomplete saran keterangan dari riwayat transaksi
 */
export async function getRecentDescriptions(): Promise<string[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("expenses")
    .select("description")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const set = new Set<string>();
  (data || []).forEach((d: any) => {
    if (d.description?.trim()) set.add(d.description.trim());
  });

  return Array.from(set).slice(0, 15);
}

type LegacyCashBookItem = {
  sourceType:
    | "CASH_BOOK_EXPENSE"
    | "PROJECT_REVENUE"
    | "CASH_RECEIPT"
    | "INVOICE_PAYMENT"
    | "CASH_OPENING_BALANCE";
  sourceId: string;
  date: string;
  description: string;
  amount: number;
  category?: string | null;
  transactionType: "INCOME" | "EXPENSE" | "INVOICE_PAYMENT" | "OPENING_BALANCE";
  cashAccountId: string;
  cashAccountType: "CASH" | "BANK" | "E_WALLET" | "OTHER";
  cashAccountName?: string;
  bankName?: string | null;
  projectId?: string | null;
};

async function getLegacyCashBookItems(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error("Rentang tanggal backfill tidak valid.");
  }
  const user = await requireAuthUser();
  const supabase = await createClient();
  const [{ data: accounts, error: accountsError }, { data: expenses, error: expensesError },
    { data: revenues, error: revenuesError }, { data: receipts, error: receiptsError }] =
    await Promise.all([
      supabase
        .from("cash_accounts")
        .select("id, name, type, bank_name, opening_date, opening_balance")
        .eq("organization_id", user.organizationId),
      supabase
        .from("expenses")
        .select("id, date, description, total_amount, category, cash_account_id, project_id, journal_entry_id")
        .eq("organization_id", user.organizationId)
        .in("status", ["APPROVED", "POSTED"])
        .not("cash_account_id", "is", null)
        .is("journal_entry_id", null)
        .gte("date", `${startDate}T00:00:00.000Z`)
        .lte("date", `${endDate}T23:59:59.999Z`),
      supabase
        .from("project_revenues")
        .select("id, date, description, amount, cash_account_id, project_id")
        .eq("organization_id", user.organizationId)
        .not("cash_account_id", "is", null)
        .gte("date", `${startDate}T00:00:00.000Z`)
        .lte("date", `${endDate}T23:59:59.999Z`),
      supabase
        .from("cash_receipts")
        .select("id, date, description, amount, category, cash_account_id")
        .eq("organization_id", user.organizationId)
        .gte("date", `${startDate}T00:00:00.000Z`)
        .lte("date", `${endDate}T23:59:59.999Z`),
    ]);
  if (accountsError) throw new Error(`Gagal memuat rekening untuk backfill: ${accountsError.message}`);
  if (expensesError) throw new Error(`Gagal memuat pengeluaran untuk backfill: ${expensesError.message}`);
  if (revenuesError) throw new Error(`Gagal memuat pendapatan proyek untuk backfill: ${revenuesError.message}`);
  if (receiptsError) throw new Error(`Gagal memuat penerimaan untuk backfill: ${receiptsError.message}`);

  const accountById = new Map((accounts || []).map((account) => [account.id, account]));
  const items: LegacyCashBookItem[] = [];
  (accounts || []).forEach((account) => {
    const openingDate = String(account.opening_date || "").slice(0, 10);
    const amount = Number(account.opening_balance || 0);
    if (openingDate < startDate || openingDate > endDate || !Number.isFinite(amount) || amount <= 0) return;
    items.push({
      sourceType: "CASH_OPENING_BALANCE",
      sourceId: account.id,
      date: account.opening_date,
      description: `Saldo awal ${account.name}`,
      amount,
      category: "Saldo Awal",
      transactionType: "OPENING_BALANCE",
      cashAccountId: account.id,
      cashAccountType: account.type,
      cashAccountName: account.name,
      bankName: account.bank_name,
    });
  });
  (expenses || []).forEach((row) => {
    const account = accountById.get(row.cash_account_id);
    if (!account) return;
    items.push({
      sourceType: "CASH_BOOK_EXPENSE",
      sourceId: row.id,
      date: row.date,
      description: row.description,
      amount: Number(row.total_amount || 0),
      category: row.category,
      transactionType: "EXPENSE",
      cashAccountId: account.id,
      cashAccountType: account.type,
      cashAccountName: account.name,
      bankName: account.bank_name,
      projectId: row.project_id,
    });
  });
  (revenues || []).forEach((row) => {
    const account = accountById.get(row.cash_account_id);
    if (!account) return;
    items.push({
      sourceType: "PROJECT_REVENUE",
      sourceId: row.id,
      date: row.date,
      description: row.description,
      amount: Number(row.amount || 0),
      category: "Pendapatan Proyek",
      transactionType: "INCOME",
      cashAccountId: account.id,
      cashAccountType: account.type,
      cashAccountName: account.name,
      bankName: account.bank_name,
      projectId: row.project_id,
    });
  });
  (receipts || []).forEach((row) => {
    const account = accountById.get(row.cash_account_id);
    if (!account) return;
    items.push({
      sourceType: "CASH_RECEIPT",
      sourceId: row.id,
      date: row.date,
      description: row.description,
      amount: Number(row.amount || 0),
      category: row.category,
      transactionType: "INCOME",
      cashAccountId: account.id,
      cashAccountType: account.type,
      cashAccountName: account.name,
      bankName: account.bank_name,
    });
  });

  const accountIds = (accounts || []).map((account) => account.id);
  if (accountIds.length) {
    const { data: payments, error: paymentsError } = await supabase
      .from("invoice_payments")
      .select("id, payment_date, amount, invoice_id, reference, cash_account_id")
      .in("cash_account_id", accountIds)
      .gte("payment_date", `${startDate}T00:00:00.000Z`)
      .lte("payment_date", `${endDate}T23:59:59.999Z`);
    if (paymentsError) throw new Error(`Gagal memuat pembayaran invoice untuk backfill: ${paymentsError.message}`);

    const invoiceIds = Array.from(new Set((payments || []).map((payment) => payment.invoice_id)));
    const { data: invoices, error: invoicesError } = invoiceIds.length
      ? await supabase
          .from("invoices")
          .select("id")
          .eq("organization_id", user.organizationId)
          .in("id", invoiceIds)
      : { data: [], error: null };
    if (invoicesError) throw new Error(`Gagal memvalidasi invoice untuk backfill: ${invoicesError.message}`);
    const validInvoiceIds = new Set((invoices || []).map((invoice) => invoice.id));
    (payments || []).forEach((row) => {
      if (!validInvoiceIds.has(row.invoice_id)) return;
      const account = accountById.get(row.cash_account_id);
      if (!account) return;
      items.push({
        sourceType: "INVOICE_PAYMENT",
        sourceId: row.id,
        date: row.payment_date,
        description: `Pembayaran invoice${row.reference ? ` • ${row.reference}` : ""}`,
        amount: Number(row.amount || 0),
        category: "Pembayaran Invoice",
        transactionType: "INVOICE_PAYMENT",
        cashAccountId: account.id,
        cashAccountType: account.type,
        cashAccountName: account.name,
        bankName: account.bank_name,
      });
    });
  }

  const sourceIds = Array.from(new Set(items.map((item) => item.sourceId)));
  if (!sourceIds.length) return items;
  const { data: journalRows, error: journalsError } = await supabase
    .from("journal_entries")
    .select("source_type, source_id, status")
    .eq("organization_id", user.organizationId)
    .in("source_id", sourceIds);
  if (journalsError) throw new Error(`Gagal memeriksa jurnal lama: ${journalsError.message}`);
  const postedSources = new Set(
    (journalRows || [])
      .filter((journal) => journal.status === "POSTED")
      .map((journal) => `${journal.source_type}:${journal.source_id}`)
  );
  return items.filter((item) => !postedSources.has(`${item.sourceType}:${item.sourceId}`));
}

export async function previewCashBookLedgerBackfill(startDate: string, endDate: string) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat menyiapkan jurnal transaksi lama.");
  }
  const items = await getLegacyCashBookItems(startDate, endDate);
  return {
    count: items.length,
    totalAmount: items.reduce((total, item) => total + item.amount, 0),
  };
}

export async function backfillCashBookLedger(startDate: string, endDate: string) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat memposting jurnal transaksi lama.");
  }
  const supabase = await createClient();
  const items = await getLegacyCashBookItems(startDate, endDate);
  const failures: string[] = [];
  let postedCount = 0;

  for (const item of items) {
    try {
      const journal = await postCashBookEntryToJournal(item);
      if (item.sourceType === "CASH_BOOK_EXPENSE") {
        const { error } = await supabase
          .from("expenses")
          .update({ journal_entry_id: journal.id, status: "POSTED" })
          .eq("id", item.sourceId)
          .eq("organization_id", user.organizationId);
        if (error) throw new Error(`Jurnal ${journal.number} terbuat, tetapi voucher gagal ditautkan: ${error.message}`);
      }
      postedCount += 1;
    } catch (error) {
      failures.push(`${item.description}: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}`);
    }
  }

  revalidatePath("/cash-book");
  revalidatePath("/reports/general-ledger");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/income-statement");
  revalidatePath("/reports/balance-sheet");
  return { postedCount, failedCount: failures.length, failures };
}

/**
 * Simpan transaksi cepat ala Excel
 */
export async function createFastTransaction(rawInput: CreateFastTransactionInput) {
  const user = await requireAuthUser();
  const input = CreateFastTransactionSchema.parse(rawInput);
  const supabase = await createClient();

  if (!input.category?.trim()) throw new Error("Kategori transaksi wajib dipilih.");
  if (input.type === "EXPENSE") {
    if (input.subcontractor_contract_id && !input.project_id) {
      throw new Error("Pilih proyek sebelum menghubungkan pembayaran ke borongan.");
    }
    const categoryError = validateExpenseBookCategory(
      input.category,
      input.project_id || input.subcontractor_contract_id ? "PROJECT" : "GENERAL"
    );
    if (categoryError) throw new Error(categoryError);
  }

  const { data: account, error: accountError } = await supabase
    .from("cash_accounts")
    .select("id, name, type, bank_name")
    .eq("id", input.cash_account_id)
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (accountError) throw new Error(`Gagal memvalidasi rekening: ${accountError.message}`);
  if (!account) throw new Error("Rekening kas/bank tidak ditemukan atau tidak aktif.");

  const dateObj = new Date(input.date);
  let data: { id: string; number?: string };
  if (input.project_id) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle();
    if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
    if (!project) throw new Error("Proyek tidak ditemukan atau bukan milik organisasi ini.");
  }

  let subcontractorContract: Awaited<ReturnType<typeof getSubcontractorPaymentOptions>>[number] | null = null;
  if (input.subcontractor_contract_id) {
    if (input.type !== "EXPENSE") {
      throw new Error("Borongan subkontraktor hanya dapat ditautkan ke transaksi uang keluar.");
    }
    const contracts = await getSubcontractorPaymentOptions();
    subcontractorContract =
      contracts.find((contract) => contract.id === input.subcontractor_contract_id) || null;
    if (!subcontractorContract) {
      throw new Error("Borongan subkontraktor tidak ditemukan.");
    }
    if (subcontractorContract.projectId !== input.project_id) {
      throw new Error("Proyek transaksi harus sama dengan proyek borongan subkontraktor.");
    }
    if (input.amount > subcontractorContract.remainingAmount) {
      throw new Error(
        `Pembayaran melebihi sisa borongan ${subcontractorContract.subcontractorName}: ${subcontractorContract.remainingAmount.toLocaleString("id-ID")}.`
      );
    }
  }

  if (input.type === "INCOME") {
    if (input.project_id) {
      const { data: revenue, error } = await supabase
        .from("project_revenues")
        .insert({
          organization_id: user.organizationId,
          project_id: input.project_id,
          cash_account_id: account.id,
          date: dateObj.toISOString(),
          amount: input.amount,
          description: input.description.trim(),
          source: "MANUAL",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      data = revenue;
    } else {
      const { data: receipt, error } = await supabase
        .from("cash_receipts")
        .insert({
          organization_id: user.organizationId,
          cash_account_id: account.id,
          date: dateObj.toISOString(),
          amount: input.amount,
          description: input.description.trim(),
          category: input.category,
          created_by: user.profileId || user.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      data = receipt;
    }
  } else {
    const yearMonth = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    const number = `EXP-${yearMonth}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        organization_id: user.organizationId,
        number,
        date: dateObj.toISOString(),
        merchant: subcontractorContract?.subcontractorName || input.description.slice(0, 50),
        description: input.description.trim(),
        amount: input.amount,
        tax_amount: 0,
        total_amount: input.amount,
        cash_account_id: account.id,
        project_id: input.project_id || null,
        subcontractor_contract_id: subcontractorContract?.id || null,
        category: input.category,
        status: "APPROVED",
        needs_category: false,
        source: "MANUAL",
        submitted_by: user.profileId || user.id,
        notes: input.notes || null,
      })
      .select("id, number")
      .single();
    if (error) throw new Error(error.message);
    data = expense;
  }

  const sourceType =
    input.type === "EXPENSE"
      ? "CASH_BOOK_EXPENSE"
      : input.project_id
        ? "PROJECT_REVENUE"
        : "CASH_RECEIPT";
  const sourceTable =
    input.type === "EXPENSE"
      ? "expenses"
      : input.project_id
        ? "project_revenues"
        : "cash_receipts";
  let journal: Awaited<ReturnType<typeof postCashBookEntryToJournal>>;
  try {
    journal = await postCashBookEntryToJournal({
      sourceType,
      sourceId: data.id,
      date: dateObj.toISOString(),
      description: input.description.trim(),
      amount: input.amount,
      category: input.category,
      transactionType: input.type,
      cashAccountId: account.id,
      cashAccountType: account.type,
      cashAccountName: account.name,
      bankName: account.bank_name,
      projectId: input.project_id,
    });
  } catch (error) {
    const { error: cleanupError } = await supabase
      .from(sourceTable)
      .delete()
      .eq("id", data.id)
      .eq("organization_id", user.organizationId);
    if (cleanupError) {
      throw new Error(
        `Gagal membuat jurnal buku besar: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}. Transaksi Buku Kas juga gagal dibersihkan: ${cleanupError.message}`
      );
    }
    throw error;
  }
  if (input.type === "EXPENSE") {
    const { error: linkError } = await supabase
      .from("expenses")
      .update({ journal_entry_id: journal.id, status: "POSTED" })
      .eq("id", data.id)
      .eq("organization_id", user.organizationId);
    if (linkError) {
      throw new Error(`Jurnal berhasil dibuat tetapi tautan ke pengeluaran gagal: ${linkError.message}`);
    }
  }

  await logAudit(user, {
    action: input.type === "INCOME" ? "CREATE_CASH_INCOME" : "CREATE_FAST_EXPENSE",
    entityType: input.type === "INCOME" ? "CASH_RECEIPT" : "EXPENSE",
    entityId: data.id,
    metadata: {
      number: data?.number,
      amount: input.amount,
      category: input.category,
      project_id: input.project_id,
      cash_account_id: account.id,
      subcontractor_contract_id: subcontractorContract?.id || null,
    },
  });

  revalidatePath("/cash-book");
  revalidatePath("/reports/rekapitulasi");
  revalidatePath("/cash-accounts");
  revalidatePath("/dashboard");
  revalidatePath("/reports/cash-flow");
  revalidatePath("/reports/general-ledger");
  revalidatePath("/reports/trial-balance");
  revalidatePath("/reports/income-statement");
  revalidatePath("/reports/balance-sheet");
  revalidatePath("/subcontractor-recap");
  if (input.project_id) {
    revalidatePath(`/projects/${input.project_id}`);
  }

  return data;
}

function revalidateCashBookReports(projectIds: Array<string | null | undefined>) {
  [
    "/cash-book",
    "/reports/rekapitulasi",
    "/cash-accounts",
    "/dashboard",
    "/reports/cash-flow",
    "/reports/general-ledger",
    "/reports/trial-balance",
    "/reports/income-statement",
    "/reports/balance-sheet",
    "/subcontractor-recap",
  ].forEach((path) => revalidatePath(path));
  projectIds.filter((id): id is string => Boolean(id)).forEach((id) => revalidatePath(`/projects/${id}`));
}

function getIncomeOffsetCode(category: string, sourceType: "PROJECT_REVENUE" | "CASH_RECEIPT") {
  if (sourceType === "PROJECT_REVENUE") return "4100";
  const codes: Record<string, string> = {
    "Setoran Modal": "3100",
    "Bunga Bank": "4400",
    "Pemasukan Lainnya": "4300",
  };
  return codes[category] || "4300";
}

function getExpenseOffsetCode(category: string) {
  return EXCEL_CATEGORY_TO_ACCOUNT_CODE[category] || "6800";
}

async function getManualTransactionSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  sourceType: "CASH_BOOK_EXPENSE" | "PROJECT_REVENUE" | "CASH_RECEIPT",
  id: string
) {
  const table = {
    CASH_BOOK_EXPENSE: "expenses",
    PROJECT_REVENUE: "project_revenues",
    CASH_RECEIPT: "cash_receipts",
  }[sourceType];
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat transaksi: ${error.message}`);
  if (!data) throw new Error("Transaksi tidak ditemukan atau tidak dapat diakses.");
  if (sourceType !== "CASH_RECEIPT" && data.source !== "MANUAL") {
    throw new Error("Hanya transaksi manual yang dapat diubah dari halaman Buku Kas.");
  }
  if (
    sourceType === "CASH_BOOK_EXPENSE" &&
    !["APPROVED", "POSTED"].includes(data.status)
  ) {
    throw new Error("Status pengeluaran ini tidak dapat diubah dari Buku Kas.");
  }
  return { table, data };
}

async function getLatestPostedCashBookJournal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  sourceType: "CASH_BOOK_EXPENSE" | "PROJECT_REVENUE" | "CASH_RECEIPT",
  sourceId: string
) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, date, description, status")
    .eq("organization_id", organizationId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("status", "POSTED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat jurnal transaksi: ${error.message}`);
  return data;
}

async function assertAccountingDateOpen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  date: string
) {
  const { data: period, error } = await supabase
    .from("accounting_periods")
    .select("is_closed")
    .eq("organization_id", organizationId)
    .lte("start_date", `${date}T23:59:59.999Z`)
    .gte("end_date", `${date}T00:00:00.000Z`)
    .maybeSingle();

  if (error) throw new Error(`Gagal memeriksa periode akuntansi: ${error.message}`);
  if (period?.is_closed) {
    throw new Error("Transaksi berada pada periode akuntansi yang sudah ditutup.");
  }
}

export async function updateCashBookTransaction(rawInput: UpdateCashBookTransactionInput) {
  const user = await requireAuthUser();
  const input = UpdateCashBookTransactionSchema.parse(rawInput);
  const supabase = await createClient();
  const { table, data: original } = await getManualTransactionSource(
    supabase,
    user.organizationId,
    input.source_type,
    input.id
  );
  const isExpense = input.source_type === "CASH_BOOK_EXPENSE";
  const isProjectRevenue = input.source_type === "PROJECT_REVENUE";

  if (isExpense) {
    const categoryError = validateExpenseBookCategory(
      input.category,
      input.project_id ? "PROJECT" : "GENERAL"
    );
    if (categoryError) throw new Error(categoryError);
  } else if (isProjectRevenue) {
    if (!input.project_id) throw new Error("Pendapatan proyek harus terhubung ke proyek.");
    if (input.category !== "Pendapatan Proyek") {
      throw new Error("Kategori pendapatan proyek tidak dapat diubah.");
    }
  } else {
    if (input.project_id) throw new Error("Pemasukan umum tidak dapat dihubungkan ke proyek dari sini.");
    if (!["Setoran Modal", "Bunga Bank", "Pemasukan Lainnya"].includes(input.category)) {
      throw new Error("Pilih kategori pemasukan yang tersedia.");
    }
  }

  if (input.project_id) {
    const { data: project, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle();
    if (error) throw new Error(`Gagal memvalidasi proyek: ${error.message}`);
    if (!project) throw new Error("Proyek tidak ditemukan atau bukan milik organisasi ini.");
  }

  const journal = await getLatestPostedCashBookJournal(
    supabase,
    user.organizationId,
    input.source_type,
    input.id
  );
  if (journal) {
    await assertAccountingDateOpen(supabase, user.organizationId, journal.date.slice(0, 10));
    await assertAccountingDateOpen(supabase, user.organizationId, input.date);
  }

  const offsetCode = isExpense
    ? getExpenseOffsetCode(input.category)
    : getIncomeOffsetCode(
        input.category,
        input.source_type as "PROJECT_REVENUE" | "CASH_RECEIPT"
      );
  let originalLines: Array<{
    id: string;
    account_id: string;
    debit: number | string | null;
    credit: number | string | null;
    description: string | null;
    project_id: string | null;
  }> = [];
  let cashLine: (typeof originalLines)[number] | undefined;
  let offsetLine: (typeof originalLines)[number] | undefined;
  let offsetAccountId: string | undefined;

  if (journal) {
    const { data: lines, error: linesError } = await supabase
      .from("journal_lines")
      .select("id, account_id, debit, credit, description, project_id")
      .eq("journal_id", journal.id);
    if (linesError) throw new Error(`Gagal memuat baris jurnal: ${linesError.message}`);
    originalLines = lines || [];
    if (originalLines.length !== 2) {
      throw new Error("Jurnal transaksi tidak valid dan tidak dapat diubah.");
    }

    cashLine = originalLines.find((line) =>
      isExpense ? Number(line.credit || 0) > 0 : Number(line.debit || 0) > 0
    );
    offsetLine = originalLines.find((line) => line.id !== cashLine?.id);
    if (!cashLine || !offsetLine) {
      throw new Error("Baris kas pada jurnal tidak ditemukan.");
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("organization_id", user.organizationId)
      .eq("code", offsetCode)
      .eq("is_active", true)
      .maybeSingle();
    if (accountError) throw new Error(`Gagal memvalidasi akun kategori: ${accountError.message}`);
    if (!account) throw new Error(`Akun buku besar ${offsetCode} belum tersedia atau tidak aktif.`);
    offsetAccountId = account.id;
  }

  const sourceUpdate = isExpense
    ? {
        date: new Date(`${input.date}T00:00:00.000Z`).toISOString(),
        description: input.description,
        amount: input.amount,
        total_amount: input.amount,
        category: input.category,
        project_id: input.project_id || null,
        needs_category: false,
      }
    : isProjectRevenue
      ? {
          date: new Date(`${input.date}T00:00:00.000Z`).toISOString(),
          description: input.description,
          amount: input.amount,
          project_id: input.project_id,
        }
      : {
          date: new Date(`${input.date}T00:00:00.000Z`).toISOString(),
          description: input.description,
          amount: input.amount,
          category: input.category,
        };

  if (journal && cashLine && offsetLine && offsetAccountId) {
    const amount = input.amount.toFixed(2);
    const projectId = isExpense || isProjectRevenue ? input.project_id || null : null;
    const cashUpdate = isExpense
      ? { debit: "0.00", credit: amount, description: input.description, project_id: null }
      : { debit: amount, credit: "0.00", description: input.description, project_id: null };
    const offsetUpdate = isExpense
      ? { account_id: offsetAccountId, debit: amount, credit: "0.00", description: input.description, project_id: projectId }
      : { account_id: offsetAccountId, debit: "0.00", credit: amount, description: input.description, project_id: projectId };

    const { error: cashLineError } = await supabase
      .from("journal_lines")
      .update(cashUpdate)
      .eq("id", cashLine.id);
    if (cashLineError) throw new Error(`Gagal memperbarui baris kas jurnal: ${cashLineError.message}`);

    const { error: offsetLineError } = await supabase
      .from("journal_lines")
      .update(offsetUpdate)
      .eq("id", offsetLine.id);
    if (offsetLineError) {
      const { error: rollbackError } = await supabase
        .from("journal_lines")
        .update({
          account_id: cashLine.account_id,
          debit: cashLine.debit,
          credit: cashLine.credit,
          description: cashLine.description,
          project_id: cashLine.project_id,
        })
        .eq("id", cashLine.id);
      throw new Error(
        `Gagal memperbarui kategori jurnal: ${offsetLineError.message}${rollbackError ? `. Pemulihan baris kas juga gagal: ${rollbackError.message}` : ""}`
      );
    }

    const { error: journalError } = await supabase
      .from("journal_entries")
      .update({
        date: new Date(`${input.date}T00:00:00.000Z`).toISOString(),
        description: input.description,
      })
      .eq("id", journal.id)
      .eq("organization_id", user.organizationId)
      .eq("status", "POSTED");
    if (journalError) {
      const restoreLines = await Promise.all([
        supabase.from("journal_lines").update({
          account_id: cashLine.account_id,
          debit: cashLine.debit,
          credit: cashLine.credit,
          description: cashLine.description,
          project_id: cashLine.project_id,
        }).eq("id", cashLine.id),
        supabase.from("journal_lines").update({
          account_id: offsetLine.account_id,
          debit: offsetLine.debit,
          credit: offsetLine.credit,
          description: offsetLine.description,
          project_id: offsetLine.project_id,
        }).eq("id", offsetLine.id),
      ]);
      const restoreError = restoreLines.find((result) => result.error)?.error;
      throw new Error(
        `Gagal memperbarui tanggal jurnal: ${journalError.message}${restoreError ? `. Pemulihan baris jurnal juga gagal: ${restoreError.message}` : ""}`
      );
    }
  }

  const { error: updateError } = await supabase
    .from(table)
    .update(sourceUpdate)
    .eq("id", input.id)
    .eq("organization_id", user.organizationId);
  if (updateError) {
    if (journal && cashLine && offsetLine) {
      const restoreResults = await Promise.all([
        supabase.from("journal_lines").update({
          account_id: cashLine.account_id,
          debit: cashLine.debit,
          credit: cashLine.credit,
          description: cashLine.description,
          project_id: cashLine.project_id,
        }).eq("id", cashLine.id),
        supabase.from("journal_lines").update({
          account_id: offsetLine.account_id,
          debit: offsetLine.debit,
          credit: offsetLine.credit,
          description: offsetLine.description,
          project_id: offsetLine.project_id,
        }).eq("id", offsetLine.id),
        supabase.from("journal_entries").update({
          date: journal.date,
          description: journal.description,
        }).eq("id", journal.id).eq("organization_id", user.organizationId),
      ]);
      const rollbackError = restoreResults.find((result) => result.error)?.error;
      if (rollbackError) {
        throw new Error(
          `Gagal menyimpan perubahan transaksi: ${updateError.message}. Pemulihan jurnal juga gagal: ${rollbackError.message}`
        );
      }
    }
    throw new Error(`Gagal menyimpan perubahan transaksi: ${updateError.message}`);
  }

  await logAudit(user, {
    action: "UPDATE_CASH_BOOK_TRANSACTION",
    entityType: input.source_type,
    entityId: input.id,
    metadata: {
      previous_date: original.date,
      previous_description: original.description,
      previous_amount: original.total_amount ?? original.amount,
      date: input.date,
      description: input.description,
      amount: input.amount,
      category: input.category,
      project_id: input.project_id || null,
    },
  });

  revalidateCashBookReports([original.project_id, input.project_id]);
  return { success: true };
}

export async function deleteCashBookTransaction(
  sourceType: "CASH_BOOK_EXPENSE" | "PROJECT_REVENUE" | "CASH_RECEIPT",
  id: string
) {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const { table, data: original } = await getManualTransactionSource(
    supabase,
    user.organizationId,
    sourceType,
    id
  );
  const journal = await getLatestPostedCashBookJournal(
    supabase,
    user.organizationId,
    sourceType,
    id
  );

  if (journal) {
    await reverseJournal(journal.id, "Pengguna menghapus transaksi dari Buku Kas Perusahaan.");
  }

  const { data: deleted, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    let restoreError: string | null = null;
    if (journal) {
      try {
        const accountId = original.cash_account_id;
        const { data: account, error: accountError } = await supabase
          .from("cash_accounts")
          .select("id, name, type, bank_name")
          .eq("id", accountId)
          .eq("organization_id", user.organizationId)
          .maybeSingle();
        if (accountError) throw new Error(accountError.message);
        if (!account) throw new Error("Rekening transaksi tidak ditemukan untuk pemulihan jurnal.");

        await postCashBookEntryToJournal({
          sourceType,
          sourceId: id,
          date: original.date,
          description: original.description,
          amount: Number(original.total_amount ?? original.amount),
          category: original.category,
          transactionType: sourceType === "CASH_BOOK_EXPENSE" ? "EXPENSE" : "INCOME",
          cashAccountId: account.id,
          cashAccountType: account.type,
          cashAccountName: account.name,
          bankName: account.bank_name,
          projectId: original.project_id,
        });
      } catch (recoveryError) {
        restoreError = recoveryError instanceof Error ? recoveryError.message : "kesalahan tidak diketahui";
      }
    }
    throw new Error(
      `Gagal menghapus transaksi: ${error?.message || "data transaksi tidak ditemukan."}${restoreError ? ` Pemulihan jurnal juga gagal: ${restoreError}` : ""}`
    );
  }

  await logAudit(user, {
    action: "DELETE_CASH_BOOK_TRANSACTION",
    entityType: sourceType,
    entityId: id,
    metadata: {
      date: original.date,
      description: original.description,
      amount: original.total_amount ?? original.amount,
      category: original.category,
      project_id: original.project_id || null,
      journal_reversed: Boolean(journal),
    },
  });

  revalidateCashBookReports([original.project_id]);
  return { success: true };
}
