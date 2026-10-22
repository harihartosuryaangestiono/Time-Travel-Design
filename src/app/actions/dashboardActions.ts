"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";

export interface DashboardMetrics {
  total_cash: number;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  outstanding_cash_advances: number;
  pending_approvals: number;
  overdue_invoices: number;
  accounts_count: number;
  cash_runway_months: number;
  quick_ratio: number | null;
}

export async function getDashboardMetrics(period?: {
  start_date: string;
  end_date: string;
}): Promise<DashboardMetrics> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const orgId = user.organizationId;

  // Rentang waktu bulan berjalan secara default
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDate = period?.start_date || startOfMonth.toISOString().split("T")[0];
  const endDate = period?.end_date || endOfMonth.toISOString().split("T")[0];

  // 1. Total saldo kas riil dari seluruh rekening aktif
  const { data: cashAccounts } = await supabase
    .from("cash_accounts")
    .select("current_balance, opening_balance")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const totalCash = (cashAccounts || []).reduce((sum, acc) => {
    const bal =
      acc.current_balance !== null
        ? parseFloat(acc.current_balance)
        : parseFloat(acc.opening_balance || "0");
    return sum + (isNaN(bal) ? 0 : bal);
  }, 0);

  // 2. Total pengeluaran dalam periode
  const { data: expenses } = await supabase
    .from("expenses")
    .select("total_amount")
    .eq("organization_id", orgId)
    .in("status", ["APPROVED", "POSTED"])
    .gte("date", startDate)
    .lte("date", endDate);

  const totalExpenses = (expenses || []).reduce((sum, exp) => {
    const amt = parseFloat(exp.total_amount || "0");
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  // 3. Total penerimaan pendapatan dari invoice
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("organization_id", orgId)
    .in("status", ["ISSUED", "PARTIAL", "PAID"])
    .gte("invoice_date", startDate)
    .lte("invoice_date", endDate);

  const totalIncome = (invoices || []).reduce((sum, inv) => {
    const paid = parseFloat(inv.amount_paid || "0");
    return sum + (isNaN(paid) ? 0 : paid);
  }, 0);

  // 4. Piutang belum tertagih (A/R)
  const { data: outstandingInvoices } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("organization_id", orgId)
    .in("status", ["ISSUED", "PARTIAL", "OVERDUE"]);

  const outstandingReceivables = (outstandingInvoices || []).reduce((sum, inv) => {
    const tot = parseFloat(inv.total || "0");
    const paid = parseFloat(inv.amount_paid || "0");
    return sum + Math.max(0, (isNaN(tot) ? 0 : tot) - (isNaN(paid) ? 0 : paid));
  }, 0);

  // 5. Hutang usaha belum dibayar (Vendor Bills)
  const { data: vendorBills } = await supabase
    .from("vendor_bills")
    .select("total, paid_amount")
    .eq("organization_id", orgId)
    .in("status", ["PENDING", "PARTIAL", "OVERDUE"]);

  const outstandingPayables = (vendorBills || []).reduce((sum, bill) => {
    const tot = parseFloat(bill.total || "0");
    const paid = parseFloat(bill.paid_amount || "0");
    return sum + Math.max(0, (isNaN(tot) ? 0 : tot) - (isNaN(paid) ? 0 : paid));
  }, 0);

  // 6. Kasbon berjalan / belum diselesaikan
  const { data: outstandingAdvances } = await supabase
    .from("cash_advances")
    .select("disbursed_amount, settled_amount, returned_amount")
    .eq("organization_id", orgId)
    .in("status", ["DISBURSED", "PARTIALLY_SETTLED"]);

  const outstandingCashAdvances = (outstandingAdvances || []).reduce((sum, ca) => {
    const disb = parseFloat(ca.disbursed_amount || "0");
    const setl = parseFloat(ca.settled_amount || "0");
    const ret = parseFloat(ca.returned_amount || "0");
    const rem = (isNaN(disb) ? 0 : disb) - (isNaN(setl) ? 0 : setl) - (isNaN(ret) ? 0 : ret);
    return sum + Math.max(0, rem);
  }, 0);

  // 7. Pengeluaran menunggu approval
  const { count: pendingApprovals } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "SUBMITTED");

  // 8. Invoice jatuh tempo (overdue)
  const today = new Date().toISOString().split("T")[0];
  const { count: overdueInvoices } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "ISSUED")
    .lt("due_date", today);

  // Metrik turunan dengan guard pembagian dengan nol
  const netProfit = totalIncome - totalExpenses;
  const profitMargin =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 1000) / 10
      : 0;

  // Runway: Saldo kas dibagi pengeluaran bulanan (jika totalExpenses > 0)
  const cashRunwayMonths =
    totalExpenses > 0
      ? Math.round((totalCash / totalExpenses) * 10) / 10
      : totalCash > 0
      ? 12
      : 0;

  // Quick Ratio: (Kas + Piutang) / (Hutang + Kasbon Berjalan)
  const totalShortTermObligations = outstandingPayables + outstandingCashAdvances;
  const quickRatio =
    totalShortTermObligations > 0
      ? Math.round(((totalCash + outstandingReceivables) / totalShortTermObligations) * 10) / 10
      : null;

  return {
    total_cash: totalCash,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    profit_margin: profitMargin,
    outstanding_receivables: outstandingReceivables,
    outstanding_payables: outstandingPayables,
    outstanding_cash_advances: outstandingCashAdvances,
    pending_approvals: pendingApprovals || 0,
    overdue_invoices: overdueInvoices || 0,
    accounts_count: (cashAccounts || []).length,
    cash_runway_months: cashRunwayMonths,
    quick_ratio: quickRatio,
  };
}

export async function getRecentTransactions(limit: number = 8) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("expenses")
    .select(`
      id,
      number,
      description,
      total_amount,
      date,
      status,
      merchant,
      category
    `)
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false })
    .limit(limit);

  const mappedExpenses = (expenses || []).map((exp: any) => {
    const amt = parseFloat(exp.total_amount || "0");
    return {
      id: exp.id,
      date: exp.date ? exp.date.split("T")[0] : "-",
      description: exp.description || "Pengeluaran Proyek",
      category: exp.category || "Operasional",
      merchant: exp.merchant || "-",
      amount: isNaN(amt) ? 0 : amt,
      type: "expense" as const,
      status: exp.status || "POSTED",
    };
  });

  return mappedExpenses;
}

export async function getProjectBudgetSummary(limit: number = 5) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      code,
      name,
      contract_value,
      status
    `)
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!projects || projects.length === 0) return [];

  const result = await Promise.all(
    projects.map(async (project) => {
      const { data: allocations } = await supabase
        .from("expense_allocations")
        .select("amount")
        .eq("project_id", project.id);

      const spent = (allocations || []).reduce((sum, a) => {
        const val = parseFloat(a.amount || "0");
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      const contract = parseFloat(project.contract_value || "0") || 0;
      const remaining = contract - spent;

      return {
        id: project.id,
        code: project.code,
        name: project.name,
        contract: contract,
        spent: spent,
        committed: 0,
        remaining: remaining,
        status: project.status,
      };
    })
  );

  return result;
}

export async function getExpensesByCategory(
  startDate: string,
  endDate: string
) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, total_amount")
    .eq("organization_id", user.organizationId)
    .in("status", ["APPROVED", "POSTED"])
    .gte("date", startDate)
    .lte("date", endDate);

  if (!expenses || expenses.length === 0) return [];

  const grouped: Record<string, number> = {};
  let totalAll = 0;

  expenses.forEach((exp: any) => {
    const cat = exp.category || "Biaya Operasional";
    const amt = parseFloat(exp.total_amount || "0") || 0;
    grouped[cat] = (grouped[cat] || 0) + amt;
    totalAll += amt;
  });

  const colors = [
    "#18181B",
    "#27272A",
    "#3F3F46",
    "#52525B",
    "#71717A",
    "#A1A1AA",
    "#D4D4D8",
  ];

  return Object.entries(grouped).map(([name, value], idx) => ({
    name,
    value,
    color: colors[idx % colors.length],
    percent:
      totalAll > 0
        ? `${Math.round((value / totalAll) * 1000) / 10}%`
        : "0%",
  }));
}

export async function getIncomeVsExpense(months: number = 6) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    const monthName = date.toLocaleString("id-ID", { month: "short" });

    const startDate = `${yearMonth}-01`;
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    // Penerimaan Invoice
    const { data: income } = await supabase
      .from("invoices")
      .select("amount_paid")
      .eq("organization_id", user.organizationId)
      .in("status", ["ISSUED", "PARTIAL", "PAID"])
      .gte("invoice_date", startDate)
      .lte("invoice_date", endDate);

    // Pengeluaran
    const { data: expenseData } = await supabase
      .from("expenses")
      .select("total_amount")
      .eq("organization_id", user.organizationId)
      .in("status", ["APPROVED", "POSTED"])
      .gte("date", startDate)
      .lte("date", endDate);

    const incSum = (income || []).reduce((sum, inv) => {
      const paid = parseFloat(inv.amount_paid || "0");
      return sum + (isNaN(paid) ? 0 : paid);
    }, 0);

    const expSum = (expenseData || []).reduce((sum, exp) => {
      const tot = parseFloat(exp.total_amount || "0");
      return sum + (isNaN(tot) ? 0 : tot);
    }, 0);

    const profit = incSum - expSum;
    const margin = incSum > 0 ? Math.round((profit / incSum) * 1000) / 10 : 0;

    result.push({
      month: monthName,
      income: incSum,
      expense: expSum,
      profit: profit,
      margin: margin,
    });
  }

  return result;
}
