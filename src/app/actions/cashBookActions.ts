"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";
import {
  CreateFastTransactionSchema,
  type CashBookEntry,
  type CreateFastTransactionInput,
} from "@/lib/validation/cashBook";
import { validateExpenseBookCategory } from "@/lib/accounting/expenseCategories";
import { getSubcontractorPaymentOptions } from "@/app/actions/subcontractorActions";

/**
 * Mengambil transaksi Buku Kas Perusahaan dengan perhitungan saldo berjalan kumulatif
 */
export async function getCashBookTransactions(filter?: {
  month?: number;
  year?: number;
  category?: string;
  cashAccountId?: string;
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
    .select("id, date, number, description, total_amount, category, needs_category, project_id, status")
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
        .select("id, date, amount, description, project_id")
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
    type: "INCOME",
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
    .select("id")
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
        `Pembayaran melebihi sisa borongan ${subcontractorContract.vendorName}: ${subcontractorContract.remainingAmount.toLocaleString("id-ID")}.`
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
        merchant: subcontractorContract?.vendorName || input.description.slice(0, 50),
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
  revalidatePath("/subcontractor-recap");
  if (input.project_id) {
    revalidatePath(`/projects/${input.project_id}`);
  }

  return data;
}
