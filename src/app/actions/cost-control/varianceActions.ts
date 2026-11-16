"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";

export interface MaterialVarianceRow {
  material_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  planned_qty: number;
  purchased_qty: number;
  received_qty: number;
  issued_qty: number;
  installed_qty: number;
  qty_diff_purchase_vs_plan: number;
  cost_diff_purchase_vs_plan: number;
  waste_qty: number;
  waste_percent: number;
  tolerance_percent: number;
  waste_cost_idr: number;
  status: "NORMAL" | "PERLU_VERIFIKASI" | "DI_ATAS_TOLERANSI" | "INVESTIGASI_DIPERLUKAN";
  anomaly_description: string;
}

export interface LaborVarianceRow {
  claim_id: string;
  project_id: string;
  project_name: string;
  job_name: string;
  mandor_name: string;
  unit: string;
  claimed_volume: number;
  verified_volume: number;
  volume_diff: number;
  unit_rate: number;
  standard_rate: number;
  rate_diff: number;
  overclaim_amount: number;
  status: "NORMAL" | "PERLU_VERIFIKASI" | "DI_ATAS_TOLERANSI" | "INVESTIGASI_DIPERLUKAN";
  anomaly_description: string;
}

export interface CostControlDashboardData {
  projectId?: string;
  projectName?: string;
  totalBudget: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalOtherCost: number;
  totalActualCost: number;
  budgetConsumptionPercent: number;
  budgetVariance: number; // positive = under budget (savings), negative = over budget
  materialVariances: MaterialVarianceRow[];
  laborVariances: LaborVarianceRow[];
  anomaliesCount: number;
  investigationItemsCount: number;
}

export interface ProjectTakeoffItem {
  id: string;
  organization_id: string;
  project_id: string;
  room_name: string;
  length_m: number;
  width_m: number;
  height_m: number;
  floor_area_m2: number;
  wall_perimeter_m: number;
  wall_area_m2: number;
  ceiling_area_m2: number;
  door_window_area_m2: number;
  net_wall_area_m2: number;
  lighting_points: number;
  notes?: string | null;
  created_at: string;
  // Computed material estimations
  estimated_tile_m2: number;
  estimated_paint_liters: number;
  estimated_ceiling_boards: number;
}

// ----------------------------------------------------
// 1. ANALISIS SELISIH & COST CONTROL DASHBOARD
// ----------------------------------------------------

export async function getCostControlDashboard(projectId?: string): Promise<CostControlDashboardData> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Load project information if specific project
  let projectName = "Semua Proyek";
  if (projectId && projectId !== "ALL") {
    const { data: proj } = await supabase
      .from("projects")
      .select("name, code, contract_value")
      .eq("id", projectId)
      .eq("organization_id", user.organizationId)
      .single();
    if (proj) projectName = `${proj.code} • ${proj.name}`;
  }

  // 1. Budget calculation (from approved RAB, RAP, or project contract_value)
  let totalBudget = 0;
  let rabQuery = supabase
    .from("rab_projects")
    .select("total_hpp, grand_total, status")
    .eq("organization_id", user.organizationId);

  if (projectId && projectId !== "ALL") {
    rabQuery = rabQuery.eq("project_id", projectId);
  }

  const { data: rabRows } = await rabQuery;
  if (rabRows && rabRows.length > 0) {
    const approvedRab = rabRows.find((r) => r.status === "APPROVED") || rabRows[0];
    totalBudget = Number(approvedRab.total_hpp || approvedRab.grand_total || 0);
  }

  // 2. Load actual material expenses
  let matPriceQuery = supabase
    .from("material_price_history")
    .select("total_price")
    .eq("organization_id", user.organizationId);
  if (projectId && projectId !== "ALL") {
    matPriceQuery = matPriceQuery.eq("project_id", projectId);
  }
  const { data: matPrices } = await matPriceQuery;
  const totalMaterialCost = (matPrices || []).reduce((acc, p) => acc + Number(p.total_price || 0), 0);

  // 3. Load actual labor claims paid
  let laborClaimQuery = supabase
    .from("labor_claims")
    .select("paid_amount, approved_amount")
    .eq("organization_id", user.organizationId);
  if (projectId && projectId !== "ALL") {
    laborClaimQuery = laborClaimQuery.eq("project_id", projectId);
  }
  const { data: laborClaims } = await laborClaimQuery;
  const totalLaborCost = (laborClaims || []).reduce(
    (acc, c) => acc + Number(c.paid_amount || 0),
    0
  );

  // 4. Load other general/project expenses from existing expenses table
  let expQuery = supabase
    .from("expenses")
    .select("total_amount, category")
    .eq("organization_id", user.organizationId)
    .in("status", ["APPROVED", "POSTED"]);

  if (projectId && projectId !== "ALL") {
    expQuery = expQuery.eq("project_id", projectId);
  }
  const { data: otherExpenses } = await expQuery;
  const totalOtherCost = (otherExpenses || [])
    .filter((e) => !["Upah Tukang", "Bahan Bangunan", "Subkontraktor"].includes(e.category || ""))
    .reduce((acc, e) => acc + Number(e.total_amount || 0), 0);

  const totalActualCost = totalMaterialCost + totalLaborCost + totalOtherCost;
  const budgetConsumptionPercent =
    totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 1000) / 10 : 0;
  const budgetVariance = totalBudget - totalActualCost;

  // 5. Material Variance Analysis
  const materialVariances = await computeMaterialVariances(user.organizationId, projectId);

  // 6. Labor Variance Analysis
  const laborVariances = await computeLaborVariances(user.organizationId, projectId);

  const anomaliesCount =
    materialVariances.filter((m) => m.status !== "NORMAL").length +
    laborVariances.filter((l) => l.status !== "NORMAL").length;

  const investigationItemsCount =
    materialVariances.filter((m) => m.status === "INVESTIGASI_DIPERLUKAN").length +
    laborVariances.filter((l) => l.status === "INVESTIGASI_DIPERLUKAN").length;

  return {
    projectId: projectId === "ALL" ? undefined : projectId,
    projectName,
    totalBudget,
    totalMaterialCost,
    totalLaborCost,
    totalOtherCost,
    totalActualCost,
    budgetConsumptionPercent,
    budgetVariance,
    materialVariances,
    laborVariances,
    anomaliesCount,
    investigationItemsCount,
  };
}

async function computeMaterialVariances(organizationId: string, projectId?: string): Promise<MaterialVarianceRow[]> {
  const supabase = await createClient();

  const { data: materials } = await supabase
    .from("master_materials")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (!materials || materials.length === 0) return [];

  let planQuery = supabase.from("project_materials").select("*").eq("organization_id", organizationId);
  let movQuery = supabase.from("material_stock_movements").select("*").eq("organization_id", organizationId);
  let purchaseQuery = supabase.from("material_price_history").select("*").eq("organization_id", organizationId);

  if (projectId && projectId !== "ALL") {
    planQuery = planQuery.eq("project_id", projectId);
    movQuery = movQuery.eq("project_id", projectId);
    purchaseQuery = purchaseQuery.eq("project_id", projectId);
  }

  const [{ data: plans }, { data: movs }, { data: purchases }] = await Promise.all([
    planQuery,
    movQuery,
    purchaseQuery,
  ]);

  const planMap = new Map<string, number>();
  (plans || []).forEach((p) => {
    planMap.set(p.material_id, (planMap.get(p.material_id) || 0) + Number(p.planned_quantity || 0));
  });

  const purchaseMap = new Map<string, number>();
  (purchases || []).forEach((p) => {
    purchaseMap.set(p.material_id, (purchaseMap.get(p.material_id) || 0) + Number(p.quantity || 0));
  });

  const movementsMap = new Map<string, Record<string, number>>();
  (movs || []).forEach((m) => {
    const cur = movementsMap.get(m.material_id) || {
      RECEIPT: 0,
      ISSUED_TO_FIELD: 0,
      USED: 0,
      DAMAGED_WASTE: 0,
    };
    cur[m.movement_type] = (cur[m.movement_type] || 0) + Number(m.quantity || 0);
    movementsMap.set(m.material_id, cur);
  });

  return materials.map((mat) => {
    const plannedQty = planMap.get(mat.id) || 0;
    const purchasedQty = purchaseMap.get(mat.id) || 0;
    const mov = movementsMap.get(mat.id) || { RECEIPT: 0, ISSUED_TO_FIELD: 0, USED: 0, DAMAGED_WASTE: 0 };
    const receivedQty = mov.RECEIPT;
    const issuedQty = mov.ISSUED_TO_FIELD;
    const installedQty = mov.USED > 0 ? mov.USED : (issuedQty > 0 ? issuedQty - mov.DAMAGED_WASTE : 0);
    const wasteQty = mov.DAMAGED_WASTE;

    const unitPrice = Number(mat.standard_price || 0);
    const qtyDiffPurchaseVsPlan = purchasedQty - plannedQty;
    const costDiffPurchaseVsPlan = qtyDiffPurchaseVsPlan * unitPrice;

    const totalConsumed = installedQty + wasteQty;
    const wastePercent = totalConsumed > 0 ? Math.round((wasteQty / totalConsumed) * 1000) / 10 : 0;
    const tolerancePercent = Number(mat.waste_tolerance_percent || 5);
    const wasteCostIdr = wasteQty * unitPrice;

    let status: MaterialVarianceRow["status"] = "NORMAL";
    let anomalyDescription = "Semua parameter dalam batas wajar.";

    if (wastePercent > tolerancePercent * 1.5 && wasteQty > 0) {
      status = "INVESTIGASI_DIPERLUKAN";
      anomalyDescription = `Waste (${wastePercent}%) melampaui toleransi ${tolerancePercent}%. Potensi kerusakan atau susut material berlebih.`;
    } else if (wastePercent > tolerancePercent) {
      status = "DI_ATAS_TOLERANSI";
      anomalyDescription = `Waste (${wastePercent}%) berada di atas toleransi standar (${tolerancePercent}%).`;
    } else if (plannedQty > 0 && purchasedQty > plannedQty * 1.15) {
      status = "PERLU_VERIFIKASI";
      anomalyDescription = `Pembelian (${purchasedQty} ${mat.purchase_unit}) melebihi estimasi kebutuhan RAB (${plannedQty} ${mat.purchase_unit}).`;
    }

    return {
      material_id: mat.id,
      code: mat.code,
      name: mat.name,
      category: mat.category,
      unit: mat.purchase_unit,
      planned_qty: plannedQty,
      purchased_qty: purchasedQty,
      received_qty: receivedQty,
      issued_qty: issuedQty,
      installed_qty: installedQty,
      qty_diff_purchase_vs_plan: qtyDiffPurchaseVsPlan,
      cost_diff_purchase_vs_plan: costDiffPurchaseVsPlan,
      waste_qty: wasteQty,
      waste_percent: wastePercent,
      tolerance_percent: tolerancePercent,
      waste_cost_idr: wasteCostIdr,
      status,
      anomaly_description: anomalyDescription,
    };
  });
}

async function computeLaborVariances(organizationId: string, projectId?: string): Promise<LaborVarianceRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("labor_claims")
    .select(`
      id, project_id, mandor_name, claimed_volume, verified_volume, unit_rate,
      project:projects(name, code),
      labor_item:project_labor_items(job_name, unit, labor_rate_id)
    `)
    .eq("organization_id", organizationId)
    .order("claim_date", { ascending: false });

  if (projectId && projectId !== "ALL") {
    query = query.eq("project_id", projectId);
  }

  const { data: claims } = await query;
  if (!claims || claims.length === 0) return [];

  // Load standard labor rates to compare unit_rate vs standard_rate
  const { data: standardRates } = await supabase
    .from("labor_rates")
    .select("id, standard_rate")
    .eq("organization_id", organizationId);

  const rateMap = new Map((standardRates || []).map((r) => [r.id, Number(r.standard_rate)]));

  return claims.map((c: any) => {
    const claimedVol = Number(c.claimed_volume || 0);
    const verifiedVol = Number(c.verified_volume || 0);
    const unitRate = Number(c.unit_rate || 0);
    const standardRate = rateMap.get(c.labor_item?.labor_rate_id) || unitRate;

    const volDiff = claimedVol - verifiedVol;
    const overclaimAmount = Math.max(0, volDiff * unitRate);
    const rateDiff = unitRate - standardRate;

    let status: LaborVarianceRow["status"] = "NORMAL";
    let anomalyDescription = "Volume dan tarif sesuai hasil verifikasi.";

    if (volDiff > 0 && verifiedVol > 0 && (volDiff / verifiedVol) > 0.15) {
      status = "INVESTIGASI_DIPERLUKAN";
      anomalyDescription = `Klaim tukang (${claimedVol} ${c.labor_item?.unit || ""}) lebih tinggi ${(volDiff / verifiedVol * 100).toFixed(0)}% dari hasil ukur pengawas (${verifiedVol}). Selisih: Rp${overclaimAmount.toLocaleString("id-ID")}.`;
    } else if (volDiff > 0) {
      status = "PERLU_VERIFIKASI";
      anomalyDescription = `Terdapat selisih klaim volume sebesar ${volDiff} ${c.labor_item?.unit || ""} (Klaim: ${claimedVol}, Ukur: ${verifiedVol}).`;
    } else if (rateDiff > standardRate * 0.2 && standardRate > 0) {
      status = "DI_ATAS_TOLERANSI";
      anomalyDescription = `Tarif satuan (Rp${unitRate.toLocaleString("id-ID")}) melebihi standar perusahaan (Rp${standardRate.toLocaleString("id-ID")}).`;
    }

    return {
      claim_id: c.id,
      project_id: c.project_id,
      project_name: c.project ? `${c.project.code} - ${c.project.name}` : "Proyek",
      job_name: c.labor_item?.job_name || "Pekerjaan Upah",
      mandor_name: c.mandor_name,
      unit: c.labor_item?.unit || "m²",
      claimed_volume: claimedVol,
      verified_volume: verifiedVol,
      volume_diff: volDiff,
      unit_rate: unitRate,
      standard_rate: standardRate,
      rate_diff: rateDiff,
      overclaim_amount: overclaimAmount,
      status,
      anomaly_description: anomalyDescription,
    };
  });
}

// ----------------------------------------------------
// 2. QUANTITY TAKEOFF (QTO) & PARAMETER DIMENSI BANGUNAN
// ----------------------------------------------------

export async function getProjectTakeoffs(projectId: string): Promise<ProjectTakeoffItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_takeoffs")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Gagal memuat quantity takeoff: ${error.message}`);

  return (data || []).map((row) => {
    const floorArea = Number(row.floor_area_m2 || 0);
    const netWallArea = Number(row.net_wall_area_m2 || 0);

    // Granite Tile 60x60 (with 7% waste allowance)
    const estimatedTile = Math.round(floorArea * 1.07 * 10) / 10;
    // Paint coverage (2 coats, ~12 m²/liter)
    const estimatedPaintLiters = Math.round(((netWallArea * 2) / 12) * 10) / 10;
    // Gypsum boards 1200x2400 (2.88 m² per board, with 5% waste)
    const ceilingArea = Number(row.ceiling_area_m2 || 0);
    const estimatedCeilingBoards = Math.ceil((ceilingArea * 1.05) / 2.88);

    return {
      ...row,
      length_m: Number(row.length_m),
      width_m: Number(row.width_m),
      height_m: Number(row.height_m),
      floor_area_m2: floorArea,
      wall_perimeter_m: Number(row.wall_perimeter_m),
      wall_area_m2: Number(row.wall_area_m2),
      ceiling_area_m2: ceilingArea,
      door_window_area_m2: Number(row.door_window_area_m2),
      net_wall_area_m2: netWallArea,
      lighting_points: Number(row.lighting_points || 0),
      estimated_tile_m2: estimatedTile,
      estimated_paint_liters: estimatedPaintLiters,
      estimated_ceiling_boards: estimatedCeilingBoards,
    };
  });
}

export async function saveProjectTakeoff(input: {
  id?: string;
  project_id: string;
  room_name: string;
  length_m: number;
  width_m: number;
  height_m: number;
  door_window_area_m2?: number;
  lighting_points?: number;
  notes?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const length = Number(input.length_m || 0);
  const width = Number(input.width_m || 0);
  const height = Number(input.height_m || 0);
  const openings = Number(input.door_window_area_m2 || 0);

  const floorArea = length * width;
  const ceilingArea = floorArea;
  const perimeter = 2 * (length + width);
  const grossWallArea = perimeter * height;
  const netWallArea = Math.max(0, grossWallArea - openings);

  const payload = {
    organization_id: user.organizationId,
    project_id: input.project_id,
    room_name: input.room_name.trim(),
    length_m: length,
    width_m: width,
    height_m: height,
    floor_area_m2: floorArea,
    wall_perimeter_m: perimeter,
    wall_area_m2: grossWallArea,
    ceiling_area_m2: ceilingArea,
    door_window_area_m2: openings,
    net_wall_area_m2: netWallArea,
    lighting_points: input.lighting_points || 0,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (input.id) {
    const { data, error } = await supabase
      .from("project_takeoffs")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", user.organizationId)
      .select()
      .single();
    if (error) throw new Error(`Gagal memperbarui takeoff: ${error.message}`);
    result = data;
  } else {
    const { data, error } = await supabase
      .from("project_takeoffs")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(`Gagal menyimpan takeoff: ${error.message}`);
    result = data;
  }

  await logAudit(user, {
    action: input.id ? "UPDATE_PROJECT_TAKEOFF" : "CREATE_PROJECT_TAKEOFF",
    entityType: "project_takeoffs",
    entityId: result.id,
    metadata: { room_name: input.room_name, floorArea, netWallArea },
  });

  revalidatePath("/cost-control/variance-analysis");
  return result;
}

export async function deleteProjectTakeoff(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_takeoffs")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus takeoff: ${error.message}`);

  revalidatePath("/cost-control/variance-analysis");
  return { success: true };
}
