"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";

const RAP_EDITOR_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];

function assertRapEditor(role: string) {
  if (!RAP_EDITOR_ROLES.includes(role)) {
    throw new Error("Hanya Owner, Finance, atau Project Manager yang dapat mengelola RAP.");
  }
}

export interface RapProjectItem {
  id: string;
  organization_id: string;
  project_id: string;
  rab_id?: string | null;
  rap_number: string;
  title: string;
  version: number;
  status: "DRAFT" | "APPROVED" | "ACTIVE" | "COMPLETED";
  total_planned_budget: number;
  target_savings: number;
  notes?: string | null;
  created_at: string;
  project?: { id: string; name: string; code: string };
  rab?: { rab_number: string; title: string; grand_total: number };
  items?: RapWorkItem[];
}

export interface RapWorkItem {
  id: string;
  rap_id: string;
  rab_item_id?: string | null;
  division: string;
  sub_division?: string | null;
  item_name: string;
  unit: string;
  volume: number;
  target_material_cost: number;
  target_labor_cost: number;
  target_equipment_cost: number;
  target_unit_price: number;
  total_budget: number;
  procurement_schedule?: string | null;
  execution_schedule?: string | null;
  pic_name?: string | null;
  sort_order: number;
}

export interface BudgetVsActualComparison {
  projectId: string;
  projectName: string;
  projectCode: string;
  contractValue: number;
  rabTotal: number | null;
  rapTotal: number | null;
  actualMaterialCost: number;
  actualLaborCost: number;
  actualOtherCost: number;
  totalActualCost: number;
  costVarianceVsRap: number | null; // positive = under budget / savings, negative = overrun
  costVarianceVsRab: number | null;
  forecastFinalCost: number | null;
  projectedProfit: number | null;
  projectedMarginPercent: number | null;
  items: Array<{
    division: string;
    item_name: string;
    unit: string;
    volume: number;
    rap_budget: number;
    actual_cost: number | null;
    variance: number | null;
    status: "ON_BUDGET" | "NEAR_LIMIT" | "OVER_BUDGET" | "UNALLOCATED";
  }>;
}

// ----------------------------------------------------
// 1. RAP PROJECTS & ITEMS
// ----------------------------------------------------

export async function getRapProjects(projectId?: string): Promise<RapProjectItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("rap_projects")
    .select(`
      *,
      project:projects(id, name, code),
      rab:rab_projects(rab_number, title, grand_total)
    `)
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (projectId && projectId !== "ALL") {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat daftar RAP: ${error.message}`);

  return (data || []).map((r: any) => ({
    ...r,
    total_planned_budget: Number(r.total_planned_budget),
    target_savings: Number(r.target_savings),
    rab: r.rab ? { ...r.rab, grand_total: Number(r.rab.grand_total) } : undefined,
  }));
}

export async function getRapProjectDetail(rapId: string): Promise<RapProjectItem> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: rap, error } = await supabase
    .from("rap_projects")
    .select(`
      *,
      project:projects(id, name, code),
      rab:rab_projects(rab_number, title, grand_total),
      items:rap_items(*)
    `)
    .eq("id", rapId)
    .eq("organization_id", user.organizationId)
    .single();

  if (error || !rap) throw new Error(`RAP tidak ditemukan: ${error?.message}`);

  const formattedItems: RapWorkItem[] = (rap.items || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((item: any) => ({
      ...item,
      volume: Number(item.volume),
      target_material_cost: Number(item.target_material_cost),
      target_labor_cost: Number(item.target_labor_cost),
      target_equipment_cost: Number(item.target_equipment_cost),
      target_unit_price: Number(item.target_unit_price),
      total_budget: Number(item.total_budget),
    }));

  return {
    ...rap,
    total_planned_budget: Number(rap.total_planned_budget),
    target_savings: Number(rap.target_savings),
    items: formattedItems,
  };
}

export async function createRapFromRab(rabId: string, options?: { targetSavingsPercent?: number }) {
  const user = await requireAuthUser();
  assertRapEditor(user.role);
  const supabase = await createClient();
  const savingsPct = options?.targetSavingsPercent !== undefined ? options.targetSavingsPercent : 5.0; // target 5% internal cost reduction
  if (!Number.isFinite(savingsPct) || savingsPct < 0 || savingsPct > 30) {
    throw new Error("Target efisiensi RAP harus berada di antara 0 dan 30 persen.");
  }

  const rapNumber = `RAP-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase.rpc("create_rap_from_rab", {
    p_rab_id: rabId,
    p_rap_number: rapNumber,
    p_target_savings_percent: savingsPct,
  });
  if (error) throw new Error(`Gagal membuat RAP dari RAB: ${error.message}`);
  const rap = data as RapProjectItem | null;
  if (!rap?.id) throw new Error("Pembuatan RAP tidak menghasilkan dokumen.");

  await logAudit(user, {
    action: "CREATE_RAP_FROM_RAB",
    entityType: "rap_projects",
    entityId: rap.id,
    metadata: { rap_number: rapNumber, rab_id: rabId, total_planned_budget: rap.total_planned_budget },
  });

  revalidatePath("/cost-control/rap");
  return rap;
}

export async function updateRapItem(
  itemId: string,
  rapId: string,
  input: {
    target_material_cost?: number;
    target_labor_cost?: number;
    target_equipment_cost?: number;
    procurement_schedule?: string;
    execution_schedule?: string;
    pic_name?: string;
  }
) {
  const user = await requireAuthUser();
  assertRapEditor(user.role);
  const supabase = await createClient();

  const { data: rap, error: rapError } = await supabase
    .from("rap_projects")
    .select("id, status")
    .eq("id", rapId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (rapError) throw new Error(`Gagal memvalidasi RAP: ${rapError.message}`);
  if (!rap) throw new Error("RAP tidak ditemukan.");
  if (rap.status !== "DRAFT") throw new Error("Hanya RAP berstatus DRAFT yang dapat diubah.");

  const { data: existing, error: itemError } = await supabase
    .from("rap_items")
    .select("*")
    .eq("id", itemId)
    .eq("rap_id", rapId)
    .maybeSingle();

  if (itemError) throw new Error(`Gagal memuat item RAP: ${itemError.message}`);
  if (!existing) throw new Error("Item RAP tidak ditemukan.");

  const mat = input.target_material_cost !== undefined ? input.target_material_cost : Number(existing.target_material_cost);
  const lab = input.target_labor_cost !== undefined ? input.target_labor_cost : Number(existing.target_labor_cost);
  const eq = input.target_equipment_cost !== undefined ? input.target_equipment_cost : Number(existing.target_equipment_cost);
  if (![mat, lab, eq].every((cost) => Number.isFinite(cost) && cost >= 0)) {
    throw new Error("Biaya material, upah, dan peralatan harus berupa angka valid dan tidak negatif.");
  }
  const unitPrice = mat + lab + eq;
  const totalBudget = unitPrice * Number(existing.volume);

  const { data, error } = await supabase
    .from("rap_items")
    .update({
      target_material_cost: mat,
      target_labor_cost: lab,
      target_equipment_cost: eq,
      target_unit_price: unitPrice,
      total_budget: totalBudget,
      procurement_schedule: input.procurement_schedule !== undefined ? input.procurement_schedule : existing.procurement_schedule,
      execution_schedule: input.execution_schedule !== undefined ? input.execution_schedule : existing.execution_schedule,
      pic_name: input.pic_name !== undefined ? input.pic_name : existing.pic_name,
    })
    .eq("id", itemId)
    .eq("rap_id", rapId)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui item RAP: ${error.message}`);

  // Re-sum RAP total
  const { data: allItems, error: itemsError } = await supabase
    .from("rap_items")
    .select("total_budget")
    .eq("rap_id", rapId);
  if (itemsError) throw new Error(`Gagal menghitung total RAP: ${itemsError.message}`);

  const sumTotal = (allItems || []).reduce((acc, it) => acc + Number(it.total_budget || 0), 0);
  const { error: totalError } = await supabase
    .from("rap_projects")
    .update({ total_planned_budget: sumTotal })
    .eq("id", rapId)
    .eq("organization_id", user.organizationId)
    .eq("status", "DRAFT");
  if (totalError) throw new Error(`Gagal memperbarui total RAP: ${totalError.message}`);

  revalidatePath(`/cost-control/rap/${rapId}`);
  return data;
}

// ----------------------------------------------------
// 2. BUDGET VS ACTUAL & PROFITABILITAS PROYEK
// ----------------------------------------------------

export async function getBudgetVsActualComparison(projectId: string): Promise<BudgetVsActualComparison> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, code, contract_value")
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .single();

  if (projectError) throw new Error(`Gagal memuat proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan.");

  const [{ data: rabs, error: rabError }, { data: raps, error: rapError }] = await Promise.all([
    supabase
      .from("rab_projects")
      .select("id, grand_total, total_hpp, version")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId)
      .eq("status", "APPROVED")
      .eq("is_locked", true)
      .order("version", { ascending: false }),
    supabase
      .from("rap_projects")
      .select("id, total_planned_budget, version")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId)
      .in("status", ["APPROVED", "ACTIVE", "COMPLETED"])
      .order("version", { ascending: false }),
  ]);
  if (rabError) throw new Error(`Gagal memuat RAB disetujui: ${rabError.message}`);
  if (rapError) throw new Error(`Gagal memuat RAP aktif: ${rapError.message}`);

  const activeRab = rabs?.[0];
  const activeRap = raps?.[0];

  const rabTotal = activeRab
    ? Number(activeRab.grand_total || activeRab.total_hpp || 0)
    : null;
  const rapTotal = activeRap ? Number(activeRap.total_planned_budget || 0) : null;

  let rapItems: any[] = [];
  if (activeRap?.id) {
    const { data: items, error: itemsError } = await supabase
      .from("rap_items")
      .select("*")
      .eq("rap_id", activeRap.id)
      .order("sort_order", { ascending: true });
    if (itemsError) throw new Error(`Gagal memuat item RAP: ${itemsError.message}`);
    rapItems = items || [];
  }

  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("total_amount, source")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .in("status", ["APPROVED", "POSTED"])
    .not("cash_account_id", "is", null);
  if (expensesError) throw new Error(`Gagal memuat pengeluaran yang sudah dibayar: ${expensesError.message}`);

  const paidExpenses = expenses || [];
  const actualMaterialCost = paidExpenses
    .filter((expense) => expense.source === "MATERIAL_PURCHASE")
    .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);
  const actualLaborCost = paidExpenses
    .filter((expense) => expense.source === "LABOR_CLAIM")
    .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);
  const actualOtherCost = paidExpenses
    .filter((expense) => !["MATERIAL_PURCHASE", "LABOR_CLAIM"].includes(expense.source || ""))
    .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

  const totalActualCost = actualMaterialCost + actualLaborCost + actualOtherCost;
  const costVarianceVsRap = rapTotal === null ? null : rapTotal - totalActualCost;
  const costVarianceVsRab = rabTotal === null ? null : rabTotal - totalActualCost;

  const [{ data: schedules, error: schedulesError }, { data: progressRecords, error: progressError }] = await Promise.all([
    supabase
      .from("project_schedules")
      .select("id, weight_percentage")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId),
    supabase
      .from("project_progress_records")
      .select("schedule_id, period_week, actual_progress_percent")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId)
      .not("verified_by", "is", null)
      .not("verified_at", "is", null)
      .order("period_week", { ascending: false }),
  ]);
  if (schedulesError) throw new Error(`Gagal memuat jadwal proyek: ${schedulesError.message}`);
  if (progressError) throw new Error(`Gagal memuat progres terverifikasi: ${progressError.message}`);

  const latestProgress = new Map<string, number>();
  (progressRecords || []).forEach((record) => {
    if (!latestProgress.has(record.schedule_id)) {
      latestProgress.set(record.schedule_id, Number(record.actual_progress_percent));
    }
  });
  const actualProgressPercent = (schedules || []).reduce(
    (sum, schedule) =>
      sum + (Number(schedule.weight_percentage) * (latestProgress.get(schedule.id) || 0)) / 100,
    0,
  );
  const forecastFinalCost = actualProgressPercent > 0
    ? totalActualCost / (actualProgressPercent / 100)
    : null;
  const contractVal = Number(project.contract_value || 0);
  const projectedProfit = forecastFinalCost === null || contractVal <= 0
    ? null
    : contractVal - forecastFinalCost;
  const projectedMarginPercent = projectedProfit === null
    ? null
    : (projectedProfit / contractVal) * 100;

  const items = rapItems.map((it) => {
    const itemBudget = Number(it.total_budget || 0);

    return {
      division: it.division,
      item_name: it.item_name,
      unit: it.unit,
      volume: Number(it.volume),
      rap_budget: itemBudget,
      actual_cost: null,
      variance: null,
      status: "UNALLOCATED" as const,
    };
  });

  return {
    projectId,
    projectName: project.name,
    projectCode: project.code,
    contractValue: contractVal,
    rabTotal,
    rapTotal,
    actualMaterialCost,
    actualLaborCost,
    actualOtherCost,
    totalActualCost,
    costVarianceVsRap,
    costVarianceVsRab,
    forecastFinalCost,
    projectedProfit,
    projectedMarginPercent: projectedMarginPercent === null
      ? null
      : Math.round(projectedMarginPercent * 10) / 10,
    items,
  };
}
