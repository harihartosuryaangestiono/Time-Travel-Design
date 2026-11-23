"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";

const AHSP_EDITOR_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];

function assertAhspEditor(role: string) {
  if (!AHSP_EDITOR_ROLES.includes(role)) {
    throw new Error("Hanya Owner, Finance, atau Project Manager yang dapat mengelola Master AHSP.");
  }
}

export interface AhspComponentInput {
  id?: string;
  component_type: "MATERIAL" | "LABOR" | "EQUIPMENT";
  material_id?: string | null;
  labor_rate_id?: string | null;
  name: string;
  coefficient: number;
  unit: string;
  unit_price: number;
  subtotal?: number;
}

export interface MasterAhspComponentItem {
  id: string;
  ahsp_id: string;
  component_type: "MATERIAL" | "LABOR" | "EQUIPMENT";
  material_id?: string | null;
  labor_rate_id?: string | null;
  name: string;
  coefficient: number;
  unit: string;
  unit_price: number;
  subtotal: number;
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
  created_at: string;
  updated_at: string;
  components: MasterAhspComponentItem[];
  total_material_cost: number;
  total_labor_cost: number;
  total_equipment_cost: number;
  total_modal_hpp: number;
  indicative_rab_price: number; // calculated with 10% standard profit / overhead
}

// ----------------------------------------------------
// 1. GET AHSP LIST & DETAIL
// ----------------------------------------------------

export async function getMasterAhspList(filters?: { category?: string; search?: string }): Promise<MasterAhspItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("master_ahsp")
    .select(`
      *,
      components:master_ahsp_components(*)
    `)
    .eq("organization_id", user.organizationId)
    .order("code", { ascending: true });

  if (filters?.category && filters.category !== "ALL") {
    query = query.eq("category", filters.category);
  }

  if (filters?.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term},category.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat katalog Master AHSP: ${error.message}`);

  return (data || []).map((row: any) => {
    let matCost = 0;
    let labCost = 0;
    let eqCost = 0;

    const comps: MasterAhspComponentItem[] = (row.components || []).map((c: any) => {
      const coeff = Number(c.coefficient || 0);
      const up = Number(c.unit_price || 0);
      const sub = Number(c.subtotal ?? coeff * up);

      if (c.component_type === "MATERIAL") matCost += sub;
      else if (c.component_type === "LABOR") labCost += sub;
      else eqCost += sub;

      return {
        id: c.id,
        ahsp_id: c.ahsp_id,
        component_type: c.component_type,
        material_id: c.material_id,
        labor_rate_id: c.labor_rate_id,
        name: c.name,
        coefficient: coeff,
        unit: c.unit,
        unit_price: up,
        subtotal: sub,
      };
    });

    const totalModal = matCost + labCost + eqCost;
    const overhead = Number(row.overhead_percent || 0);
    // Standard 10% RAB margin if overhead is 0
    const marginRate = overhead > 0 ? overhead / 100 : 0.10;
    const rabPrice = Math.round(totalModal * (1 + marginRate));

    return {
      id: row.id,
      organization_id: row.organization_id,
      code: row.code,
      name: row.name,
      category: row.category,
      unit: row.unit,
      overhead_percent: overhead,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      components: comps,
      total_material_cost: matCost,
      total_labor_cost: labCost,
      total_equipment_cost: eqCost,
      total_modal_hpp: totalModal,
      indicative_rab_price: rabPrice,
    };
  });
}

export async function getMasterAhspDetail(id: string): Promise<MasterAhspItem> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("master_ahsp")
    .select(`
      *,
      components:master_ahsp_components(*)
    `)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .single();

  if (error || !data) throw new Error(`Item AHSP tidak ditemukan: ${error?.message}`);

  let matCost = 0;
  let labCost = 0;
  let eqCost = 0;

  const comps: MasterAhspComponentItem[] = (data.components || []).map((c: any) => {
    const coeff = Number(c.coefficient || 0);
    const up = Number(c.unit_price || 0);
    const sub = Number(c.subtotal ?? coeff * up);

    if (c.component_type === "MATERIAL") matCost += sub;
    else if (c.component_type === "LABOR") labCost += sub;
    else eqCost += sub;

    return {
      id: c.id,
      ahsp_id: c.ahsp_id,
      component_type: c.component_type,
      material_id: c.material_id,
      labor_rate_id: c.labor_rate_id,
      name: c.name,
      coefficient: coeff,
      unit: c.unit,
      unit_price: up,
      subtotal: sub,
    };
  });

  const totalModal = matCost + labCost + eqCost;
  const overhead = Number(data.overhead_percent || 0);
  const marginRate = overhead > 0 ? overhead / 100 : 0.10;
  const rabPrice = Math.round(totalModal * (1 + marginRate));

  return {
    id: data.id,
    organization_id: data.organization_id,
    code: data.code,
    name: data.name,
    category: data.category,
    unit: data.unit,
    overhead_percent: overhead,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    components: comps,
    total_material_cost: matCost,
    total_labor_cost: labCost,
    total_equipment_cost: eqCost,
    total_modal_hpp: totalModal,
    indicative_rab_price: rabPrice,
  };
}

// ----------------------------------------------------
// 2. CREATE AHSP ITEM
// ----------------------------------------------------

export async function createMasterAhsp(input: {
  code?: string;
  name: string;
  category: string;
  unit: string;
  overhead_percent?: number;
  notes?: string;
  components: AhspComponentInput[];
}) {
  const user = await requireAuthUser();
  assertAhspEditor(user.role);
  const supabase = await createClient();

  if (!input.name?.trim()) throw new Error("Nama pekerjaan AHSP wajib diisi.");
  if (!input.category?.trim()) throw new Error("Kategori pekerjaan wajib dipilih.");
  if (!input.unit?.trim()) throw new Error("Satuan pekerjaan (m2, m3, m', pcs, dll) wajib diisi.");

  const code = (input.code?.trim() || `AHSP-${Date.now().toString().slice(-6)}`).toUpperCase();

  const { data: ahsp, error: ahspErr } = await supabase
    .from("master_ahsp")
    .insert({
      organization_id: user.organizationId,
      code,
      name: input.name.trim(),
      category: input.category.trim(),
      unit: input.unit.trim(),
      overhead_percent: input.overhead_percent !== undefined ? Number(input.overhead_percent) : 0,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (ahspErr) throw new Error(`Gagal membuat Master AHSP: ${ahspErr.message}`);

  if (input.components && input.components.length > 0) {
    const compRows = input.components.map((c) => {
      const coeff = Number(c.coefficient || 0);
      const up = Number(c.unit_price || 0);
      return {
        ahsp_id: ahsp.id,
        component_type: c.component_type,
        material_id: c.material_id || null,
        labor_rate_id: c.labor_rate_id || null,
        name: c.name.trim(),
        coefficient: coeff,
        unit: c.unit.trim(),
        unit_price: up,
        subtotal: coeff * up,
      };
    });

    const { error: compErr } = await supabase.from("master_ahsp_components").insert(compRows);
    if (compErr) {
      console.error("Gagal menambahkan komponen AHSP:", compErr);
    }
  }

  await logAudit(user, {
    action: "CREATE_MASTER_AHSP",
    entityType: "master_ahsp",
    entityId: ahsp.id,
    metadata: { code, name: input.name, componentsCount: input.components?.length || 0 },
  });

  revalidatePath("/cost-control/ahsp");
  revalidatePath("/cost-control/rab");
  return ahsp;
}

// ----------------------------------------------------
// 3. UPDATE AHSP ITEM
// ----------------------------------------------------

export async function updateMasterAhsp(
  id: string,
  input: {
    code?: string;
    name?: string;
    category?: string;
    unit?: string;
    overhead_percent?: number;
    notes?: string;
    components?: AhspComponentInput[];
  }
) {
  const user = await requireAuthUser();
  assertAhspEditor(user.role);
  const supabase = await createClient();

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.code) updatePayload.code = input.code.trim().toUpperCase();
  if (input.name) updatePayload.name = input.name.trim();
  if (input.category) updatePayload.category = input.category.trim();
  if (input.unit) updatePayload.unit = input.unit.trim();
  if (input.overhead_percent !== undefined) updatePayload.overhead_percent = Number(input.overhead_percent);
  if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;

  const { data: updated, error: updateErr } = await supabase
    .from("master_ahsp")
    .update(updatePayload)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (updateErr) throw new Error(`Gagal memperbarui Master AHSP: ${updateErr.message}`);

  // Update components if provided
  if (input.components !== undefined) {
    // Delete existing components
    await supabase.from("master_ahsp_components").delete().eq("ahsp_id", id);

    if (input.components.length > 0) {
      const compRows = input.components.map((c) => {
        const coeff = Number(c.coefficient || 0);
        const up = Number(c.unit_price || 0);
        return {
          ahsp_id: id,
          component_type: c.component_type,
          material_id: c.material_id || null,
          labor_rate_id: c.labor_rate_id || null,
          name: c.name.trim(),
          coefficient: coeff,
          unit: c.unit.trim(),
          unit_price: up,
          subtotal: coeff * up,
        };
      });

      const { error: compErr } = await supabase.from("master_ahsp_components").insert(compRows);
      if (compErr) {
        console.error("Gagal memperbarui rincian komponen AHSP:", compErr);
      }
    }
  }

  await logAudit(user, {
    action: "UPDATE_MASTER_AHSP",
    entityType: "master_ahsp",
    entityId: id,
    metadata: { name: updated.name, code: updated.code },
  });

  revalidatePath("/cost-control/ahsp");
  revalidatePath("/cost-control/rab");
  return updated;
}

// ----------------------------------------------------
// 4. DELETE AHSP ITEM
// ----------------------------------------------------

export async function deleteMasterAhsp(id: string) {
  const user = await requireAuthUser();
  assertAhspEditor(user.role);
  const supabase = await createClient();

  const { error } = await supabase
    .from("master_ahsp")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus Master AHSP: ${error.message}`);

  await logAudit(user, {
    action: "DELETE_MASTER_AHSP",
    entityType: "master_ahsp",
    entityId: id,
    metadata: {},
  });

  revalidatePath("/cost-control/ahsp");
  revalidatePath("/cost-control/rab");
  return { success: true };
}

// ----------------------------------------------------
// 5. SEED STANDAR AHSP 2026 (Time Travel Design / PDF 3)
// ----------------------------------------------------

export async function seedStandardAhspCatalog(): Promise<{ count: number }> {
  const user = await requireAuthUser();
  assertAhspEditor(user.role);
  const supabase = await createClient();

  // Template items taken directly from PDF 3 "Panduan Harga RAB & RAP 2026"
  const standardCatalog = [
    // PERSIAPAN DAN BONGKARAN
    {
      code: "AHSP-SB-01",
      name: "Steger dan Catwalk (Kaso)",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "set",
      notes: "Steger kayu kaso 4x6 dengan catwalk paku untuk perancah",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang", coefficient: 1.0, unit: "set", unit_price: 75000 },
        { component_type: "MATERIAL" as const, name: "Kaso 4x6", coefficient: 3.0, unit: "ikat", unit_price: 160000 },
        { component_type: "MATERIAL" as const, name: "Paku 7 cm", coefficient: 2.0, unit: "kg", unit_price: 20000 },
      ],
    },
    {
      code: "AHSP-SB-02",
      name: "Scaffolding dan Catwalk (Sewa)",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "set",
      notes: "Sewa scaffolding besi include catwalk per bulan",
      components: [
        { component_type: "LABOR" as const, name: "Upah Rakit dan Bongkar", coefficient: 1.0, unit: "set", unit_price: 35000 },
        { component_type: "MATERIAL" as const, name: "Scaffolding - 1 Set", coefficient: 1.0, unit: "bln", unit_price: 45000 },
        { component_type: "MATERIAL" as const, name: "Catwalk - 1 Set", coefficient: 1.0, unit: "bln", unit_price: 40000 },
      ],
    },
    {
      code: "AHSP-SB-03",
      name: "Bouwplank",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "set",
      notes: "Pemasangan patok bouwplank kayu & benang as bangunan",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Pasang Bouwplank", coefficient: 1.0, unit: "set", unit_price: 25000 },
        { component_type: "MATERIAL" as const, name: "Kaso 4x6", coefficient: 0.25, unit: "ikat", unit_price: 160000 },
        { component_type: "MATERIAL" as const, name: "Papan Kayu 0.2x3 m", coefficient: 0.40, unit: "lbr", unit_price: 70000 },
        { component_type: "MATERIAL" as const, name: "Paku 7 cm", coefficient: 0.10, unit: "kg", unit_price: 20000 },
      ],
    },
    {
      code: "AHSP-SB-04",
      name: "Pembobokan Dinding Bata Ringan",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "m2",
      notes: "Bobok dinding hebel/bata eksisting",
      components: [
        { component_type: "LABOR" as const, name: "Upah Bobok Dinding", coefficient: 1.0, unit: "m2", unit_price: 65000 },
      ],
    },
    {
      code: "AHSP-SB-05",
      name: "Pembongkaran Plafon Gypsum",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "m2",
      notes: "Bongkar plafon gypsum eksisting dan penurunan rangka",
      components: [
        { component_type: "LABOR" as const, name: "Upah Bongkar Plafon", coefficient: 1.0, unit: "m2", unit_price: 25000 },
      ],
    },
    {
      code: "AHSP-SB-06",
      name: "Pembobokan Pelat Lantai Beton",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "m2",
      notes: "Bobok pelat beton bertulang eksisting dengan jackhammer/manual",
      components: [
        { component_type: "LABOR" as const, name: "Upah Bobok Beton", coefficient: 1.0, unit: "m2", unit_price: 80000 },
      ],
    },
    {
      code: "AHSP-SB-07",
      name: "Pembongkaran Penutup dan Rangka Atap",
      category: "Pekerjaan Persiapan & Bongkaran",
      unit: "m2",
      notes: "Bongkar genteng eksisting dan rangka atap",
      components: [
        { component_type: "LABOR" as const, name: "Upah Bongkar Rangka & Penutup Atap", coefficient: 1.0, unit: "m2", unit_price: 65000 },
      ],
    },

    // STRUKTURAL
    {
      code: "AHSP-STR-01",
      name: "Pelat Lantai Beton Bertulang 10 cm Mutu K-225",
      category: "Pekerjaan Struktur",
      unit: "m2",
      notes: "Pengecoran pelat lantai tebal 10 cm include pembesian & bekisting",
      components: [
        { component_type: "LABOR" as const, name: "Upah Cor, Besi & Bekisting", coefficient: 1.0, unit: "m2", unit_price: 420000 },
      ],
    },

    // ARSITEKTURAL - DINDING & FINISHING (Contoh Dustin)
    {
      code: "AHSP-ARS-01",
      name: "Dinding Bata Ringan (Hebel) Tebal 10 cm",
      category: "Pekerjaan Arsitektur & Dinding",
      unit: "m2",
      notes: "Pasang dinding bata ringan 10 cm dengan mortar instan perekat (Sesuai Contoh Dustin)",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Pasang Bata Ringan", coefficient: 1.0, unit: "m2", unit_price: 55000 },
        { component_type: "MATERIAL" as const, name: "Dinding Bata Ringan 10 cm", coefficient: 0.10, unit: "m3", unit_price: 600000 },
        { component_type: "MATERIAL" as const, name: "Mortar Perekat Bata Ringan", coefficient: 0.10, unit: "sak", unit_price: 75000 },
      ],
    },
    {
      code: "AHSP-ARS-02",
      name: "Dinding Bata Ringan (Hebel) Tebal 7.5 cm",
      category: "Pekerjaan Arsitektur & Dinding",
      unit: "m2",
      notes: "Pasang dinding bata ringan 7.5 cm dengan mortar instan",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Pasang Bata Ringan", coefficient: 1.0, unit: "m2", unit_price: 55000 },
        { component_type: "MATERIAL" as const, name: "Bata Ringan 7.5 cm", coefficient: 9.0, unit: "bh", unit_price: 6500 },
        { component_type: "MATERIAL" as const, name: "Mortar Perekat Hebel", coefficient: 0.10, unit: "sak", unit_price: 135000 },
      ],
    },
    {
      code: "AHSP-ARS-03",
      name: "Plester Dinding Tebal 1.5 cm",
      category: "Pekerjaan Arsitektur & Dinding",
      unit: "m2",
      notes: "Plesteran dinding bata dengan semen dan pasir ayak",
      components: [
        { component_type: "LABOR" as const, name: "Upah Plester Dinding", coefficient: 1.0, unit: "m2", unit_price: 35000 },
        { component_type: "MATERIAL" as const, name: "Semen Portland 40/50kg", coefficient: 0.05, unit: "sak", unit_price: 70000 },
        { component_type: "MATERIAL" as const, name: "Pasir Pasang", coefficient: 0.02, unit: "kol", unit_price: 600000 },
      ],
    },
    {
      code: "AHSP-ARS-04",
      name: "Aci Dinding Halus",
      category: "Pekerjaan Arsitektur & Dinding",
      unit: "m2",
      notes: "Pengacian permukaan dinding plesteran siap cat",
      components: [
        { component_type: "LABOR" as const, name: "Upah Aci Dinding", coefficient: 1.0, unit: "m2", unit_price: 28000 },
        { component_type: "MATERIAL" as const, name: "Semen Portland", coefficient: 0.05, unit: "sak", unit_price: 70000 },
        { component_type: "MATERIAL" as const, name: "Pasir Ayak Halus", coefficient: 0.02, unit: "kol", unit_price: 600000 },
      ],
    },
    {
      code: "AHSP-ARS-05",
      name: "Dinding Batu Alam Andesit 20x30 cm",
      category: "Pekerjaan Arsitektur & Dinding",
      unit: "m2",
      notes: "Pemasangan batu alam andesit pola susun bata",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Batu Alam", coefficient: 1.0, unit: "m2", unit_price: 95000 },
        { component_type: "MATERIAL" as const, name: "Andesit 20 x 30 cm", coefficient: 1.0, unit: "m2", unit_price: 195000 },
        { component_type: "MATERIAL" as const, name: "Semen Pasang", coefficient: 0.20, unit: "sak", unit_price: 70000 },
      ],
    },

    // ARSITEKTURAL - PLAFON
    {
      code: "AHSP-PLF-01",
      name: "Ceiling Gypsum 9mm Inc. Rangka Hollow Galvalum",
      category: "Pekerjaan Plafon & Partisi",
      unit: "m2",
      notes: "Plafon gypsum 9mm rangka hollow 4x4 & 4x2 termasuk kompon",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Plafon & Rangka", coefficient: 1.0, unit: "m2", unit_price: 75000 },
        { component_type: "MATERIAL" as const, name: "Gypsum Yoshino / Jayaboard 9mm", coefficient: 0.50, unit: "lbr", unit_price: 70000 },
        { component_type: "MATERIAL" as const, name: "Hollow Galvalum 4x4", coefficient: 1.0, unit: "btg", unit_price: 35000 },
        { component_type: "MATERIAL" as const, name: "Kompon Gypsum", coefficient: 0.10, unit: "sak", unit_price: 75000 },
      ],
    },
    {
      code: "AHSP-PLF-02",
      name: "Dinding Sekat Gypsum 9mm Rangka CNP 75 (2 sisi)",
      category: "Pekerjaan Plafon & Partisi",
      unit: "m2",
      notes: "Partisi gypsum ganda 2 sisi rangka baja ringan CNP 75",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Partisi 2 Sisi", coefficient: 1.0, unit: "m2", unit_price: 120000 },
        { component_type: "MATERIAL" as const, name: "Gypsum Yoshino 9mm", coefficient: 1.0, unit: "lbr", unit_price: 70000 },
        { component_type: "MATERIAL" as const, name: "Baja Ringan CNP 75", coefficient: 1.0, unit: "btg", unit_price: 75000 },
        { component_type: "MATERIAL" as const, name: "Kompon Gypsum", coefficient: 0.20, unit: "sak", unit_price: 75000 },
      ],
    },

    // ARSITEKTURAL - KERAMIK & LANTAI
    {
      code: "AHSP-KRM-01",
      name: "Keramik 40x40 cm Grade C (Ex. Platinum Asia)",
      category: "Pekerjaan Lantai & Keramik",
      unit: "m2",
      notes: "Pemasangan keramik lantai 40x40 KW 2",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Keramik Lantai", coefficient: 1.0, unit: "m2", unit_price: 55000 },
        { component_type: "MATERIAL" as const, name: "Keramik Ex. Platinum Asia 40x40", coefficient: 1.0, unit: "box", unit_price: 75000 },
        { component_type: "MATERIAL" as const, name: "Mortar Perekat Keramik", coefficient: 0.20, unit: "sak", unit_price: 125000 },
        { component_type: "MATERIAL" as const, name: "Nat Keramik", coefficient: 0.10, unit: "kg", unit_price: 30000 },
      ],
    },
    {
      code: "AHSP-KRM-02",
      name: "Keramik 40x40 cm Grade B (Ex. Mulia / Essenza)",
      category: "Pekerjaan Lantai & Keramik",
      unit: "m2",
      notes: "Pemasangan keramik lantai 40x40 Grade B",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Keramik", coefficient: 1.0, unit: "m2", unit_price: 55000 },
        { component_type: "MATERIAL" as const, name: "Keramik Ex. Mulia / Essenza", coefficient: 1.0, unit: "box", unit_price: 100000 },
        { component_type: "MATERIAL" as const, name: "Mortar Perekat Keramik", coefficient: 0.20, unit: "sak", unit_price: 125000 },
        { component_type: "MATERIAL" as const, name: "Nat Keramik", coefficient: 0.10, unit: "kg", unit_price: 30000 },
      ],
    },
    {
      code: "AHSP-KRM-03",
      name: "Keramik 40x40 cm Grade A (Ex. Roman)",
      category: "Pekerjaan Lantai & Keramik",
      unit: "m2",
      notes: "Pemasangan keramik lantai 40x40 Grade A",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Keramik", coefficient: 1.0, unit: "m2", unit_price: 55000 },
        { component_type: "MATERIAL" as const, name: "Keramik Ex. Roman 40x40", coefficient: 1.0, unit: "box", unit_price: 125000 },
        { component_type: "MATERIAL" as const, name: "Mortar Perekat Keramik", coefficient: 0.20, unit: "sak", unit_price: 125000 },
        { component_type: "MATERIAL" as const, name: "Nat Keramik", coefficient: 0.10, unit: "kg", unit_price: 30000 },
      ],
    },
    {
      code: "AHSP-LNT-01",
      name: "Lantai SPC Klik 5mm Ex. Taco / Champion",
      category: "Pekerjaan Lantai & Keramik",
      unit: "m2",
      notes: "Pemasangan lantai vinyl/SPC interlocking include underlayer",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang Lantai SPC", coefficient: 1.0, unit: "m2", unit_price: 75000 },
        { component_type: "MATERIAL" as const, name: "SPC Klik 5mm Ex. Champion", coefficient: 0.50, unit: "box", unit_price: 400000 },
      ],
    },

    // ARSITEKTURAL - PENGECATAN
    {
      code: "AHSP-CAT-01",
      name: "Pengecatan Dinding Interior Grade B (Ex. Dulux Catylac)",
      category: "Pekerjaan Pengecatan",
      unit: "m2",
      notes: "Pengecatan 2 lapis dinding dalam ex Dulux Catylac",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Cat Interior", coefficient: 1.0, unit: "m2", unit_price: 30000 },
        { component_type: "MATERIAL" as const, name: "Dulux Catylac Interior", coefficient: 0.05, unit: "gln", unit_price: 250000 },
      ],
    },
    {
      code: "AHSP-CAT-02",
      name: "Pengecatan Dinding Exterior Grade B (Ex. Dulux Catylac Exterior)",
      category: "Pekerjaan Pengecatan",
      unit: "m2",
      notes: "Pengecatan eksterior tahan cuaca",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Cat Exterior", coefficient: 1.0, unit: "m2", unit_price: 30000 },
        { component_type: "MATERIAL" as const, name: "Dulux Catylac Exterior", coefficient: 0.05, unit: "gln", unit_price: 300000 },
      ],
    },
    {
      code: "AHSP-CAT-03",
      name: "Pengecatan Plafon Gypsum Grade B (Ex. Dulux Pentalite)",
      category: "Pekerjaan Pengecatan",
      unit: "m2",
      notes: "Pengecatan plafon gypsum halus",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Cat Plafon", coefficient: 1.0, unit: "m2", unit_price: 35000 },
        { component_type: "MATERIAL" as const, name: "Dulux Pentalite", coefficient: 0.05, unit: "gln", unit_price: 250000 },
      ],
    },

    // INTERIOR & CUSTOM FURNITURE
    {
      code: "AHSP-INT-01",
      name: "Wallpanel / Backdrop Finish HPL Ex. Taco",
      category: "Pekerjaan Interior & Custom Furniture",
      unit: "m2",
      notes: "Backdrop dinding multipleks 18mm lapis HPL Taco",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Kayu / Interior", coefficient: 1.0, unit: "m2", unit_price: 650000 },
        { component_type: "MATERIAL" as const, name: "Multipleks 18 mm", coefficient: 0.50, unit: "lbr", unit_price: 265000 },
        { component_type: "MATERIAL" as const, name: "HPL Taco", coefficient: 0.50, unit: "lbr", unit_price: 400000 },
        { component_type: "MATERIAL" as const, name: "Cat Oplos / Finishing", coefficient: 1.0, unit: "ls", unit_price: 50000 },
      ],
    },
    {
      code: "AHSP-INT-02",
      name: "Meja Kerja/Belajar/Makan Finish HPL Ex. Taco",
      category: "Pekerjaan Interior & Custom Furniture",
      unit: "m'",
      notes: "Meja panjang multipleks 18mm lapis HPL Taco tanpa laci",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Meja Custom", coefficient: 1.0, unit: "m'", unit_price: 400000 },
        { component_type: "MATERIAL" as const, name: "Multipleks 18 mm", coefficient: 0.30, unit: "lbr", unit_price: 265000 },
        { component_type: "MATERIAL" as const, name: "HPL Taco", coefficient: 0.30, unit: "lbr", unit_price: 400000 },
        { component_type: "MATERIAL" as const, name: "Cat Oplos", coefficient: 1.0, unit: "ls", unit_price: 35000 },
      ],
    },

    // MEP (MECHANICAL, ELECTRICAL & PLUMBING)
    {
      code: "AHSP-MEP-01",
      name: "Instalasi Pipa PVC 4 Inch Ex. Wavin Type D",
      category: "Pekerjaan Mekanikal & Plumbing",
      unit: "m'",
      notes: "Pemipaan air kotor pipa PVC 4 inch include lem & gantungan",
      components: [
        { component_type: "LABOR" as const, name: "Upah Tukang Pipa", coefficient: 1.0, unit: "m'", unit_price: 30000 },
        { component_type: "MATERIAL" as const, name: "Pipa PVC 4 Inch", coefficient: 1.0, unit: "m'", unit_price: 45000 },
        { component_type: "MATERIAL" as const, name: "Lem Pipa & Fitting", coefficient: 1.0, unit: "ls", unit_price: 10000 },
      ],
    },
    {
      code: "AHSP-MEP-02",
      name: "Pemasangan LED Strip Ex. Inlite",
      category: "Pekerjaan Elektrikal",
      unit: "m'",
      notes: "Instalasi lampu indirect LED strip plafon",
      components: [
        { component_type: "LABOR" as const, name: "Upah Pasang LED Strip", coefficient: 1.0, unit: "m'", unit_price: 15000 },
        { component_type: "MATERIAL" as const, name: "LED Strip Ex. Inlite", coefficient: 1.0, unit: "m'", unit_price: 28000 },
        { component_type: "MATERIAL" as const, name: "Socket LED Strip", coefficient: 0.20, unit: "m'", unit_price: 25000 },
      ],
    },

    // VENDOR / BELI JADI
    {
      code: "AHSP-VND-01",
      name: "Pintu Sliding Meranti 85 x 200 cm Finish HPL Ex. Taco",
      category: "Vendor & Pintu / Jendela",
      unit: "pcs",
      notes: "Pintu geser kayu meranti finish HPL lengkap rel gantung Dekson",
      components: [
        { component_type: "LABOR" as const, name: "Pintu Meranti (Wasman)", coefficient: 1.0, unit: "pcs", unit_price: 900000 },
        { component_type: "LABOR" as const, name: "Pasang Pintu dan HPL (Imam)", coefficient: 1.0, unit: "pcs", unit_price: 30000 },
        { component_type: "MATERIAL" as const, name: "HPL Taco", coefficient: 1.50, unit: "lbr", unit_price: 400000 },
        { component_type: "MATERIAL" as const, name: "Rail Pintu Sliding Ex. Dekson", coefficient: 1.0, unit: "pcs", unit_price: 550000 },
      ],
    },
  ];

  let insertedCount = 0;

  for (const item of standardCatalog) {
    // Check if code already exists
    const { data: existing } = await supabase
      .from("master_ahsp")
      .select("id")
      .eq("organization_id", user.organizationId)
      .eq("code", item.code)
      .maybeSingle();

    if (!existing) {
      const { data: ahsp, error: insErr } = await supabase
        .from("master_ahsp")
        .insert({
          organization_id: user.organizationId,
          code: item.code,
          name: item.name,
          category: item.category,
          unit: item.unit,
          overhead_percent: 10.0, // standard 10%
          notes: item.notes,
        })
        .select()
        .single();

      if (!insErr && ahsp) {
        insertedCount++;
        const compRows = item.components.map((c) => ({
          ahsp_id: ahsp.id,
          component_type: c.component_type,
          name: c.name,
          coefficient: c.coefficient,
          unit: c.unit,
          unit_price: c.unit_price,
          subtotal: c.coefficient * c.unit_price,
        }));
        await supabase.from("master_ahsp_components").insert(compRows);
      }
    }
  }

  await logAudit(user, {
    action: "SEED_STANDARD_AHSP",
    entityType: "master_ahsp",
    entityId: user.organizationId,
    metadata: { itemsCreated: insertedCount },
  });

  revalidatePath("/cost-control/ahsp");
  revalidatePath("/cost-control/rab");
  return { count: insertedCount };
}
