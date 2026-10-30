"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { getAccountsWithCalculatedBalance } from "@/lib/accounting/cashBalance";
import {
  GENERAL_EXPENSE_CATEGORIES,
  PROJECT_EXPENSE_CATEGORIES,
  normalizeExpenseCategory,
} from "@/lib/accounting/expenseCategories";

export interface ProjectRevenueSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  totalReceived: number;
}

export interface CategorySummary {
  name: string;
  amount: number;
}

export interface RekapitulasiReportData {
  fiscalYear: number;
  revenues: ProjectRevenueSummary[];
  totalRevenue: number;
  hppCategories: CategorySummary[];
  totalHpp: number;
  grossProfit: number;
  grossMargin: number;
  opexCategories: CategorySummary[];
  totalOpex: number;
  netIncome: number;
  netMargin: number;
  capexCategories: CategorySummary[];
  totalCapex: number;
  openingCash: number;
  currentCash: number;
  ownerAdvances: Array<{ name: string; amount: number; remainingLimit: number }>;
  totalOwnerAdvances: number;
  cashAfterAdvances: number;
  uncategorizedExpenses: Array<{
    id: string;
    date: string;
    desc: string;
    amount: number;
    projectName?: string;
  }>;
  totalUncategorized: number;
}

export interface ProjectRekapitulasiSummary {
  projectId: string;
  projectName: string;
  projectCode: string;
  status: string;
  clientName: string;
  buildingFunction: string | null;
  workCategory: string | null;
  deadline: string | null;
  contractValue: number;
  totalRevenue: number;
  totalHpp: number;
  totalOpex: number;
  totalCapex: number;
  totalUncategorized: number;
  netIncome: number;
}

export interface ProjectRekapitulasiData {
  fiscalYear: number;
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
    clientName: string;
    buildingFunction: string | null;
    workCategory: string | null;
    deadline: string | null;
    contractValue: number;
  };
  revenues: Array<{ date: string; description: string; amount: number }>;
  totalRevenue: number;
  hppCategories: CategorySummary[];
  totalHpp: number;
  grossProfit: number;
  opexCategories: CategorySummary[];
  totalOpex: number;
  capexCategories: CategorySummary[];
  totalCapex: number;
  netIncome: number;
  uncategorizedExpenses: Array<{ id: string; date: string; description: string; amount: number }>;
  totalUncategorized: number;
}

const PROJECT_CAPEX_CATEGORIES = ["Office Renovation", "Company Legal", "Inventory"];
const PROJECT_OPEX_CATEGORIES = GENERAL_EXPENSE_CATEGORIES.filter(
  (category) => !PROJECT_CAPEX_CATEGORIES.includes(category)
);

async function getProjectRekapitulasiRows(
  year: number,
  projectId?: string
): Promise<ProjectRekapitulasiData[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  let projectQuery = supabase
    .from("projects")
    .select("id, name, code, client_id, contract_value, status, building_function, work_category, type, end_date")
    .eq("organization_id", user.organizationId)
    .order("name");
  if (projectId) projectQuery = projectQuery.eq("id", projectId);

  const { data: projects, error: projectsError } = await projectQuery;
  if (projectsError) throw new Error(`Gagal memuat proyek untuk rekapitulasi: ${projectsError.message}`);
  if (projectId && !projects?.length) throw new Error("Proyek tidak ditemukan.");
  if (!projects?.length) return [];

  const projectIds = projects.map((project) => project.id);
  const clientIds = Array.from(new Set(projects.map((project) => project.client_id).filter(Boolean))) as string[];
  const [{ data: clients, error: clientsError }, { data: revenues, error: revenuesError },
    { data: directExpenses, error: expensesError }, { data: allocations, error: allocationsError }] =
    await Promise.all([
      clientIds.length
        ? supabase.from("clients").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("project_revenues")
        .select("id, project_id, date, amount, description")
        .eq("organization_id", user.organizationId)
        .in("project_id", projectIds)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("expenses")
        .select("id, project_id, date, description, total_amount, category, needs_category, status")
        .eq("organization_id", user.organizationId)
        .in("project_id", projectIds)
        .in("status", ["APPROVED", "POSTED"])
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("expense_allocations")
        .select("id, project_id, expense_id, amount, description")
        .in("project_id", projectIds),
    ]);

  if (clientsError) throw new Error(`Gagal memuat klien proyek: ${clientsError.message}`);
  if (revenuesError) throw new Error(`Gagal memuat pendapatan proyek: ${revenuesError.message}`);
  if (expensesError) throw new Error(`Gagal memuat pengeluaran proyek: ${expensesError.message}`);
  if (allocationsError) throw new Error(`Gagal memuat alokasi pengeluaran: ${allocationsError.message}`);

  const allocationExpenseIds = Array.from(new Set((allocations || []).map((allocation) => allocation.expense_id)));
  const { data: allocatedExpenseDetails, error: allocatedDetailsError } = allocationExpenseIds.length
    ? await supabase
        .from("expenses")
        .select("id, date, category, needs_category, status, description")
        .eq("organization_id", user.organizationId)
        .in("id", allocationExpenseIds)
        .in("status", ["APPROVED", "POSTED"])
        .gte("date", startDate)
        .lte("date", endDate)
    : { data: [], error: null };
  if (allocatedDetailsError) {
    throw new Error(`Gagal memuat rincian pengeluaran alokasi: ${allocatedDetailsError.message}`);
  }

  const clientsById = new Map((clients || []).map((client) => [client.id, client.name]));
  const allocationExpenseById = new Map((allocatedExpenseDetails || []).map((expense) => [expense.id, expense]));
  const allocatedIds = new Set((allocations || []).map((allocation) => allocation.expense_id));

  return projects.map((project) => {
    const projectRevenues = (revenues || [])
      .filter((revenue) => revenue.project_id === project.id)
      .map((revenue) => ({
        date: revenue.date ? new Date(revenue.date).toISOString().slice(0, 10) : "",
        description: revenue.description,
        amount: Number(revenue.amount || 0),
      }));
    const projectExpenses: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      category: string | null;
    }> = [];

    (directExpenses || []).forEach((expense) => {
      if (expense.project_id !== project.id || allocatedIds.has(expense.id)) return;
      projectExpenses.push({
        id: expense.id,
        date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : "",
        description: expense.description,
        amount: Number(expense.total_amount || 0),
        category: expense.category,
      });
    });

    (allocations || []).forEach((allocation) => {
      if (allocation.project_id !== project.id) return;
      const expense = allocationExpenseById.get(allocation.expense_id);
      if (!expense) return;
      projectExpenses.push({
        id: allocation.id,
        date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : "",
        description: allocation.description || expense.description,
        amount: Number(allocation.amount || 0),
        category: expense.category,
      });
    });

    const hppTotals = new Map<string, number>();
    const opexTotals = new Map<string, number>();
    const capexTotals = new Map<string, number>();
    const uncategorizedExpenses: ProjectRekapitulasiData["uncategorizedExpenses"] = [];
    projectExpenses.forEach((expense) => {
      const category =
        normalizeExpenseCategory(expense.category, "PROJECT") ||
        normalizeExpenseCategory(expense.category, "GENERAL");
      if (category) {
        const totals = (PROJECT_EXPENSE_CATEGORIES as readonly string[]).includes(category)
          ? hppTotals
          : PROJECT_CAPEX_CATEGORIES.includes(category)
            ? capexTotals
            : opexTotals;
        totals.set(category, (totals.get(category) || 0) + expense.amount);
      } else {
        uncategorizedExpenses.push({
          id: expense.id,
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
        });
      }
    });

    const hppCategories = PROJECT_EXPENSE_CATEGORIES.map((name) => ({
      name,
      amount: hppTotals.get(name) || 0,
    }));
    const opexCategories = PROJECT_OPEX_CATEGORIES.map((name) => ({
      name,
      amount: opexTotals.get(name) || 0,
    }));
    const capexCategories = PROJECT_CAPEX_CATEGORIES.map((name) => ({
      name,
      amount: capexTotals.get(name) || 0,
    }));
    const totalRevenue = projectRevenues.reduce((total, revenue) => total + revenue.amount, 0);
    const totalHpp = hppCategories.reduce((total, category) => total + category.amount, 0);
    const totalOpex = opexCategories.reduce((total, category) => total + category.amount, 0);
    const totalCapex = capexCategories.reduce((total, category) => total + category.amount, 0);
    const totalUncategorized = uncategorizedExpenses.reduce((total, expense) => total + expense.amount, 0);
    const grossProfit = totalRevenue - totalHpp;

    return {
      fiscalYear: year,
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        clientName: (project.client_id && clientsById.get(project.client_id)) || "-",
        buildingFunction: project.building_function,
        workCategory: project.work_category || (
          project.type === "INTERIOR_DESIGN"
            ? "Interior & Furniture"
            : project.type === "RENOVATION"
              ? "Renovation"
              : project.type === "CONSTRUCTION"
                ? "Build From Scratch"
                : null
        ),
        deadline: project.end_date ? new Date(project.end_date).toISOString().slice(0, 10) : null,
        contractValue: Number(project.contract_value || 0),
      },
      revenues: projectRevenues,
      totalRevenue,
      hppCategories,
      totalHpp,
      grossProfit,
      opexCategories,
      totalOpex,
      capexCategories,
      totalCapex,
      netIncome: grossProfit - totalOpex,
      uncategorizedExpenses,
      totalUncategorized,
    };
  });
}

export async function getProjectRekapitulasiProjects(year: number = 2026): Promise<ProjectRekapitulasiSummary[]> {
  const reports = await getProjectRekapitulasiRows(year);
  return reports.map((report) => ({
    projectId: report.project.id,
    projectName: report.project.name,
    projectCode: report.project.code,
    status: report.project.status,
    clientName: report.project.clientName,
    buildingFunction: report.project.buildingFunction,
    workCategory: report.project.workCategory,
    deadline: report.project.deadline,
    contractValue: report.project.contractValue,
    totalRevenue: report.totalRevenue,
    totalHpp: report.totalHpp,
    totalOpex: report.totalOpex,
    totalCapex: report.totalCapex,
    totalUncategorized: report.totalUncategorized,
    netIncome: report.netIncome,
  }));
}

export async function getProjectRekapitulasiData(
  projectId: string,
  year: number = 2026
): Promise<ProjectRekapitulasiData> {
  const [report] = await getProjectRekapitulasiRows(year, projectId);
  if (!report) throw new Error("Proyek tidak ditemukan.");
  return report;
}

export async function getRekapitulasiData(year: number = 2026): Promise<RekapitulasiReportData> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  // 1. Ambil Semua Proyek & Pendapatan (project_revenues)
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, code, client_id")
    .eq("organization_id", user.organizationId)
    .order("name");
  if (projectsError) {
    throw new Error(`Gagal memuat proyek untuk rekapitulasi: ${projectsError.message}`);
  }

  const clientIds = Array.from(
    new Set((projects || []).map((project) => project.client_id).filter(Boolean))
  ) as string[];
  const { data: clients, error: clientsError } = clientIds.length
    ? await supabase.from("clients").select("id, name").in("id", clientIds)
    : { data: [], error: null };
  if (clientsError) {
    throw new Error(`Gagal memuat klien untuk rekapitulasi: ${clientsError.message}`);
  }
  const clientsById = new Map((clients || []).map((client) => [client.id, client.name]));
  const projectsById = new Map((projects || []).map((project) => [project.id, project]));

  const { data: revenues, error: revenuesError } = await supabase
    .from("project_revenues")
    .select("project_id, amount, date")
    .eq("organization_id", user.organizationId)
    .gte("date", startDate)
    .lte("date", endDate);
  if (revenuesError) {
    throw new Error(`Gagal memuat pendapatan proyek: ${revenuesError.message}`);
  }

  const revenueMap = new Map<string, number>();
  (revenues || []).forEach((r: any) => {
    const prev = revenueMap.get(r.project_id) || 0;
    revenueMap.set(r.project_id, prev + (parseFloat(r.amount) || 0));
  });

  const revenuesList: ProjectRevenueSummary[] = (projects || []).map((p: any) => ({
    projectId: p.id,
    projectName: p.name,
    clientName: (p.client_id && clientsById.get(p.client_id)) || p.code || "-",
    totalReceived: revenueMap.get(p.id) || 0,
  }));

  const totalRevenue = revenuesList.reduce((sum, r) => sum + r.totalReceived, 0);

  // 2. Ambil Semua Pengeluaran (expenses)
  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("id, date, description, total_amount, category, needs_category, project_id")
    .eq("organization_id", user.organizationId)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", ["APPROVED", "POSTED"]);
  if (expensesError) {
    throw new Error(`Gagal memuat pengeluaran untuk rekapitulasi: ${expensesError.message}`);
  }

  const hppNames = [...PROJECT_EXPENSE_CATEGORIES];
  const capexNames = PROJECT_CAPEX_CATEGORIES;
  const opexNames = PROJECT_OPEX_CATEGORIES;

  const categoryTotals = new Map<string, number>();
  const uncategorizedList: Array<{
    id: string;
    date: string;
    desc: string;
    amount: number;
    projectName?: string;
  }> = [];

  let totalUncategorized = 0;

  (expenses || []).forEach((e: any) => {
    const amt = parseFloat(e.total_amount) || 0;
    const cat = e.category?.trim();
    const normalizedCategory =
      normalizeExpenseCategory(cat, "PROJECT") ||
      normalizeExpenseCategory(cat, "GENERAL");

    if (!normalizedCategory && (e.needs_category || !cat || cat === "Perlu dikategorikan")) {
      totalUncategorized += amt;
      uncategorizedList.push({
        id: e.id,
        date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
        desc: e.description,
        amount: amt,
        projectName: e.project_id ? projectsById.get(e.project_id)?.name : undefined,
      });
    } else {
      if (normalizedCategory) {
        const prev = categoryTotals.get(normalizedCategory) || 0;
        categoryTotals.set(normalizedCategory, prev + amt);
      } else {
        totalUncategorized += amt;
        uncategorizedList.push({
          id: e.id,
          date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
          desc: e.description,
          amount: amt,
          projectName: e.project_id ? projectsById.get(e.project_id)?.name : undefined,
        });
      }
    }
  });

  const hppCategories: CategorySummary[] = hppNames.map((name) => ({
    name,
    amount: categoryTotals.get(name) || 0,
  }));
  const totalHpp = hppCategories.reduce((sum, c) => sum + c.amount, 0);

  const opexCategories: CategorySummary[] = opexNames.map((name) => ({
    name,
    amount: categoryTotals.get(name) || 0,
  }));
  const totalOpex = opexCategories.reduce((sum, c) => sum + c.amount, 0);

  const capexCategories: CategorySummary[] = capexNames.map((name) => ({
    name,
    amount: categoryTotals.get(name) || 0,
  }));
  const totalCapex = capexCategories.reduce((sum, c) => sum + c.amount, 0);

  const grossProfit = totalRevenue - totalHpp;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netIncome = grossProfit - totalOpex;
  const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // 3. Saldo Kas Riil & Saldo Awal 2025
  const balances = await getAccountsWithCalculatedBalance(user.organizationId);
  const openingCash = balances.reduce((sum, b) => sum + b.openingBalance, 0);
  const currentCash = balances.reduce((sum, b) => sum + b.currentBalance, 0);

  // 4. Kasbon Owner
  const { data: ownerRecipients } = await supabase
    .from("advance_recipients")
    .select("id, name, max_advance_amount")
    .eq("organization_id", user.organizationId)
    .eq("type", "OWNER");

  const { data: ownerAdvances } = await supabase
    .from("cash_advances")
    .select("recipient_id, disbursed_amount, settled_amount, returned_amount")
    .eq("organization_id", user.organizationId)
    .in("status", ["DISBURSED", "PARTIALLY_SETTLED"]);

  const advanceMap = new Map<string, number>();
  (ownerAdvances || []).forEach((oa: any) => {
    if (oa.recipient_id) {
      const open = Math.max(
        0,
        parseFloat(oa.disbursed_amount || "0") -
          parseFloat(oa.settled_amount || "0") -
          parseFloat(oa.returned_amount || "0")
      );
      advanceMap.set(oa.recipient_id, (advanceMap.get(oa.recipient_id) || 0) + open);
    }
  });

  const ownersList = (ownerRecipients || []).map((o: any) => {
    const openBal = advanceMap.get(o.id) || 0;
    const maxLim = parseFloat(o.max_advance_amount || "0") || 0;
    return {
      name: o.name,
      amount: openBal,
      remainingLimit: Math.max(0, maxLim - openBal),
    };
  });

  const totalOwnerAdvances = ownersList.reduce((sum, o) => sum + o.amount, 0);
  const cashAfterAdvances = currentCash - totalOwnerAdvances;

  return {
    fiscalYear: year,
    revenues: revenuesList,
    totalRevenue,
    hppCategories,
    totalHpp,
    grossProfit,
    grossMargin,
    opexCategories,
    totalOpex,
    netIncome,
    netMargin,
    capexCategories,
    totalCapex,
    openingCash,
    currentCash,
    ownerAdvances: ownersList,
    totalOwnerAdvances,
    cashAfterAdvances,
    uncategorizedExpenses: uncategorizedList,
    totalUncategorized,
  };
}
