"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";

export interface DashboardMetrics {
  total_cash: number;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  outstanding_cash_advances: number;
  pending_approvals: number;
  overdue_invoices: number;
}

export async function getDashboardMetrics(period?: {
  start_date: string;
  end_date: string;
}): Promise<DashboardMetrics> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const orgId = user.organizationId;

  // Get current date range (this month by default)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDate = period?.start_date || startOfMonth.toISOString().split("T")[0];
  const endDate = period?.end_date || endOfMonth.toISOString().split("T")[0];

  // 1. Get cash accounts total
  const { data: cashAccounts } = await supabase
    .from("cash_accounts")
    .select("opening_balance")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const totalCash = cashAccounts?.reduce(
    (sum, acc) => sum + Number(acc.opening_balance),
    0
  ) || 0;

  // 2. Get posted expenses in period
  const { data: expenses } = await supabase
    .from("expenses")
    .select("total_amount")
    .eq("organization_id", orgId)
    .eq("status", "POSTED")
    .gte("date", startDate)
    .lte("date", endDate);

  const totalExpenses =
    expenses?.reduce((sum, exp) => sum + Number(exp.total_amount), 0) || 0;

  // 3. Get posted invoices (income) in period
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("organization_id", orgId)
    .in("status", ["ISSUED", "PARTIAL", "PAID"])
    .gte("invoice_date", startDate)
    .lte("invoice_date", endDate);

  const totalIncome =
    invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid), 0) || 0;

  // 4. Get outstanding receivables
  const { data: outstandingInvoices } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("organization_id", orgId)
    .in("status", ["ISSUED", "PARTIAL", "OVERDUE"]);

  const outstandingReceivables =
    outstandingInvoices?.reduce(
      (sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid)),
      0
    ) || 0;

  // 5. Get outstanding payables (vendor bills) - simplified for now
  const { data: vendorBills } = await supabase
    .from("vendor_bills")
    .select("total, paid_amount")
    .eq("organization_id", orgId)
    .in("status", ["PENDING", "PARTIAL", "OVERDUE"]);

  const outstandingPayables =
    vendorBills?.reduce(
      (sum, bill) => sum + (Number(bill.total) - Number(bill.paid_amount || 0)),
      0
    ) || 0;

  // 6. Get outstanding cash advances
  const { data: outstandingAdvances } = await supabase
    .from("cash_advances")
    .select("disbursed_amount, settled_amount, returned_amount")
    .eq("organization_id", orgId)
    .in("status", ["DISBURSED", "PARTIALLY_SETTLED"]);

  const outstandingCashAdvances =
    outstandingAdvances?.reduce(
      (sum, ca) =>
        sum +
        (Number(ca.disbursed_amount) -
          Number(ca.settled_amount) -
          Number(ca.returned_amount)),
      0
    ) || 0;

  // 7. Get pending approvals count
  const { count: pendingApprovals } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "SUBMITTED");

  // 8. Get overdue invoices
  const today = new Date().toISOString().split("T")[0];
  const { count: overdueInvoices } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "ISSUED")
    .lt("due_date", today);

  return {
    total_cash: totalCash,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_profit: totalIncome - totalExpenses,
    outstanding_receivables: outstandingReceivables,
    outstanding_payables: outstandingPayables,
    outstanding_cash_advances: outstandingCashAdvances,
    pending_approvals: pendingApprovals || 0,
    overdue_invoices: overdueInvoices || 0,
  };
}

export async function getRecentTransactions(limit: number = 10) {
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
      profile:profiles!submitted_by(full_name)
    `)
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const mappedExpenses = (expenses || []).map((exp: any) => ({
    id: exp.id,
    type: "expense",
    description: exp.description,
    amount: Number(exp.total_amount),
    date: exp.date,
    status: exp.status,
    submitted_by: (exp.profile as any)?.full_name,
  }));

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
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!projects) return [];

  const result = await Promise.all(
    projects.map(async (project) => {
      // Get approved budget
      const { data: budget } = await supabase
        .from("budget_versions")
        .select("total")
        .eq("project_id", project.id)
        .eq("status", "APPROVED")
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      // Get actual expenses
      const { data: expenses } = await supabase
        .from("expense_allocations")
        .select("amount")
        .eq("project_id", project.id);

      // Get commitments
      const { data: commitments } = await supabase
        .from("commitment_items")
        .select("amount, fulfilled_amount")
        .eq("project_id", project.id)
        .eq("status", "OPEN");

      const spent = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const committed =
        commitments?.reduce(
          (sum, c) => sum + (Number(c.amount) - Number(c.fulfilled_amount)),
          0
        ) || 0;
      const budgetAmount = Number(budget?.total || project.contract_value || 0);
      const remaining = budgetAmount - spent - committed;

      return {
        id: project.id,
        code: project.code,
        name: project.name,
        budget: budgetAmount,
        spent,
        committed,
        remaining,
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
    .eq("status", "POSTED")
    .gte("date", startDate)
    .lte("date", endDate);

  if (!expenses) return [];

  // Group by category
  const grouped = expenses.reduce(
    (acc, exp) => {
      const cat = exp.category || "Lainnya";
      if (!acc[cat]) {
        acc[cat] = 0;
      }
      acc[cat] += Number(exp.total_amount);
      return acc;
    },
    {} as Record<string, number>
  );

  // Convert to array format for charts
  return Object.entries(grouped).map(([name, value]) => ({
    name,
    value,
  }));
}

export async function getIncomeVsExpense(
  months: number = 6
) {
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

    // Get income (posted invoices)
    const { data: income } = await supabase
      .from("invoices")
      .select("amount_paid")
      .eq("organization_id", user.organizationId)
      .eq("status", "PAID")
      .gte("invoice_date", startDate)
      .lte("invoice_date", endDate);

    // Get expenses (posted expenses)
    const { data: expenseData } = await supabase
      .from("expenses")
      .select("total_amount")
      .eq("organization_id", user.organizationId)
      .eq("status", "POSTED")
      .gte("date", startDate)
      .lte("date", endDate);

    result.push({
      name: monthName,
      income: income?.reduce((sum, inv) => sum + Number(inv.amount_paid), 0) || 0,
      expense:
        expenseData?.reduce((sum, exp) => sum + Number(exp.total_amount), 0) || 0,
    });
  }

  return result;
}
