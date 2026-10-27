"use server";

import {
  getBalanceSheetData,
  getIncomeStatementData,
  getCashFlowData,
  getTrialBalanceData,
} from "@/lib/reports/reportService";
import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";

export async function fetchBalanceSheet(asOfDate: string) {
  return await getBalanceSheetData(asOfDate);
}

export async function fetchIncomeStatement(startDate: string, endDate: string) {
  return await getIncomeStatementData(startDate, endDate);
}

export async function fetchCashFlow(startDate: string, endDate: string) {
  return await getCashFlowData(startDate, endDate);
}

export async function fetchTrialBalance(startDate: string, endDate: string) {
  return await getTrialBalanceData(startDate, endDate);
}

export async function fetchGeneralLedger(params: {
  accountId?: string;
  startDate: string;
  endDate: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 1. Ambil daftar akun dan jurnal secara terpisah karena tabel transaksi
  // mungkin tidak memiliki foreign key yang terdaftar di schema cache Supabase.
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("code");

  if (accountsError) {
    throw new Error(`Gagal memuat akun buku besar: ${accountsError.message}`);
  }

  const { data: journals, error: journalsError } = await supabase
    .from("journal_entries")
    .select("id, number, date, description")
    .eq("organization_id", user.organizationId)
    .eq("status", "POSTED")
    .gte("date", params.startDate)
    .lte("date", `${params.endDate}T23:59:59.999Z`)
    .order("date", { ascending: true });

  if (journalsError) {
    throw new Error(`Gagal memuat jurnal buku besar: ${journalsError.message}`);
  }

  const journalIds = (journals || []).map((journal) => journal.id);
  const accountIds = (accounts || []).map((account) => account.id);
  const accountFilter =
    params.accountId && params.accountId !== "ALL"
      ? [params.accountId]
      : accountIds;
  const { data: lines, error: linesError } = journalIds.length && accountFilter.length
    ? await supabase
        .from("journal_lines")
        .select("id, journal_id, account_id, debit, credit, description")
        .in("journal_id", journalIds)
        .in("account_id", accountFilter)
    : { data: [], error: null };

  if (linesError) {
    throw new Error(`Gagal memuat baris buku besar: ${linesError.message}`);
  }

  const journalsById = new Map((journals || []).map((journal) => [journal.id, journal]));
  const accountsById = new Map((accounts || []).map((account) => [account.id, account]));

  return {
    accounts: accounts || [],
    lines: (lines || [])
      .map((line) => {
        const journal = journalsById.get(line.journal_id);
        const account = accountsById.get(line.account_id);
        if (!journal || !account) return null;

        return {
          id: line.id,
          date: journal.date ? journal.date.split("T")[0] : "-",
          entryNumber: journal.number || "-",
          accountCode: account.code || "-",
          accountName: account.name || "-",
          description: line.description || journal.description || "-",
          debit: parseFloat(line.debit || "0") || 0,
          credit: parseFloat(line.credit || "0") || 0,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
