"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { getAccountsWithCalculatedBalance } from "@/lib/accounting/cashBalance";

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

export async function getRekapitulasiData(year: number = 2026): Promise<RekapitulasiReportData> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  // 1. Ambil Semua Proyek & Pendapatan (project_revenues)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, code, client_id")
    .eq("organization_id", user.organizationId)
    .order("name");

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

  const { data: revenues } = await supabase
    .from("project_revenues")
    .select("project_id, amount, date")
    .eq("organization_id", user.organizationId)
    .gte("date", startDate)
    .lte("date", endDate);

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
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, date, description, total_amount, category, needs_category, project_id")
    .eq("organization_id", user.organizationId)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", ["APPROVED", "POSTED"]);

  // 4 Kategori HPP
  const hppNames = [
    "Bahan Baku Utama / Material",
    "Upah Tukang",
    "Sewa Alat Proyek",
    "Transportasi Lapangan",
  ];

  // 7 Kategori OPEX
  const opexNames = [
    "Gaji dan Upah Karyawan",
    "Transportasi Operasional",
    "Biaya Konsumsi Kantor",
    "Biaya Jamuan / Representasi",
    "Biaya Marketing",
    "Kebutuhan Workshop",
    "Biaya Administrasi Finansial",
  ];

  // 4 Kategori CAPEX
  const capexNames = [
    "Renovasi Kantor",
    "Legalitas Perusahaan",
    "Inventaris",
    "Perangkat Gadget",
  ];

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

    if (e.needs_category || !cat || cat === "Perlu dikategorikan") {
      totalUncategorized += amt;
      uncategorizedList.push({
        id: e.id,
        date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
        desc: e.description,
        amount: amt,
        projectName: e.project_id ? projectsById.get(e.project_id)?.name : undefined,
      });
    } else {
      const prev = categoryTotals.get(cat) || 0;
      categoryTotals.set(cat, prev + amt);
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
