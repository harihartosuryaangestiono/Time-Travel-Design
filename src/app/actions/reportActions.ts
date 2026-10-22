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

  // 1. Ambil daftar akun
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("code");

  // 2. Ambil transaksi journal lines
  let query = supabase
    .from("journal_lines")
    .select(`
      id,
      account_id,
      debit,
      credit,
      description,
      journal_entries!inner (
        id,
        number,
        date,
        description,
        status,
        organization_id
      ),
      account:accounts (
        id,
        code,
        name
      )
    `)
    .eq("journal_entries.organization_id", user.organizationId)
    .gte("journal_entries.date", params.startDate)
    .lte("journal_entries.date", params.endDate)
    .order("journal_entries(date)", { ascending: true });

  if (params.accountId && params.accountId !== "ALL") {
    query = query.eq("account_id", params.accountId);
  }

  const { data: lines, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return {
    accounts: accounts || [],
    lines: (lines || []).map((l: any) => ({
      id: l.id,
      date: l.journal_entries?.date ? l.journal_entries.date.split("T")[0] : "-",
      entryNumber: l.journal_entries?.number || "-",
      accountCode: l.account?.code || "-",
      accountName: l.account?.name || "-",
      description: l.description || l.journal_entries?.description || "-",
      debit: parseFloat(l.debit || "0") || 0,
      credit: parseFloat(l.credit || "0") || 0,
    })),
  };
}
