"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";
import { calculateRab } from "@/lib/cost-control/rabCalculations";

const RAB_EDIT_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];

function assertCanEditRab(role: string) {
  if (!RAB_EDIT_ROLES.includes(role)) {
    throw new Error("Hanya Owner, Finance, atau Project Manager yang dapat mengubah RAB.");
  }
}

export interface MasterAhspItem {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  overhead_percent: number;
  notes?: string | null;
  components: Array<{
    id: string;
    component_type: "MATERIAL" | "LABOR" | "EQUIPMENT";
    name: string;
    coefficient: number;
    unit: string;
    unit_price: number;
    subtotal: number;
  }>;
}

export interface RabProjectItem {
  id: string;
  organization_id: string;
  project_id: string;
  rab_number: string;
  title: string;
  client_name?: string | null;
  project_location?: string | null;
  date: string;
  version: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REVISED" | "REJECTED";
  is_locked: boolean;
  profit_type: "MARKUP" | "GROSS_MARGIN";
  profit_percentage: number;
  overhead_percentage: number;
  contingency_percentage: number;
  tax_percentage: number;
  total_material_hpp: number;
  total_labor_hpp: number;
  total_equipment_hpp: number;
  total_hpp: number;
  overhead_amount: number;
  contingency_amount: number;
  profit_amount: number;
  subtotal_before_tax: number;
  tax_amount: number;
  grand_total: number;
  notes?: string | null;
  created_at: string;
  project?: { id: string; name: string; code: string; client?: { name: string } };
  items?: RabWorkItem[];
}

export type CreateRabProjectResult =
  | { success: true; rab: RabProjectItem }
  | { success: false; message: string; diagnostic: string };

class RabCreationError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export interface RabWorkItem {
  id: string;
  rab_id: string;
  division: string;
  sub_division?: string | null;
  item_code?: string | null;
  item_name: string;
  unit: string;
  volume: number;
  material_unit_cost: number;
  labor_unit_cost: number;
  equipment_unit_cost: number;
  unit_hpp: number;
  total_hpp: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  components?: Array<{
    id: string;
    component_type: "MATERIAL" | "LABOR" | "EQUIPMENT";
    name: string;
    coefficient: number;
    unit: string;
    unit_price: number;
    subtotal: number;
  }>;
}

async function ensureRabEditable(rabId: string, organizationId: string) {
  const supabase = await createClient();
  const { data: rab, error } = await supabase
    .from("rab_projects")
    .select("id, status, is_locked")
    .eq("id", rabId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memvalidasi RAB: ${error.message}`);
  if (!rab) throw new Error("RAB tidak ditemukan.");
  if (rab.is_locked || rab.status === "APPROVED") {
    throw new Error("RAB yang telah disetujui dan dikunci tidak dapat diubah.");
  }
}

// ----------------------------------------------------
// 1. MASTER ANALISIS HARGA SATUAN PEKERJAAN (AHSP)
// ----------------------------------------------------

export async function getMasterAhspList(): Promise<MasterAhspItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: ahspList, error } = await supabase
    .from("master_ahsp")
    .select(`
      *,
      components:master_ahsp_components(*)
    `)
    .eq("organization_id", user.organizationId)
    .order("code", { ascending: true });

  if (error) throw new Error(`Gagal memuat master AHSP: ${error.message}`);

  if (!ahspList || ahspList.length === 0) return [];

  return (ahspList || []).map((row: any) => ({
    ...row,
    overhead_percent: Number(row.overhead_percent || 0),
    components: (row.components || []).map((c: any) => ({
      ...c,
      coefficient: Number(c.coefficient),
      unit_price: Number(c.unit_price),
      subtotal: Number(c.subtotal),
    })),
  }));
}

// ----------------------------------------------------
// 2. RAB PROJECTS & ITEMS
// ----------------------------------------------------

export async function getRabProjects(projectId?: string): Promise<RabProjectItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("rab_projects")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (projectId && projectId !== "ALL") {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat daftar RAB: ${error.message}`);

  const projectIds = Array.from(new Set((data || []).map((rab) => rab.project_id)));
  const { data: projects, error: projectsError } = projectIds.length
    ? await supabase
      .from("projects")
      .select("id, name, code")
      .eq("organization_id", user.organizationId)
      .in("id", projectIds)
    : { data: [], error: null };
  if (projectsError) throw new Error(`Gagal memuat proyek untuk RAB: ${projectsError.message}`);
  const projectById = new Map((projects || []).map((project) => [project.id, project]));

  return (data || []).map((r: any) => ({
    ...r,
    project: projectById.get(r.project_id),
    profit_percentage: Number(r.profit_percentage),
    overhead_percentage: Number(r.overhead_percentage),
    contingency_percentage: Number(r.contingency_percentage),
    tax_percentage: Number(r.tax_percentage),
    total_material_hpp: Number(r.total_material_hpp),
    total_labor_hpp: Number(r.total_labor_hpp),
    total_equipment_hpp: Number(r.total_equipment_hpp),
    total_hpp: Number(r.total_hpp),
    overhead_amount: Number(r.overhead_amount),
    contingency_amount: Number(r.contingency_amount),
    profit_amount: Number(r.profit_amount),
    subtotal_before_tax: Number(r.subtotal_before_tax),
    tax_amount: Number(r.tax_amount),
    grand_total: Number(r.grand_total),
  }));
}

export async function getRabProjectDetail(rabId: string): Promise<RabProjectItem> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: rab, error } = await supabase
    .from("rab_projects")
    .select(`
      *,
      items:rab_items(
        *,
        components:rab_item_components(*)
      )
    `)
    .eq("id", rabId)
    .eq("organization_id", user.organizationId)
    .single();

  if (error || !rab) throw new Error(`RAB tidak ditemukan: ${error?.message}`);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, code, location")
    .eq("id", rab.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memuat proyek RAB: ${projectError.message}`);
  if (!project) throw new Error("Proyek RAB tidak ditemukan di organisasi ini.");

  const formattedItems: RabWorkItem[] = (rab.items || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((item: any) => ({
      ...item,
      volume: Number(item.volume),
      material_unit_cost: Number(item.material_unit_cost),
      labor_unit_cost: Number(item.labor_unit_cost),
      equipment_unit_cost: Number(item.equipment_unit_cost),
      unit_hpp: Number(item.unit_hpp),
      total_hpp: Number(item.total_hpp),
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      components: (item.components || []).map((c: any) => ({
        ...c,
        coefficient: Number(c.coefficient),
        unit_price: Number(c.unit_price),
        subtotal: Number(c.subtotal),
      })),
    }));

  return {
    ...rab,
    project,
    profit_percentage: Number(rab.profit_percentage),
    overhead_percentage: Number(rab.overhead_percentage),
    contingency_percentage: Number(rab.contingency_percentage),
    tax_percentage: Number(rab.tax_percentage),
    total_material_hpp: Number(rab.total_material_hpp),
    total_labor_hpp: Number(rab.total_labor_hpp),
    total_equipment_hpp: Number(rab.total_equipment_hpp),
    total_hpp: Number(rab.total_hpp),
    overhead_amount: Number(rab.overhead_amount),
    contingency_amount: Number(rab.contingency_amount),
    profit_amount: Number(rab.profit_amount),
    subtotal_before_tax: Number(rab.subtotal_before_tax),
    tax_amount: Number(rab.tax_amount),
    grand_total: Number(rab.grand_total),
    items: formattedItems,
  };
}

async function createRabProjectRecord(input: {
  project_id: string;
  title: string;
  client_name?: string;
  project_location?: string;
  date?: string;
  profit_type?: "MARKUP" | "GROSS_MARGIN";
  profit_percentage?: number;
  overhead_percentage?: number;
  contingency_percentage?: number;
  tax_percentage?: number;
  notes?: string;
}, context: { stage: string }) {
  context.stage = "autentikasi";
  const user = await requireAuthUser();
  context.stage = "otorisasi";
  assertCanEditRab(user.role);
  const supabase = await createClient();
  context.stage = "validasi-parameter";
  const profitType = input.profit_type ?? "MARKUP";
  const profitPercentage = input.profit_percentage ?? 20;
  const overheadPercentage = input.overhead_percentage ?? 5;
  const contingencyPercentage = input.contingency_percentage ?? 0;
  const taxPercentage = input.tax_percentage ?? 0;
  calculateRab({
    items: [],
    profitType,
    profitPercentage,
    overheadPercentage,
    contingencyPercentage,
    taxPercentage,
  });

  context.stage = "validasi-proyek";
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectErr) {
    throw new RabCreationError(`Gagal memvalidasi proyek RAB: ${projectErr.message}`, projectErr.code);
  }
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");

  const now = new Date();
  const rabNumber = `RAB-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  let data: RabProjectItem | null = null;
  let createError: RabCreationError | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    context.stage = "tentukan-versi";
    const { data: latest, error: versionError } = await supabase
      .from("rab_projects")
      .select("version")
      .eq("organization_id", user.organizationId)
      .eq("project_id", input.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) {
      throw new RabCreationError(
        `Gagal menentukan versi RAB berikutnya: ${versionError.message}`,
        versionError.code,
      );
    }

    context.stage = "simpan-rab";
    const { data: created, error } = await supabase
      .from("rab_projects")
      .insert({
        organization_id: user.organizationId,
        project_id: input.project_id,
        rab_number: rabNumber,
        title: input.title.trim(),
        client_name: input.client_name || null,
        project_location: input.project_location || null,
        date: input.date || now.toISOString(),
        version: (latest?.version ?? 0) + 1,
        status: "DRAFT",
        is_locked: false,
        profit_type: profitType,
        profit_percentage: profitPercentage,
        overhead_percentage: overheadPercentage,
        contingency_percentage: contingencyPercentage,
        tax_percentage: taxPercentage,
        notes: input.notes || null,
        created_by: user.profileId || user.id,
      })
      .select()
      .single();

    if (!error) {
      data = created;
      break;
    }
    createError = new RabCreationError(error.message, error.code);
    if (error.code !== "23505") break;
  }

  if (createError) {
    throw new RabCreationError(`Gagal membuat RAB: ${createError.message}`, createError.code);
  }
  if (!data) throw new Error("Gagal membuat RAB: server tidak mengembalikan dokumen.");

  context.stage = "catat-audit";
  await logAudit(user, {
    action: "CREATE_RAB_PROJECT",
    entityType: "rab_projects",
    entityId: data.id,
    metadata: { rab_number: rabNumber, title: input.title },
  });

  context.stage = "perbarui-cache";
  revalidatePath("/cost-control/rab");
  return data;
}

function getRabCreationErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function getRabCreationErrorMessage(error: unknown): string {
  const code = getRabCreationErrorCode(error);

  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
    return "Database RAB belum siap. Admin perlu menjalankan migrasi cost-control RAB/RAP di Supabase.";
  }
  if (code === "42501") {
    return "Tidak memiliki izin untuk membuat RAB. Periksa role akun dan kebijakan akses RAB di Supabase.";
  }
  if (code === "23503") {
    return "Data proyek atau profil pembuat RAB tidak valid. Periksa kembali data proyek dan keanggotaan organisasi.";
  }
  if (error instanceof Error && error.message.startsWith("Hanya Owner, Finance")) {
    return error.message;
  }
  if (error instanceof Error && error.message.startsWith("Persentase ")) {
    return error.message;
  }
  if (error instanceof Error && error.message === "Proyek tidak ditemukan di organisasi ini.") {
    return error.message;
  }

  return "RAB belum dapat dibuat. Detail teknis telah dicatat di log server; hubungi admin jika masalah berlanjut.";
}

export async function createRabProject(input: {
  project_id: string;
  title: string;
  client_name?: string;
  project_location?: string;
  date?: string;
  profit_type?: "MARKUP" | "GROSS_MARGIN";
  profit_percentage?: number;
  overhead_percentage?: number;
  contingency_percentage?: number;
  tax_percentage?: number;
  notes?: string;
}): Promise<CreateRabProjectResult> {
  const context = { stage: "mulai" };
  try {
    const rab = await createRabProjectRecord(input, context);
    return { success: true, rab };
  } catch (error) {
    const diagnostic = `rab-create:${context.stage}:${getRabCreationErrorCode(error) ?? (error instanceof Error ? error.name : "unknown")}`;
    console.error(`[${diagnostic}] Gagal membuat RAB:`, error);
    return { success: false, message: getRabCreationErrorMessage(error), diagnostic };
  }
}

export async function addAhspItemToRab(input: {
  rab_id: string;
  ahsp_id: string;
  division: string;
  sub_division?: string;
  volume: number;
}) {
  const user = await requireAuthUser();
  assertCanEditRab(user.role);
  const supabase = await createClient();
  if (!Number.isFinite(input.volume) || input.volume <= 0) {
    throw new Error("Volume item RAB harus berupa angka lebih besar dari 0.");
  }
  await ensureRabEditable(input.rab_id, user.organizationId);

  // Load AHSP and components
  const { data: ahsp, error: ahspErr } = await supabase
    .from("master_ahsp")
    .select(`
      *,
      components:master_ahsp_components(*)
    `)
    .eq("id", input.ahsp_id)
    .eq("organization_id", user.organizationId)
    .single();

  if (ahspErr) throw new Error(`Gagal memuat item master AHSP: ${ahspErr.message}`);
  if (!ahsp) throw new Error("Item master AHSP tidak ditemukan di organisasi ini.");

  let matCost = 0;
  let labCost = 0;
  let eqCost = 0;

  const comps = (ahsp.components || []).map((c: any) => {
    const coef = Number(c.coefficient);
    const price = Number(c.unit_price);
    const sub = coef * price;
    if (c.component_type === "MATERIAL") matCost += sub;
    else if (c.component_type === "LABOR") labCost += sub;
    else eqCost += sub;

    return {
      component_type: c.component_type,
      name: c.name,
      coefficient: coef,
      unit: c.unit,
      unit_price: price,
      subtotal: sub,
    };
  });

  const unitHpp = matCost + labCost + eqCost;
  const totalHpp = input.volume * unitHpp;

  // Insert rab_item
  const { data: rabItem, error: itemErr } = await supabase
    .from("rab_items")
    .insert({
      organization_id: user.organizationId,
      rab_id: input.rab_id,
      division: input.division,
      sub_division: input.sub_division || null,
      item_code: ahsp.code,
      item_name: ahsp.name,
      unit: ahsp.unit,
      volume: input.volume,
      material_unit_cost: matCost,
      labor_unit_cost: labCost,
      equipment_unit_cost: eqCost,
      unit_hpp: unitHpp,
      total_hpp: totalHpp,
      unit_price: unitHpp * 1.25, // initial markup preview
      total_price: totalHpp * 1.25,
      sort_order: 10,
    })
    .select("id")
    .single();

  if (itemErr) throw new Error(`Gagal menambahkan item ke RAB: ${itemErr.message}`);

  // Insert components
  if (comps.length > 0) {
    const itemComps = comps.map((c: any) => ({
      rab_item_id: rabItem.id,
      ...c,
    }));
    await supabase.from("rab_item_components").insert(itemComps);
  }

  // Recalculate RAB totals
  await recalculateRab(input.rab_id);

  revalidatePath(`/cost-control/rab/${input.rab_id}`);
  return rabItem;
}

export async function addCustomRabItem(input: {
  rab_id: string;
  division: string;
  sub_division?: string;
  item_code?: string;
  item_name: string;
  unit: string;
  volume: number;
  material_unit_cost?: number;
  labor_unit_cost?: number;
  equipment_unit_cost?: number;
}) {
  const user = await requireAuthUser();
  assertCanEditRab(user.role);
  const supabase = await createClient();
  await ensureRabEditable(input.rab_id, user.organizationId);
  if (!Number.isFinite(input.volume) || input.volume <= 0) {
    throw new Error("Volume item RAB harus berupa angka lebih besar dari 0.");
  }

  const mat = Number(input.material_unit_cost || 0);
  const lab = Number(input.labor_unit_cost || 0);
  const eq = Number(input.equipment_unit_cost || 0);
  if (![mat, lab, eq].every((cost) => Number.isFinite(cost) && cost >= 0)) {
    throw new Error("HPP material, upah, dan peralatan harus berupa angka valid dan tidak negatif.");
  }
  const unitHpp = mat + lab + eq;
  const totalHpp = input.volume * unitHpp;

  const { data: rabItem, error } = await supabase
    .from("rab_items")
    .insert({
      organization_id: user.organizationId,
      rab_id: input.rab_id,
      division: input.division.trim(),
      sub_division: input.sub_division?.trim() || null,
      item_code: input.item_code?.trim() || null,
      item_name: input.item_name.trim(),
      unit: input.unit.trim(),
      volume: input.volume,
      material_unit_cost: mat,
      labor_unit_cost: lab,
      equipment_unit_cost: eq,
      unit_hpp: unitHpp,
      total_hpp: totalHpp,
      unit_price: unitHpp * 1.25,
      total_price: totalHpp * 1.25,
      sort_order: 20,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menambahkan item kustom: ${error.message}`);

  await recalculateRab(input.rab_id);
  revalidatePath(`/cost-control/rab/${input.rab_id}`);
  return rabItem;
}

export async function deleteRabItem(itemId: string, rabId: string) {
  const user = await requireAuthUser();
  assertCanEditRab(user.role);
  const supabase = await createClient();
  await ensureRabEditable(rabId, user.organizationId);

  const { error } = await supabase
    .from("rab_items")
    .delete()
    .eq("id", itemId)
    .eq("rab_id", rabId)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus item RAB: ${error.message}`);

  await recalculateRab(rabId);
  revalidatePath(`/cost-control/rab/${rabId}`);
  return { success: true };
}

export async function recalculateRab(
  rabId: string,
  settings?: {
    profit_type?: "MARKUP" | "GROSS_MARGIN";
    profit_percentage?: number;
    overhead_percentage?: number;
    contingency_percentage?: number;
    tax_percentage?: number;
  }
) {
  const user = await requireAuthUser();
  assertCanEditRab(user.role);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recalculate_rab_project", {
    p_rab_id: rabId,
    p_profit_type: settings?.profit_type ?? null,
    p_profit_percentage: settings?.profit_percentage ?? null,
    p_overhead_percentage: settings?.overhead_percentage ?? null,
    p_contingency_percentage: settings?.contingency_percentage ?? null,
    p_tax_percentage: settings?.tax_percentage ?? null,
  });
  if (error) throw new Error(`Gagal menghitung ulang RAB: ${error.message}`);

  const updatedRab = data as RabProjectItem | null;
  if (!updatedRab?.id) throw new Error("Perhitungan RAB tidak menghasilkan dokumen.");

  revalidatePath(`/cost-control/rab/${rabId}`);
  revalidatePath("/cost-control/rab");
  return updatedRab;
}

export async function approveRabProject(rabId: string) {
  const user = await requireAuthUser();
  if (!["OWNER", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Hanya Owner atau Project Manager yang berwenang menyetujui RAB.");
  }
  const supabase = await createClient();
  const { count, error: itemsError } = await supabase
    .from("rab_items")
    .select("id", { count: "exact", head: true })
    .eq("rab_id", rabId)
    .eq("organization_id", user.organizationId);
  if (itemsError) throw new Error(`Gagal memvalidasi item RAB: ${itemsError.message}`);
  if (!count) throw new Error("RAB harus memiliki minimal satu item sebelum disetujui.");

  const { data, error } = await supabase
    .from("rab_projects")
    .update({
      status: "APPROVED",
      is_locked: true,
      approved_by: user.profileId || user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rabId)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) throw new Error(`Gagal menyetujui RAB: ${error.message}`);

  await logAudit(user, {
    action: "APPROVE_RAB_PROJECT",
    entityType: "rab_projects",
    entityId: rabId,
  });

  revalidatePath(`/cost-control/rab/${rabId}`);
  revalidatePath("/cost-control/rab");
  return data;
}

export async function createNewRabVersion(rabId: string) {
  const user = await requireAuthUser();
  assertCanEditRab(user.role);
  const supabase = await createClient();

  const sourceRab = await getRabProjectDetail(rabId);

  const nextVersion = (sourceRab.version || 1) + 1;
  const newRabNumber = `${sourceRab.rab_number}-V${nextVersion}`;

  // Insert new version header
  const { data: newRab, error: insertErr } = await supabase
    .from("rab_projects")
    .insert({
      organization_id: user.organizationId,
      project_id: sourceRab.project_id,
      rab_number: newRabNumber,
      title: `${sourceRab.title} (Revisi V${nextVersion})`,
      client_name: sourceRab.client_name,
      project_location: sourceRab.project_location,
      date: new Date().toISOString(),
      version: nextVersion,
      status: "DRAFT",
      is_locked: false,
      profit_type: sourceRab.profit_type,
      profit_percentage: sourceRab.profit_percentage,
      overhead_percentage: sourceRab.overhead_percentage,
      contingency_percentage: sourceRab.contingency_percentage,
      tax_percentage: sourceRab.tax_percentage,
      notes: `Dibuat dari versi ${sourceRab.version}`,
      created_by: user.profileId || user.id,
    })
    .select()
    .single();

  if (insertErr) throw new Error(`Gagal membuat revisi RAB: ${insertErr.message}`);

  // Clone items and components
  for (const item of sourceRab.items || []) {
    const { data: newItem } = await supabase
      .from("rab_items")
      .insert({
        organization_id: user.organizationId,
        rab_id: newRab.id,
        division: item.division,
        sub_division: item.sub_division,
        item_code: item.item_code,
        item_name: item.item_name,
        unit: item.unit,
        volume: item.volume,
        material_unit_cost: item.material_unit_cost,
        labor_unit_cost: item.labor_unit_cost,
        equipment_unit_cost: item.equipment_unit_cost,
        unit_hpp: item.unit_hpp,
        total_hpp: item.total_hpp,
        unit_price: item.unit_price,
        total_price: item.total_price,
        sort_order: item.sort_order,
      })
      .select("id")
      .single();

    if (newItem && item.components && item.components.length > 0) {
      const clonedComps = item.components.map((c) => ({
        rab_item_id: newItem.id,
        component_type: c.component_type,
        name: c.name,
        coefficient: c.coefficient,
        unit: c.unit,
        unit_price: c.unit_price,
        subtotal: c.subtotal,
      }));
      await supabase.from("rab_item_components").insert(clonedComps);
    }
  }

  await recalculateRab(newRab.id);

  revalidatePath("/cost-control/rab");
  return newRab;
}
