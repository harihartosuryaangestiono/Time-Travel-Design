"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { getAccountsWithCalculatedBalance } from "@/lib/accounting/cashBalance";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface DashboardMetrics {
  total_cash: number;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  outstanding_cash_advances: number;
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
  const cashAccounts = await getAccountsWithCalculatedBalance(orgId);
  const totalCash = cashAccounts.reduce((sum, account) => sum + account.currentBalance, 0);

  // 2. Total pengeluaran dalam periode
  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("total_amount")
    .eq("organization_id", orgId)
    .in("status", ["APPROVED", "POSTED"])
    .gte("date", startDate)
    .lte("date", `${endDate}T23:59:59.999Z`);
  if (expensesError) throw new Error(`Gagal memuat pengeluaran dashboard: ${expensesError.message}`);

  const totalExpenses = (expenses || []).reduce((sum, exp) => {
    const amt = parseFloat(exp.total_amount || "0");
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  // 3. Total penerimaan kas berdasarkan tanggal pembayaran/penerimaan.
  const [{ data: projectRevenues, error: projectRevenuesError },
    { data: cashReceipts, error: cashReceiptsError },
    { data: organizationInvoices, error: organizationInvoicesError }] = await Promise.all([
      supabase
        .from("project_revenues")
        .select("amount")
        .eq("organization_id", orgId)
        .gte("date", startDate)
        .lte("date", `${endDate}T23:59:59.999Z`),
      supabase
        .from("cash_receipts")
        .select("amount")
        .eq("organization_id", orgId)
        .gte("date", startDate)
        .lte("date", `${endDate}T23:59:59.999Z`),
      supabase
        .from("invoices")
        .select("id")
        .eq("organization_id", orgId),
    ]);
  if (projectRevenuesError) throw new Error(`Gagal memuat pendapatan proyek dashboard: ${projectRevenuesError.message}`);
  if (cashReceiptsError) throw new Error(`Gagal memuat penerimaan kas dashboard: ${cashReceiptsError.message}`);
  if (organizationInvoicesError) throw new Error(`Gagal memuat invoice dashboard: ${organizationInvoicesError.message}`);

  const invoiceIds = (organizationInvoices || []).map((invoice) => invoice.id);
  const { data: invoicePayments, error: invoicePaymentsError } = invoiceIds.length
    ? await supabase
        .from("invoice_payments")
        .select("amount")
        .in("invoice_id", invoiceIds)
        .gte("payment_date", startDate)
        .lte("payment_date", `${endDate}T23:59:59.999Z`)
    : { data: [], error: null };
  if (invoicePaymentsError) throw new Error(`Gagal memuat pembayaran invoice dashboard: ${invoicePaymentsError.message}`);

  const totalIncome = [
    ...(projectRevenues || []),
    ...(cashReceipts || []),
    ...(invoicePayments || []),
  ].reduce((sum, row) => {
    const amount = parseFloat(row.amount || "0");
    return sum + (Number.isFinite(amount) ? amount : 0);
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

  // 7. Invoice jatuh tempo (overdue)
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
    overdue_invoices: overdueInvoices || 0,
    accounts_count: cashAccounts.length,
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

  const projectIds = projects.map((project) => project.id);
  const { data: allocations, error: allocationsError } = await supabase
    .from("expense_allocations")
    .select("expense_id, project_id, amount")
    .in("project_id", projectIds);
  if (allocationsError) throw new Error(`Gagal memuat alokasi proyek dashboard: ${allocationsError.message}`);

  const allocatedExpenseIds = Array.from(new Set((allocations || []).map((allocation) => allocation.expense_id)));
  const [{ data: allocatedExpenses, error: allocatedExpensesError },
    { data: directExpenses, error: directExpensesError }] = await Promise.all([
      allocatedExpenseIds.length
        ? supabase
            .from("expenses")
            .select("id")
            .eq("organization_id", user.organizationId)
            .in("id", allocatedExpenseIds)
            .in("status", ["APPROVED", "POSTED"])
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("expenses")
        .select("id, project_id, total_amount")
        .eq("organization_id", user.organizationId)
        .in("project_id", projectIds)
        .in("status", ["APPROVED", "POSTED"]),
    ]);
  if (allocatedExpensesError) throw new Error(`Gagal memuat pengeluaran alokasi dashboard: ${allocatedExpensesError.message}`);
  if (directExpensesError) throw new Error(`Gagal memuat pengeluaran proyek dashboard: ${directExpensesError.message}`);

  const postedExpenseIds = new Set((allocatedExpenses || []).map((expense) => expense.id));
  const expenseIdsWithAllocations = new Set(allocatedExpenseIds);
  const spendByProject = new Map<string, number>();
  (allocations || []).forEach((allocation) => {
    if (!postedExpenseIds.has(allocation.expense_id)) return;
    const amount = Number(allocation.amount || 0);
    spendByProject.set(
      allocation.project_id,
      (spendByProject.get(allocation.project_id) || 0) + (Number.isFinite(amount) ? amount : 0)
    );
  });
  (directExpenses || []).forEach((expense) => {
    if (expenseIdsWithAllocations.has(expense.id) || !expense.project_id) return;
    const amount = Number(expense.total_amount || 0);
    if (Number.isFinite(amount)) {
      spendByProject.set(
        expense.project_id,
        (spendByProject.get(expense.project_id) || 0) + amount
      );
    }
  });

  return projects.map((project) => {
    const spent = spendByProject.get(project.id) || 0;
    const contract = parseFloat(project.contract_value || "0") || 0;
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      contract,
      spent,
      committed: 0,
      remaining: contract - spent,
      status: project.status,
    };
  });
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
    .lte("date", `${endDate}T23:59:59.999Z`);

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
  const { data: invoices, error: invoicesError } = await supabase
    .from("invoices")
    .select("id")
    .eq("organization_id", user.organizationId);
  if (invoicesError) throw new Error(`Gagal memuat invoice untuk grafik dashboard: ${invoicesError.message}`);
  const invoiceIds = (invoices || []).map((invoice) => invoice.id);

  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    const monthName = date.toLocaleString("id-ID", { month: "short" });

    const startDate = `${yearMonth}-01`;
    const endDate = formatLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));

    const endOfDay = `${endDate}T23:59:59.999Z`;
    const [{ data: revenues, error: revenuesError },
      { data: receipts, error: receiptsError },
      { data: payments, error: paymentsError },
      { data: expenseData, error: expensesError }] = await Promise.all([
        supabase
          .from("project_revenues")
          .select("amount")
          .eq("organization_id", user.organizationId)
          .gte("date", startDate)
          .lte("date", endOfDay),
        supabase
          .from("cash_receipts")
          .select("amount")
          .eq("organization_id", user.organizationId)
          .gte("date", startDate)
          .lte("date", endOfDay),
        invoiceIds.length
          ? supabase
              .from("invoice_payments")
              .select("amount")
              .in("invoice_id", invoiceIds)
              .gte("payment_date", startDate)
              .lte("payment_date", endOfDay)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("expenses")
          .select("total_amount")
          .eq("organization_id", user.organizationId)
          .in("status", ["APPROVED", "POSTED"])
          .gte("date", startDate)
          .lte("date", endOfDay),
      ]);
    if (revenuesError) throw new Error(`Gagal memuat pendapatan proyek untuk grafik: ${revenuesError.message}`);
    if (receiptsError) throw new Error(`Gagal memuat penerimaan untuk grafik: ${receiptsError.message}`);
    if (paymentsError) throw new Error(`Gagal memuat pembayaran invoice untuk grafik: ${paymentsError.message}`);
    if (expensesError) throw new Error(`Gagal memuat pengeluaran untuk grafik: ${expensesError.message}`);

    const sumAmounts = (rows: Array<{ amount?: string | number | null }> | null) =>
      (rows || []).reduce((sum, row) => {
        const amount = Number(row.amount || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    const incSum = sumAmounts(revenues) + sumAmounts(receipts) + sumAmounts(payments);

    const expSum = (expenseData || []).reduce((sum, exp) => {
      const amount = Number(exp.total_amount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
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
