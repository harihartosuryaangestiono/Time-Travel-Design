/**
 * TimeTravelDesign Finance - Report Services
 */

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";

// ============================================
// GENERAL LEDGER
// ============================================

export interface GeneralLedgerReport {
  account_code: string;
  account_name: string;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  closing_balance: number;
}

// Get trial balance data
export async function getTrialBalanceData(startDate: string, endDate: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Get all accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, normal_balance")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("code");

  if (!accounts) return [];

  // Get opening balances (before start date)
  const { data: openingLines } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit")
    .eq("journal_entries.status", "POSTED")
    .eq("journal_entries.organization_id", user.organizationId)
    .lt("journal_entries.date", startDate);

  // Get period lines
  const { data: periodLines } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(date, organization_id)")
    .eq("journal_entries.status", "POSTED")
    .gte("journal_entries.date", startDate)
    .lte("journal_entries.date", endDate);

  // Calculate balances
  const opening: Record<string, { debit: number; credit: number }> = {};
  const period: Record<string, { debit: number; credit: number }> = {};

  for (const acc of accounts) {
    opening[acc.id] = { debit: 0, credit: 0 };
    period[acc.id] = { debit: 0, credit: 0 };
  }

  const openingLinesData = openingLines || [];
  const periodLinesData = periodLines || [];

  for (const line of openingLinesData) {
    if (opening[line.account_id]) {
      opening[line.account_id].debit += Number(line.debit || 0);
      opening[line.account_id].credit += Number(line.credit || 0);
    }
  }

  for (const line of periodLinesData) {
    if (period[line.account_id]) {
      period[line.account_id].debit += Number(line.debit || 0);
      period[line.account_id].credit += Number(line.credit || 0);
    }
  }

  // Build report rows
  return accounts.map((acc) => {
    const open = opening[acc.id] || { debit: 0, credit: 0 };
    const per = period[acc.id] || { debit: 0, credit: 0 };

    let closingDebit = 0;
    let closingCredit = 0;
    const balance = open.debit - open.credit + per.debit - per.credit;
    if (acc.normal_balance === "CREDIT") {
      const creditBalance = open.credit - open.debit + per.credit - per.debit;
      if (creditBalance >= 0) closingCredit = creditBalance;
      else closingDebit = Math.abs(creditBalance);
    } else {
      if (balance >= 0) closingDebit = balance;
      else closingCredit = Math.abs(balance);
    }

    return {
      account_code: acc.code,
      account_name: acc.name,
      opening_debit: open.debit,
      opening_credit: open.credit,
      period_debit: per.debit,
      period_credit: per.credit,
      closing_debit: closingDebit,
      closing_credit: closingCredit,
    };
  });
}

// Get income statement data
export async function getIncomeStatementData(startDate: string, endDate: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true);

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit")
    .eq("journal_entries.status", "POSTED")
    .eq("journal_entries.organization_id", user.organizationId)
    .gte("journal_entries.date", startDate)
    .lte("journal_entries.date", endDate);

  const balances: Record<string, number> = {};
  const accountMap: Record<string, { code: string; name: string; type: string }> = {};

  for (const acc of accounts || []) {
    balances[acc.id] = 0;
    accountMap[acc.id] = { code: acc.code, name: acc.name, type: acc.type };
  }

  for (const line of lines || []) {
    balances[line.account_id] = (balances[line.account_id] || 0) + Number(line.credit || 0) - Number(line.debit || 0);
  }

  const revenue: { code: string; name: string; amount: number }[] = [];
  const costOfSales: { code: string; name: string; amount: number }[] = [];
  const operatingExpenses: { code: string; name: string; amount: number }[] = [];

  for (const [accountId, amount] of Object.entries(balances)) {
    const acc = accountMap[accountId];
    if (!acc || amount <= 0) continue;
    const row = { code: acc.code, name: acc.name, amount };
    switch (acc.type) {
      case "REVENUE": revenue.push(row); break;
      case "COST_OF_SALES": costOfSales.push(row); break;
      case "EXPENSE": operatingExpenses.push(row); break;
    }
  }

  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalCost = costOfSales.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = operatingExpenses.reduce((s, r) => s + r.amount, 0);
  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit - totalExpenses;

  return {
    revenue, cost_of_sales: costOfSales,
    operating_expenses: operatingExpenses,
    gross_profit: grossProfit,
    net_profit: netProfit,
    total_revenue: totalRevenue,
    total_cost_of_sales: totalCost,
    total_operating_expenses: totalExpenses,
    period_start: startDate,
    period_end: endDate,
  };
}

// Get balance sheet data
export async function getBalanceSheetData(asOfDate: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, normal_balance")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true);

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit")
    .eq("journal_entries.status", "POSTED")
    .eq("journal_entries.organization_id", user.organizationId)
    .lte("journal_entries.date", asOfDate);

  const balances: Record<string, number> = {};
  const accountMap: Record<string, { code: string; name: string; type: string }> = {};

  for (const acc of accounts || []) {
    balances[acc.id] = 0;
    accountMap[acc.id] = { code: acc.code, name: acc.name, type: acc.type };
  }

  for (const line of lines || []) {
    balances[line.account_id] = (balances[line.account_id] || 0) + Number(line.debit || 0) - Number(line.credit || 0);
  }

  const assets: { code: string; name: string; amount: number }[] = [];
  const liabilities: { code: string; name: string; amount: number }[] = [];

  for (const [accountId, balance] of Object.entries(balances)) {
    const acc = accountMap[accountId];
    if (!acc) continue;
    if (balance === 0) continue;
    const row = { code: acc.code, name: acc.name, amount: balance };
    if (acc.type === "ASSET") assets.push(row);
    else if (acc.type === "LIABILITY") liabilities.push(row);
  }

  const incomeData = await getIncomeStatementData(`${new Date().getFullYear()}-01-01`, asOfDate);
  const currentProfit = incomeData.net_profit;

  const totalAssets = assets.reduce((s: number, a: { code: string; name: string; amount: number }) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s: number, l: { code: string; name: string; amount: number }) => s + l.amount, 0);

  return {
    as_of_date: asOfDate,
    assets,
    liabilities,
    equity: [],
    current_profit_loss: currentProfit,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: currentProfit,
    total_liabilities_equity: totalLiabilities + currentProfit,
  };
}

// Get cash flow data
export async function getCashFlowData(startDate: string, endDate: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: cashAccounts } = await supabase
    .from("cash_accounts")
    .select("id, code, name, opening_balance")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true);

  const openingBalance = (cashAccounts || []).reduce((s, a) => s + Number(a.opening_balance || 0), 0);

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(source_type)")
    .eq("journal_entries.status", "POSTED")
    .eq("journal_entries.organization_id", user.organizationId)
    .in("account_id", (cashAccounts || []).map(a => a.id))
    .gte("journal_entries.date", startDate)
    .lte("journal_entries.date", endDate);

  let netChange = 0;
  const activities: { description: string; amount: number }[] = [];

  for (const line of lines || []) {
    const amount = Number(line.debit || 0) - Number(line.credit || 0);
    netChange += amount;
    const sourceType = (line as any).journal_entries?.source_type || 'JOURNAL';
    activities.push({
      description: `${sourceType} - ${line.account_id}`,
      amount,
    });
  }

  return {
    start_date: startDate,
    end_date: endDate,
    opening_balance: openingBalance,
    closing_balance: openingBalance + netChange,
    net_change: netChange,
    operating_activities: activities,
    investing_activities: [],
    financing_activities: [],
  };
}
