"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";
import { convertMaterialQuantityToUsageUnit } from "@/lib/cost-control/materialUnits";

const MATERIAL_MASTER_EDITOR_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];
const MATERIAL_MOVEMENT_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER", "SITE_STAFF"];

function assertRole(role: string, allowedRoles: string[], message: string) {
  if (!allowedRoles.includes(role)) throw new Error(message);
}

export interface MasterMaterialItem {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  category: string;
  brand?: string | null;
  specification?: string | null;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: number;
  standard_price: number;
  min_price: number;
  max_price: number;
  waste_tolerance_percent: number;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialPriceHistoryItem {
  id: string;
  organization_id: string;
  material_id: string;
  vendor_id?: string | null;
  vendor_name: string;
  project_id?: string | null;
  expense_id?: string | null;
  purchase_date: string;
  document_number?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_amount: number;
  total_price: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  material?: { name: string; code: string; category: string; usage_unit: string };
  project?: { name: string; code: string };
}

export interface ProjectMaterialRecapRow {
  material_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  usage_unit: string;
  conversion_factor: number;
  waste_tolerance_percent: number;
  planned_quantity: number;
  budget_unit_price: number;
  total_budget: number;
  purchased_quantity: number;
  received_quantity: number;
  issued_quantity: number;
  used_quantity: number;
  returned_quantity: number;
  damaged_quantity: number;
  current_stock: number;
  verified_installed_volume: number;
  actual_waste_percent: number;
  status: "NORMAL" | "PERLU_VERIFIKASI" | "DI_ATAS_TOLERANSI" | "INVESTIGASI_DIPERLUKAN";
}

// ----------------------------------------------------
// 1. MASTER MATERIAL
// ----------------------------------------------------

export async function getMasterMaterials(filters?: { category?: string; search?: string }) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("master_materials")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("name", { ascending: true });

  if (filters?.category && filters.category !== "ALL") {
    query = query.eq("category", filters.category);
  }

  if (filters?.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term},brand.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat katalog material: ${error.message}`);

  return (data || []).map((row) => ({
    ...row,
    conversion_factor: Number(row.conversion_factor),
    standard_price: Number(row.standard_price),
    min_price: Number(row.min_price),
    max_price: Number(row.max_price),
    waste_tolerance_percent: Number(row.waste_tolerance_percent),
  }));
}

export async function createMasterMaterial(input: {
  code: string;
  name: string;
  category: string;
  brand?: string;
  specification?: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor?: number;
  standard_price?: number;
  min_price?: number;
  max_price?: number;
  waste_tolerance_percent?: number;
  notes?: string;
  initial_vendor_name?: string;
  initial_price?: number;
}) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MASTER_EDITOR_ROLES, "Anda tidak memiliki izin untuk mengubah master material.");
  const supabase = await createClient();

  const factor = input.conversion_factor ?? 1;
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error("Faktor konversi harus berupa angka lebih besar dari 0.");
  }
  
  const stdPrice = Number.isFinite(input.standard_price) && input.standard_price! >= 0
    ? Number(input.standard_price)
    : (input.initial_price && input.initial_price > 0 ? Number(input.initial_price) : 0);

  const minP = input.min_price !== undefined ? input.min_price : (stdPrice > 0 ? stdPrice * 0.9 : 0);
  const maxP = input.max_price !== undefined ? input.max_price : (stdPrice > 0 ? stdPrice * 1.15 : 0);
  const wasteTolerance = input.waste_tolerance_percent !== undefined ? input.waste_tolerance_percent : 5.0;

  const { data, error } = await supabase
    .from("master_materials")
    .insert({
      organization_id: user.organizationId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      category: input.category.trim(),
      brand: input.brand?.trim() || null,
      specification: input.specification?.trim() || null,
      purchase_unit: input.purchase_unit.trim(),
      usage_unit: input.usage_unit.trim(),
      conversion_factor: factor,
      standard_price: stdPrice,
      min_price: minP,
      max_price: maxP,
      waste_tolerance_percent: wasteTolerance,
      is_active: true,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menambahkan master material: ${error.message}`);

  // Catat harga toko pertama jika diisi (sesuai alur Dustin)
  if (input.initial_vendor_name?.trim() && input.initial_price && input.initial_price > 0) {
    await supabase.from("material_price_history").insert({
      organization_id: user.organizationId,
      material_id: data.id,
      vendor_name: input.initial_vendor_name.trim(),
      purchase_date: new Date().toISOString(),
      quantity: 1,
      unit: input.purchase_unit.trim(),
      unit_price: input.initial_price,
      tax_amount: 0,
      total_price: input.initial_price,
      notes: "Harga awal toko / survei pasar",
      created_by: user.id,
    });
  }

  await logAudit(user, {
    action: "CREATE_MASTER_MATERIAL",
    entityType: "master_materials",
    entityId: data.id,
    metadata: { code: input.code, name: input.name, standard_price: stdPrice },
  });

  revalidatePath("/cost-control/material-prices");
  revalidatePath("/cost-control/material-recap");
  return data;
}

export async function recordStoreMaterialPrice(input: {
  material_id: string;
  vendor_name: string;
  vendor_id?: string;
  unit_price: number;
  purchase_date?: string;
  document_number?: string;
  notes?: string;
}) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MOVEMENT_ROLES, "Anda tidak memiliki izin untuk mencatat harga toko material.");
  const supabase = await createClient();

  if (!input.material_id) throw new Error("Material wajib dipilih.");
  if (!input.vendor_name?.trim()) throw new Error("Nama toko / supplier material wajib diisi.");
  if (!Number.isFinite(input.unit_price) || input.unit_price <= 0) {
    throw new Error("Harga satuan harus berupa angka lebih besar dari 0.");
  }

  const { data: mat, error: matErr } = await supabase
    .from("master_materials")
    .select("id, name, purchase_unit")
    .eq("id", input.material_id)
    .eq("organization_id", user.organizationId)
    .single();

  if (matErr || !mat) throw new Error("Material tidak ditemukan.");

  const pDate = input.purchase_date || new Date().toISOString();
  const { data, error } = await supabase
    .from("material_price_history")
    .insert({
      organization_id: user.organizationId,
      material_id: input.material_id,
      vendor_id: input.vendor_id || null,
      vendor_name: input.vendor_name.trim(),
      purchase_date: pDate,
      document_number: input.document_number?.trim() || null,
      quantity: 1,
      unit: mat.purchase_unit,
      unit_price: input.unit_price,
      tax_amount: 0,
      total_price: input.unit_price,
      notes: input.notes?.trim() || "Catatan harga toko / survei pasar",
      created_by: user.id,
    })
    .select(`
      *,
      material:master_materials(name, code, category, usage_unit),
      project:projects(name, code)
    `)
    .single();

  if (error) throw new Error(`Gagal menyimpan harga toko: ${error.message}`);

  await logAudit(user, {
    action: "RECORD_STORE_MATERIAL_PRICE",
    entityType: "material_price_history",
    entityId: data.id,
    metadata: {
      material_id: input.material_id,
      vendor_name: input.vendor_name,
      unit_price: input.unit_price,
    },
  });

  revalidatePath("/cost-control/material-prices");
  return data;
}

export async function updateMasterMaterial(id: string, input: Partial<Parameters<typeof createMasterMaterial>[0]>) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MASTER_EDITOR_ROLES, "Anda tidak memiliki izin untuk mengubah master material.");
  if (input.conversion_factor !== undefined &&
      (!Number.isFinite(input.conversion_factor) || input.conversion_factor <= 0)) {
    throw new Error("Faktor konversi harus berupa angka lebih besar dari 0.");
  }
  if (input.standard_price !== undefined &&
      (!Number.isFinite(input.standard_price) || input.standard_price < 0)) {
    throw new Error("Harga standar harus berupa angka valid dan tidak negatif.");
  }
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("master_materials")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui master material: ${error.message}`);

  await logAudit(user, {
    action: "UPDATE_MASTER_MATERIAL",
    entityType: "master_materials",
    entityId: id,
    metadata: input,
  });

  revalidatePath("/cost-control/material-prices");
  revalidatePath("/cost-control/material-recap");
  return data;
}

export async function deleteMasterMaterial(id: string) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MASTER_EDITOR_ROLES, "Anda tidak memiliki izin untuk menonaktifkan master material.");
  const supabase = await createClient();

  const { error } = await supabase
    .from("master_materials")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menonaktifkan master material: ${error.message}`);

  await logAudit(user, {
    action: "DELETE_MASTER_MATERIAL",
    entityType: "master_materials",
    entityId: id,
  });

  revalidatePath("/cost-control/material-prices");
  return { success: true };
}

// ----------------------------------------------------
// 2. RIWAYAT HARGA MATERIAL & PEMBELIAN DARI VENDOR
// ----------------------------------------------------

export async function getMaterialPriceHistory(filters?: {
  materialId?: string;
  vendorId?: string;
  projectId?: string;
  limit?: number;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("material_price_history")
    .select(`
      *,
      material:master_materials(name, code, category, usage_unit),
      project:projects(name, code)
    `)
    .eq("organization_id", user.organizationId)
    .order("purchase_date", { ascending: false });

  if (filters?.materialId && filters.materialId !== "ALL") {
    query = query.eq("material_id", filters.materialId);
  }

  if (filters?.vendorId && filters.vendorId !== "ALL") {
    query = query.eq("vendor_id", filters.vendorId);
  }

  if (filters?.projectId && filters.projectId !== "ALL") {
    query = query.eq("project_id", filters.projectId);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat riwayat harga material: ${error.message}`);

  return (data || []).map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    tax_amount: Number(row.tax_amount || 0),
    total_price: Number(row.total_price),
  }));
}

export async function getMaterialPriceAnalytics(materialId?: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("material_price_history")
    .select("material_id, vendor_id, vendor_name, unit_price, purchase_date, unit")
    .eq("organization_id", user.organizationId)
    .order("purchase_date", { ascending: false });

  if (materialId) {
    query = query.eq("material_id", materialId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat analisis harga material: ${error.message}`);

  if (!data || data.length === 0) {
    return {
      cheapestPrice: 0,
      cheapestVendor: "-",
      highestPrice: 0,
      highestVendor: "-",
      averagePrice: 0,
      lastPrice: 0,
      lastVendor: "-",
      totalTransactions: 0,
      priceTrend: [],
    };
  }

  const prices = data.map((d) => ({
    price: Number(d.unit_price),
    vendor: d.vendor_name,
    date: d.purchase_date,
  }));

  const sortedByPrice = [...prices].sort((a, b) => a.price - b.price);
  const cheapest = sortedByPrice[0];
  const highest = sortedByPrice[sortedByPrice.length - 1];
  const sum = prices.reduce((acc, p) => acc + p.price, 0);
  const averagePrice = Math.round(sum / prices.length);
  const last = prices[0];

  const priceTrend = [...prices]
    .slice(0, 10)
    .reverse()
    .map((p) => ({
      date: p.date.slice(0, 10),
      price: p.price,
      vendor: p.vendor,
    }));

  return {
    cheapestPrice: cheapest.price,
    cheapestVendor: cheapest.vendor,
    highestPrice: highest.price,
    highestVendor: highest.vendor,
    averagePrice,
    lastPrice: last.price,
    lastVendor: last.vendor,
    totalTransactions: prices.length,
    priceTrend,
  };
}

export async function recordMaterialPurchase(input: {
  material_id: string;
  vendor_id?: string;
  vendor_name: string;
  project_id?: string;
  purchase_date?: string;
  document_number?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_amount?: number;
  notes?: string;
  record_stock_movement?: boolean;
  create_expense?: boolean;
  cash_account_id?: string;
}) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MOVEMENT_ROLES, "Anda tidak memiliki izin untuk mencatat pembelian material.");
  const supabase = await createClient();

  if (input.create_expense && !["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat mencatat pengeluaran pembelian material.");
  }

  const pDate = input.purchase_date || new Date().toISOString();
  const totalPrice = input.quantity * input.unit_price + (input.tax_amount ?? 0);
  const { data, error } = await supabase.rpc("record_material_purchase", {
    p_material_id: input.material_id,
    p_vendor_id: input.vendor_id || null,
    p_vendor_name: input.vendor_name,
    p_project_id: input.project_id || null,
    p_purchase_date: pDate,
    p_document_number: input.document_number || null,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_unit_price: input.unit_price,
    p_tax_amount: input.tax_amount ?? 0,
    p_notes: input.notes || null,
    p_record_stock_movement: input.record_stock_movement !== false,
    p_create_expense: input.create_expense === true,
    p_cash_account_id: input.cash_account_id || null,
  });

  if (error) throw new Error(`Gagal menyimpan pembelian material: ${error.message}`);
  const result = data as { history?: MaterialPriceHistoryItem; expense_id?: string | null } | null;
  if (!result?.history?.id) throw new Error("Pembelian material tidak menghasilkan riwayat transaksi.");
  const history = result.history;
  const createdExpenseId = result.expense_id || null;

  await logAudit(user, {
    action: "RECORD_MATERIAL_PURCHASE",
    entityType: "material_price_history",
    entityId: history.id,
    metadata: {
      material_id: input.material_id,
      vendor_name: input.vendor_name,
      total_price: totalPrice,
      expense_id: createdExpenseId,
    },
  });

  revalidatePath("/cost-control/material-prices");
  revalidatePath("/cost-control/material-recap");
  return history;
}

// ----------------------------------------------------
// 3. REKAPITULASI MATERIAL & ARUS MUTASI PROYEK
// ----------------------------------------------------

export async function getProjectMaterialRecap(projectId: string): Promise<ProjectMaterialRecapRow[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");

  // Load master materials
  const { data: materials, error: matErr } = await supabase
    .from("master_materials")
    .select("*")
    .eq("organization_id", user.organizationId);

  if (matErr) throw new Error(`Gagal memuat rekap material: ${matErr.message}`);
  if (!materials || materials.length === 0) return [];

  const [
    { data: planned, error: plannedError },
    { data: movements, error: movementsError },
    { data: purchases, error: purchasesError },
  ] = await Promise.all([
    supabase
      .from("project_materials")
      .select("*")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId),
    supabase
      .from("material_stock_movements")
      .select("material_id, movement_type, quantity, unit, verified_by")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId),
    supabase
      .from("material_price_history")
      .select("material_id, quantity, unit")
      .eq("organization_id", user.organizationId)
      .eq("project_id", projectId),
  ]);

  if (plannedError) throw new Error(`Gagal memuat rencana material: ${plannedError.message}`);
  if (movementsError) throw new Error(`Gagal memuat mutasi stok: ${movementsError.message}`);
  if (purchasesError) throw new Error(`Gagal memuat riwayat pembelian: ${purchasesError.message}`);
  const plannedMap = new Map((planned || []).map((p) => [p.material_id, p]));

  const materialById = new Map(materials.map((material) => [material.id, material]));
  const toUsageQuantity = (materialId: string, quantity: number, unit: string) => {
    const material = materialById.get(materialId);
    if (!material) throw new Error("Riwayat material tidak sesuai dengan master material organisasi ini.");
    try {
      return convertMaterialQuantityToUsageUnit(quantity, unit, {
        purchaseUnit: material.purchase_unit,
        usageUnit: material.usage_unit,
        conversionFactor: Number(material.conversion_factor),
      });
    } catch (error) {
      throw new Error(`Material '${material.name}': ${error instanceof Error ? error.message : "konversi satuan gagal."}`);
    }
  };

  const purchasedMap = new Map<string, number>();
  (purchases || []).forEach((p) => {
    const quantity = toUsageQuantity(p.material_id, Number(p.quantity || 0), p.unit);
    purchasedMap.set(p.material_id, (purchasedMap.get(p.material_id) || 0) + quantity);
  });

  const movementsMap = new Map<string, Record<string, number>>();
  const verifiedUsedMap = new Map<string, number>();
  (movements || []).forEach((m) => {
    const cur = movementsMap.get(m.material_id) || {
      RECEIPT: 0,
      ISSUED_TO_FIELD: 0,
      USED: 0,
      RETURN: 0,
      TRANSFER: 0,
      DAMAGED_WASTE: 0,
      ADJUSTMENT: 0,
    };
    cur[m.movement_type] = (cur[m.movement_type] || 0) +
      toUsageQuantity(m.material_id, Number(m.quantity || 0), m.unit);
    movementsMap.set(m.material_id, cur);
    if (m.movement_type === "USED" && m.verified_by) {
      verifiedUsedMap.set(
        m.material_id,
        (verifiedUsedMap.get(m.material_id) || 0) +
          toUsageQuantity(m.material_id, Number(m.quantity || 0), m.unit),
      );
    }
  });

  return materials.map((mat) => {
    const plan = plannedMap.get(mat.id);
    const mov = movementsMap.get(mat.id) || {
      RECEIPT: 0,
      ISSUED_TO_FIELD: 0,
      USED: 0,
      RETURN: 0,
      TRANSFER: 0,
      DAMAGED_WASTE: 0,
      ADJUSTMENT: 0,
    };

    const planUnit = plan?.unit?.trim().toLowerCase();
    const usageUnit = mat.usage_unit.trim().toLowerCase();
    const purchaseUnit = mat.purchase_unit.trim().toLowerCase();
    const isLegacyPurchasePlan = Boolean(plan && planUnit !== usageUnit);
    if (isLegacyPurchasePlan && planUnit !== purchaseUnit && planUnit !== "unit") {
      throw new Error(`Satuan rencana '${plan?.unit}' untuk material '${mat.name}' tidak dapat dikonversi.`);
    }
    const factor = Number(mat.conversion_factor || 1);
    const plannedQty = Number(plan?.planned_quantity || 0) * (isLegacyPurchasePlan ? factor : 1);
    const budgetUnitPrice = plan
      ? Number(plan.budget_unit_price || 0) / (isLegacyPurchasePlan ? factor : 1)
      : Number(mat.standard_price || 0) / factor;
    const totalBudget = plannedQty * budgetUnitPrice;
    const wasteTolerance = Number(plan?.waste_tolerance_percent ?? mat.waste_tolerance_percent ?? 5);

    const purchasedQty = purchasedMap.get(mat.id) || mov.RECEIPT;
    const receivedQty = mov.RECEIPT;
    const issuedQty = mov.ISSUED_TO_FIELD;
    const usedQty = mov.USED;
    const returnedQty = mov.RETURN;
    const damagedQty = mov.DAMAGED_WASTE;

    // Remaining Stock in Warehouse/Site:
    // Received - Issued - Returned - Damaged + Adjustments
    const currentStock = receivedQty - issuedQty - returnedQty - damagedQty + mov.ADJUSTMENT;

    const verifiedInstalled = verifiedUsedMap.get(mat.id) || 0;

    // Actual waste calculation
    const totalInput = usedQty + damagedQty;
    const actualWastePercent = totalInput > 0 ? (damagedQty / totalInput) * 100 : 0;

    let status: ProjectMaterialRecapRow["status"] = "NORMAL";
    if (damagedQty > 0 && actualWastePercent > wasteTolerance * 1.5) {
      status = "INVESTIGASI_DIPERLUKAN";
    } else if (actualWastePercent > wasteTolerance) {
      status = "DI_ATAS_TOLERANSI";
    } else if (purchasedQty > plannedQty * 1.15 && plannedQty > 0) {
      status = "PERLU_VERIFIKASI";
    }

    return {
      material_id: mat.id,
      code: mat.code,
      name: mat.name,
      category: mat.category,
      unit: mat.usage_unit,
      usage_unit: mat.usage_unit,
      conversion_factor: Number(mat.conversion_factor),
      waste_tolerance_percent: wasteTolerance,
      planned_quantity: plannedQty,
      budget_unit_price: budgetUnitPrice,
      total_budget: totalBudget,
      purchased_quantity: purchasedQty,
      received_quantity: receivedQty,
      issued_quantity: issuedQty,
      used_quantity: usedQty,
      returned_quantity: returnedQty,
      damaged_quantity: damagedQty,
      current_stock: currentStock,
      verified_installed_volume: verifiedInstalled,
      actual_waste_percent: Math.round(actualWastePercent * 10) / 10,
      status,
    };
  });
}

export async function setProjectMaterialPlan(input: {
  project_id: string;
  material_id: string;
  planned_quantity: number;
  budget_unit_price: number;
  waste_tolerance_percent?: number;
  notes?: string;
}) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MASTER_EDITOR_ROLES, "Anda tidak memiliki izin untuk mengubah rencana material proyek.");
  const supabase = await createClient();

  if (
    !Number.isFinite(input.planned_quantity) ||
    input.planned_quantity < 0 ||
    !Number.isFinite(input.budget_unit_price) ||
    input.budget_unit_price < 0 ||
    (input.waste_tolerance_percent !== undefined &&
      (!Number.isFinite(input.waste_tolerance_percent) || input.waste_tolerance_percent < 0))
  ) {
    throw new Error("Kuantitas, harga, dan toleransi waste rencana material harus bernilai valid dan tidak negatif.");
  }

  const [{ data: project, error: projectError }, { data: material, error: materialError }] = await Promise.all([
    supabase
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
    supabase
      .from("master_materials")
      .select("id, usage_unit")
      .eq("id", input.material_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
  ]);
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (materialError) throw new Error(`Gagal memvalidasi material: ${materialError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");
  if (!material) throw new Error("Material tidak ditemukan di organisasi ini.");

  const totalBudget = input.planned_quantity * input.budget_unit_price;

  const { data, error } = await supabase
    .from("project_materials")
    .upsert(
      {
        organization_id: user.organizationId,
        project_id: input.project_id,
        material_id: input.material_id,
        planned_quantity: input.planned_quantity,
        unit: material.usage_unit,
        budget_unit_price: input.budget_unit_price,
        total_budget: totalBudget,
        waste_tolerance_percent: input.waste_tolerance_percent ?? 5.0,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id, material_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Gagal menyimpan target kebutuhan material: ${error.message}`);

  revalidatePath("/cost-control/material-recap");
  return data;
}

export async function recordMaterialMovement(input: {
  project_id: string;
  material_id: string;
  movement_type: "RECEIPT" | "ISSUED_TO_FIELD" | "USED" | "RETURN" | "TRANSFER" | "DAMAGED_WASTE" | "ADJUSTMENT";
  date?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  vendor_id?: string;
  target_project_id?: string;
  reference_document?: string;
  notes?: string;
}) {
  const user = await requireAuthUser();
  assertRole(user.role, MATERIAL_MOVEMENT_ROLES, "Anda tidak memiliki izin untuk mencatat mutasi material.");
  if (input.movement_type === "USED") {
    assertRole(user.role, MATERIAL_MASTER_EDITOR_ROLES, "Hanya Owner, Finance, atau Project Manager yang dapat memverifikasi pemakaian material.");
  }
  const supabase = await createClient();

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Kuantitas mutasi harus lebih besar dari 0.");
  }

  const [{ data: project, error: projectError }, { data: material, error: materialError }] = await Promise.all([
    supabase
      .from("projects")
      .select("id")
      .eq("id", input.project_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
    supabase
      .from("master_materials")
      .select("id, usage_unit")
      .eq("id", input.material_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
  ]);
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (materialError) throw new Error(`Gagal memvalidasi material: ${materialError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");
  if (!material) throw new Error("Material tidak ditemukan di organisasi ini.");
  if (input.unit.trim().toLowerCase() !== material.usage_unit.trim().toLowerCase()) {
    throw new Error(`Mutasi stok harus menggunakan satuan pemakaian '${material.usage_unit}'.`);
  }

  if (input.target_project_id) {
    const { data: targetProject, error: targetProjectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.target_project_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle();
    if (targetProjectError) throw new Error(`Gagal memvalidasi proyek tujuan: ${targetProjectError.message}`);
    if (!targetProject) throw new Error("Proyek tujuan tidak ditemukan di organisasi ini.");
  }

  const unitPrice = input.unit_price ?? 0;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("Harga satuan mutasi harus bernilai valid dan tidak negatif.");
  }

  if (input.vendor_id) {
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", input.vendor_id)
      .eq("organization_id", user.organizationId)
      .maybeSingle();
    if (vendorError) throw new Error(`Gagal memvalidasi vendor: ${vendorError.message}`);
    if (!vendor) throw new Error("Vendor tidak ditemukan di organisasi ini.");
  }

  const totalCost = input.quantity * unitPrice;

  const { data, error } = await supabase
    .from("material_stock_movements")
    .insert({
      organization_id: user.organizationId,
      project_id: input.project_id,
      material_id: input.material_id,
      movement_type: input.movement_type,
      date: input.date || new Date().toISOString(),
      quantity: input.quantity,
      unit: input.unit,
      unit_price: unitPrice,
      total_cost: totalCost,
      vendor_id: input.vendor_id || null,
      target_project_id: input.target_project_id || null,
      reference_document: input.reference_document || null,
      verified_by: input.movement_type === "USED" ? (user.profileId || user.id) : null,
      notes: input.notes || null,
      created_by: user.profileId || user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal mencatat mutasi stok: ${error.message}`);

  await logAudit(user, {
    action: `RECORD_STOCK_${input.movement_type}`,
    entityType: "material_stock_movements",
    entityId: data.id,
    metadata: {
      project_id: input.project_id,
      material_id: input.material_id,
      quantity: input.quantity,
      movement_type: input.movement_type,
    },
  });

  revalidatePath("/cost-control/material-recap");
  return data;
}
