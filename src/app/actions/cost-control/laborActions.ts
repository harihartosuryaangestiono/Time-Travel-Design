"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";
import { resolveLaborRatePrice } from "@/lib/cost-control/laborRatePricing";

const LABOR_EDITOR_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];

function assertLaborEditor(role: string) {
  if (!LABOR_EDITOR_ROLES.includes(role)) {
    throw new Error("Hanya Owner, Finance, atau Project Manager yang dapat mengelola tarif dan kontrak upah.");
  }
}

export interface MandorRateItem {
  id: string;
  labor_rate_id: string;
  mandor_name: string;
  rate: number;
  notes?: string | null;
  subcontractor_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LaborRateItem {
  id: string;
  organization_id: string;
  job_code: string;
  job_name: string;
  category: string;
  description?: string | null;
  specifications?: string | null;
  unit: string;
  payment_system: "BORONGAN" | "UPAH_KETENG" | "HARIAN";
  standard_rate: number;
  min_rate: number;
  max_rate: number;
  source?: string | null;
  effective_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  mandor_rates: MandorRateItem[];
}

export interface LaborClaimItem {
  id: string;
  organization_id: string;
  project_id: string;
  labor_item_id: string;
  claim_number: string;
  claim_date: string;
  mandor_name: string;
  work_description?: string | null;
  claimed_volume: number;
  verified_volume: number;
  approved_volume: number;
  unit_rate: number;
  claimed_amount: number;
  approved_amount: number;
  paid_amount: number;
  supervisor_notes?: string | null;
  supporting_document_url?: string | null;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "APPROVED" | "REJECTED" | "PAID";
  verified_by?: string | null;
  verified_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  expense_id?: string | null;
  created_by: string;
  created_at: string;
  project?: { id: string; name: string; code: string };
  labor_item?: { id: string; job_name: string; unit: string; contract_volume: number; unit_rate: number };
}

export interface ProjectLaborContractItem {
  id: string;
  organization_id: string;
  project_id: string;
  subcontractor_id?: string | null;
  labor_rate_id?: string | null;
  mandor_name: string;
  job_name: string;
  category: string;
  specifications?: string | null;
  unit: string;
  payment_system: "BORONGAN" | "UPAH_KETENG" | "HARIAN";
  contract_volume: number;
  unit_rate: number;
  total_amount: number;
  status: string;
  notes?: string | null;
  created_at: string;
  // Computed aggregations
  claimed_volume?: number;
  verified_volume?: number;
  approved_volume?: number;
  paid_volume?: number;
  paid_amount?: number;
  remaining_volume?: number;
  remaining_amount?: number;
  project?: { id: string; name: string; code: string };
  progress_records?: Array<{ date: string; volume: number }>;
}

export interface ProjectRetentionItem {
  id: string;
  organization_id: string;
  project_id: string;
  mandor_name: string;
  termin_number: number;
  claim_date: string;
  total_claim: number;
  paid_amount: number;
  retention_amount: number;
  status: "HELD" | "PAID" | "LUNAS";
  notes?: string | null;
  created_at?: string;
}

// ----------------------------------------------------
// 1. MASTER HARGA UPAH (LABOR RATES)
// ----------------------------------------------------

export async function getLaborRates(filters?: { category?: string; search?: string }): Promise<LaborRateItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("labor_rates")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .order("job_name", { ascending: true });

  if (filters?.category && filters.category !== "ALL") {
    query = query.eq("category", filters.category);
  }

  if (filters?.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`job_name.ilike.${term},job_code.ilike.${term},category.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat database harga upah: ${error.message}`);

  // Fetch mandor rates for these labor items
  const rateIds = (data || []).map((r) => r.id);
  const mandorMap = new Map<string, MandorRateItem[]>();

  if (rateIds.length > 0) {
    try {
      const { data: mandorData, error: mandorError } = await supabase
        .from("mandor_labor_rates")
        .select("*")
        .eq("organization_id", user.organizationId)
        .in("labor_rate_id", rateIds)
        .order("rate", { ascending: true });

      if (!mandorError && mandorData) {
        mandorData.forEach((m: any) => {
          const list = mandorMap.get(m.labor_rate_id) || [];
          list.push({
            id: m.id,
            labor_rate_id: m.labor_rate_id,
            mandor_name: m.mandor_name,
            rate: Number(m.rate),
            notes: m.notes,
            subcontractor_id: m.subcontractor_id,
            created_at: m.created_at,
            updated_at: m.updated_at,
          });
          mandorMap.set(m.labor_rate_id, list);
        });
      }
    } catch (e) {
      console.warn("Tabel mandor_labor_rates belum ada atau error:", e);
    }
  }

  return (data || []).map((row) => {
    const mRates = mandorMap.get(row.id) || [];
    let minR = Number(row.min_rate);
    let maxR = Number(row.max_rate);
    let stdR = Number(row.standard_rate);

    if (mRates.length > 0) {
      const rates = mRates.map((m) => m.rate);
      minR = Math.min(...rates);
      maxR = Math.max(...rates);
      stdR = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    }

    return {
      ...row,
      standard_rate: stdR,
      min_rate: minR,
      max_rate: maxR,
      mandor_rates: mRates,
    };
  });
}

export async function createLaborRate(input: {
  job_code: string;
  job_name: string;
  category: string;
  description?: string;
  specifications?: string;
  unit: string;
  payment_system?: "BORONGAN" | "UPAH_KETENG" | "HARIAN";
  source?: string;
  effective_date?: string;
  mandors: Array<{
    mandor_name: string;
    rate: number;
    notes?: string;
  }>;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  if (!input.mandors || input.mandors.length === 0) {
    throw new Error("Wajib memasukkan minimal 1 data mandor beserta tarif upahnya.");
  }

  const validMandors = input.mandors.filter(
    (m) => m.mandor_name && m.mandor_name.trim() && Number.isFinite(m.rate) && m.rate > 0
  );

  if (validMandors.length === 0) {
    throw new Error("Tarif upah mandor harus berupa angka positif dengan nama mandor yang jelas.");
  }

  const rates = validMandors.map((m) => m.rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const standardRate = Math.round(rates.reduce((acc, curr) => acc + curr, 0) / rates.length);

  const { data, error } = await supabase
    .from("labor_rates")
    .insert({
      organization_id: user.organizationId,
      job_code: input.job_code.trim().toUpperCase(),
      job_name: input.job_name.trim(),
      category: input.category.trim(),
      description: input.description || null,
      specifications: input.specifications || null,
      unit: input.unit.trim(),
      payment_system: input.payment_system || "BORONGAN",
      standard_rate: standardRate,
      min_rate: minRate,
      max_rate: maxRate,
      source: input.source || `Rata-rata ${validMandors.length} Mandor`,
      effective_date: input.effective_date || new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menambahkan item upah: ${error.message}`);

  // Insert into mandor_labor_rates
  try {
    const mandorRows = validMandors.map((m) => ({
      organization_id: user.organizationId,
      labor_rate_id: data.id,
      mandor_name: m.mandor_name.trim(),
      rate: m.rate,
      notes: m.notes?.trim() || null,
    }));

    await supabase.from("mandor_labor_rates").insert(mandorRows);
  } catch (err) {
    console.warn("Tabel mandor_labor_rates belum ada di DB:", err);
  }

  await logAudit(user, {
    action: "CREATE_LABOR_RATE",
    entityType: "labor_rates",
    entityId: data.id,
    metadata: {
      job_code: input.job_code,
      job_name: input.job_name,
      mandors_count: validMandors.length,
      min_rate: minRate,
      max_rate: maxRate,
      standard_rate: standardRate,
    },
  });

  revalidatePath("/cost-control/labor-rates");
  return data;
}

export async function updateLaborRate(
  id: string,
  input: {
    job_code?: string;
    job_name?: string;
    category?: string;
    description?: string;
    specifications?: string;
    unit?: string;
    payment_system?: "BORONGAN" | "UPAH_KETENG" | "HARIAN";
    source?: string;
    effective_date?: string;
    mandors?: Array<{
      id?: string;
      mandor_name: string;
      rate: number;
      notes?: string;
    }>;
  }
) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const updateFields: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.job_code) updateFields.job_code = input.job_code.trim().toUpperCase();
  if (input.job_name) updateFields.job_name = input.job_name.trim();
  if (input.category) updateFields.category = input.category.trim();
  if (input.description !== undefined) updateFields.description = input.description || null;
  if (input.specifications !== undefined) updateFields.specifications = input.specifications || null;
  if (input.unit) updateFields.unit = input.unit.trim();
  if (input.payment_system) updateFields.payment_system = input.payment_system;
  if (input.source) updateFields.source = input.source;
  if (input.effective_date) updateFields.effective_date = input.effective_date;

  if (input.mandors && input.mandors.length > 0) {
    const validMandors = input.mandors.filter(
      (m) => m.mandor_name && m.mandor_name.trim() && Number.isFinite(m.rate) && m.rate > 0
    );

    if (validMandors.length > 0) {
      const rates = validMandors.map((m) => m.rate);
      updateFields.min_rate = Math.min(...rates);
      updateFields.max_rate = Math.max(...rates);
      updateFields.standard_rate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
      updateFields.source = `Rata-rata ${validMandors.length} Mandor`;

      try {
        await supabase
          .from("mandor_labor_rates")
          .delete()
          .eq("labor_rate_id", id)
          .eq("organization_id", user.organizationId);

        const mandorRows = validMandors.map((m) => ({
          organization_id: user.organizationId,
          labor_rate_id: id,
          mandor_name: m.mandor_name.trim(),
          rate: m.rate,
          notes: m.notes?.trim() || null,
        }));

        await supabase.from("mandor_labor_rates").insert(mandorRows);
      } catch (err) {
        console.warn("Gagal update mandor_labor_rates:", err);
      }
    }
  }

  const { data, error } = await supabase
    .from("labor_rates")
    .update(updateFields)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui item upah: ${error.message}`);

  await logAudit(user, {
    action: "UPDATE_LABOR_RATE",
    entityType: "labor_rates",
    entityId: id,
    metadata: updateFields,
  });

  revalidatePath("/cost-control/labor-rates");
  return data;
}

export async function addMandorToLaborRate(input: {
  labor_rate_id: string;
  mandor_name: string;
  rate: number;
  notes?: string;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  if (!input.mandor_name?.trim() || !Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error("Nama mandor dan tarif upah harus valid.");
  }

  const { data: newMandor, error: insertError } = await supabase
    .from("mandor_labor_rates")
    .insert({
      organization_id: user.organizationId,
      labor_rate_id: input.labor_rate_id,
      mandor_name: input.mandor_name.trim(),
      rate: input.rate,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (insertError) throw new Error(`Gagal menambah tarif mandor: ${insertError.message}`);

  // Recalculate parent labor_rate min, max, standard
  const { data: allMandors } = await supabase
    .from("mandor_labor_rates")
    .select("rate")
    .eq("labor_rate_id", input.labor_rate_id)
    .eq("organization_id", user.organizationId);

  if (allMandors && allMandors.length > 0) {
    const rates = allMandors.map((m: any) => Number(m.rate));
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const avgRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);

    await supabase
      .from("labor_rates")
      .update({
        min_rate: minRate,
        max_rate: maxRate,
        standard_rate: avgRate,
        source: `Rata-rata ${rates.length} Mandor`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.labor_rate_id)
      .eq("organization_id", user.organizationId);
  }

  await logAudit(user, {
    action: "ADD_MANDOR_RATE",
    entityType: "mandor_labor_rates",
    entityId: newMandor.id,
    metadata: { labor_rate_id: input.labor_rate_id, mandor_name: input.mandor_name, rate: input.rate },
  });

  revalidatePath("/cost-control/labor-rates");
  return newMandor;
}

export async function deleteMandorFromLaborRate(mandorRateId: string, laborRateId: string) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const { error } = await supabase
    .from("mandor_labor_rates")
    .delete()
    .eq("id", mandorRateId)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus tarif mandor: ${error.message}`);

  // Recalculate remaining
  const { data: remaining } = await supabase
    .from("mandor_labor_rates")
    .select("rate")
    .eq("labor_rate_id", laborRateId)
    .eq("organization_id", user.organizationId);

  if (remaining && remaining.length > 0) {
    const rates = remaining.map((m: any) => Number(m.rate));
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const avgRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);

    await supabase
      .from("labor_rates")
      .update({
        min_rate: minRate,
        max_rate: maxRate,
        standard_rate: avgRate,
        source: `Rata-rata ${rates.length} Mandor`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", laborRateId)
      .eq("organization_id", user.organizationId);
  }

  await logAudit(user, {
    action: "DELETE_MANDOR_RATE",
    entityType: "mandor_labor_rates",
    entityId: mandorRateId,
  });

  revalidatePath("/cost-control/labor-rates");
  return { success: true };
}

export async function deleteLaborRate(id: string) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const { error } = await supabase
    .from("labor_rates")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus item upah: ${error.message}`);

  await logAudit(user, {
    action: "DELETE_LABOR_RATE",
    entityType: "labor_rates",
    entityId: id,
  });

  revalidatePath("/cost-control/labor-rates");
  return { success: true };
}

// ----------------------------------------------------
// 2. REKAPITULASI UPAH PROYEK (PROJECT LABOR ITEMS)
// ----------------------------------------------------

export async function getProjectLaborRecap(projectId?: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Load items
  let itemQuery = supabase
    .from("project_labor_items")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (projectId && projectId !== "ALL") {
    itemQuery = itemQuery.eq("project_id", projectId);
  }

  const { data: items, error: itemsError } = await itemQuery;
  if (itemsError) throw new Error(`Gagal memuat rekap upah: ${itemsError.message}`);

  if (!items || items.length === 0) return [];

  const projectIds = Array.from(new Set(items.map((i) => i.project_id)));
  const itemIds = items.map((i) => i.id);

  // Load projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, code")
    .eq("organization_id", user.organizationId)
    .in("id", projectIds);

  const projectMap = new Map((projects || []).map((p) => [p.id, p]));

  // Load claims aggregated per labor_item_id
  const { data: claims } = await supabase
    .from("labor_claims")
    .select("labor_item_id, claim_date, claimed_volume, verified_volume, approved_volume, unit_rate, paid_amount, status")
    .eq("organization_id", user.organizationId)
    .in("labor_item_id", itemIds)
    .order("claim_date", { ascending: true });

  const claimsByItem = new Map<string, typeof claims>();
  (claims || []).forEach((c) => {
    const list = claimsByItem.get(c.labor_item_id) || [];
    list.push(c);
    claimsByItem.set(c.labor_item_id, list);
  });

  return items.map((item) => {
    const relatedClaims = claimsByItem.get(item.id) || [];
    const contractVolume = Number(item.contract_volume || 0);
    const unitRate = Number(item.unit_rate || 0);
    const totalContractAmount = Number(item.total_amount || 0);

    const claimedVolume = relatedClaims.reduce((sum, c) => sum + Number(c.claimed_volume || 0), 0);
    const verifiedVolume = relatedClaims
      .filter((c) => ["VERIFIED", "APPROVED", "PAID"].includes(c.status))
      .reduce((sum, c) => sum + Number(c.verified_volume || 0), 0);
    const approvedVolume = relatedClaims
      .filter((c) => ["APPROVED", "PAID"].includes(c.status))
      .reduce((sum, c) => sum + Number(c.approved_volume || 0), 0);
    const paidAmount = relatedClaims
      .filter((c) => c.status === "PAID")
      .reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);
    const paidVolume = unitRate > 0 ? paidAmount / unitRate : 0;

    const remainingVolume = Math.max(0, contractVolume - approvedVolume);
    const remainingAmount = Math.max(0, totalContractAmount - paidAmount);

    let progressRecords: Array<{ date: string; volume: number }> = [];
    if (item.notes) {
      try {
        const parsed = JSON.parse(item.notes);
        if (Array.isArray(parsed)) progressRecords = parsed;
      } catch (e) {}
    }
    if (progressRecords.length === 0 && relatedClaims.length > 0) {
      progressRecords = relatedClaims
        .filter((c: any) => Number(c.claimed_volume) > 0)
        .map((c: any) => ({
          date: c.claim_date ? c.claim_date.slice(0, 10) : "",
          volume: Number(c.claimed_volume),
        }))
        .filter((p: any) => p.date);
    }

    return {
      ...item,
      contract_volume: contractVolume,
      unit_rate: unitRate,
      total_amount: totalContractAmount,
      claimed_volume: claimedVolume,
      verified_volume: verifiedVolume,
      approved_volume: approvedVolume,
      paid_volume: paidVolume,
      paid_amount: paidAmount,
      remaining_volume: remainingVolume,
      remaining_amount: remainingAmount,
      progress_records: progressRecords,
      project: projectMap.get(item.project_id) || { id: item.project_id, name: "Proyek", code: "-" },
    };
  });
}

export async function createProjectLaborItem(input: {
  project_id: string;
  mandor_name: string;
  contract_volume: number;
  labor_rate_id: string;
  notes?: string;
  subcontractor_id?: string;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  if (!Number.isFinite(input.contract_volume) || input.contract_volume <= 0) {
    throw new Error("Volume kontrak harus berupa angka lebih besar dari 0.");
  }

  const { data: laborRate, error: laborRateError } = await supabase
    .from("labor_rates")
    .select("id, job_name, category, specifications, unit, payment_system, standard_rate")
    .eq("id", input.labor_rate_id)
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (laborRateError) throw new Error(`Gagal memuat item dari database harga upah: ${laborRateError.message}`);
  if (!laborRate) throw new Error("Item pekerjaan tidak ditemukan atau sudah tidak aktif di Database Harga Upah.");
  if (laborRate.payment_system !== "BORONGAN") {
    throw new Error("Pilih item dengan sistem pembayaran Borongan.");
  }

  let mandorRates: Array<{ mandor_name: string; rate: number }> = [];
  const { data: mandorRateRows, error: mandorRatesError } = await supabase
    .from("mandor_labor_rates")
    .select("mandor_name, rate")
    .eq("organization_id", user.organizationId)
    .eq("labor_rate_id", laborRate.id);
  if (mandorRatesError) {
    if (!["42P01", "PGRST205"].includes(mandorRatesError.code)) {
      throw new Error(`Gagal memuat tarif mandor: ${mandorRatesError.message}`);
    }
  } else {
    mandorRates = (mandorRateRows || []).map((row) => ({
      mandor_name: row.mandor_name,
      rate: Number(row.rate),
    }));
  }

  const { unitRate } = resolveLaborRatePrice(
    {
      standard_rate: Number(laborRate.standard_rate),
      mandor_rates: mandorRates,
    },
    input.mandor_name,
  );
  if (!Number.isFinite(unitRate) || unitRate <= 0) {
    throw new Error("Tarif item ini belum tersedia atau belum valid di Database Harga Upah.");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");

  const totalAmount = input.contract_volume * unitRate;

  const { data, error } = await supabase
    .from("project_labor_items")
    .insert({
      organization_id: user.organizationId,
      project_id: input.project_id,
      mandor_name: input.mandor_name.trim(),
      job_name: laborRate.job_name,
      category: laborRate.category,
      specifications: laborRate.specifications || null,
      unit: laborRate.unit,
      payment_system: laborRate.payment_system,
      contract_volume: input.contract_volume,
      unit_rate: unitRate,
      total_amount: totalAmount,
      status: "ACTIVE",
      notes: input.notes || null,
      labor_rate_id: input.labor_rate_id || null,
      subcontractor_id: input.subcontractor_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat rekap kontrak upah: ${error.message}`);

  await logAudit(user, {
    action: "CREATE_PROJECT_LABOR_ITEM",
    entityType: "project_labor_items",
    entityId: data.id,
    metadata: { project_id: input.project_id, job_name: laborRate.job_name, total_amount: totalAmount },
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

// ----------------------------------------------------
// 3. PENGAJUAN, VERIFIKASI & APPROVAL KLAIM UPAH
// ----------------------------------------------------

export async function getLaborClaims(filters?: { projectId?: string; status?: string; laborItemId?: string }) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("labor_claims")
    .select(`
      *,
      project:projects(id, name, code),
      labor_item:project_labor_items(id, job_name, unit, contract_volume, unit_rate)
    `)
    .eq("organization_id", user.organizationId)
    .order("claim_date", { ascending: false });

  if (filters?.projectId && filters.projectId !== "ALL") {
    query = query.eq("project_id", filters.projectId);
  }

  if (filters?.laborItemId) {
    query = query.eq("labor_item_id", filters.laborItemId);
  }

  if (filters?.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat daftar klaim upah: ${error.message}`);

  return (data || []).map((row) => ({
    ...row,
    claimed_volume: Number(row.claimed_volume),
    verified_volume: Number(row.verified_volume),
    approved_volume: Number(row.approved_volume),
    unit_rate: Number(row.unit_rate),
    claimed_amount: Number(row.claimed_amount),
    approved_amount: Number(row.approved_amount),
    paid_amount: Number(row.paid_amount || 0),
  }));
}

export async function submitLaborClaim(input: {
  project_id: string;
  labor_item_id: string;
  claim_date?: string;
  mandor_name: string;
  work_description?: string;
  claimed_volume: number;
  unit_rate: number;
  supervisor_notes?: string;
  supporting_document_url?: string;
}) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE", "PROJECT_MANAGER", "SITE_STAFF"].includes(user.role)) {
    throw new Error("Anda tidak memiliki izin untuk mengajukan klaim upah.");
  }
  const supabase = await createClient();

  if (!Number.isFinite(input.claimed_volume) || input.claimed_volume <= 0) {
    throw new Error("Volume klaim harus berupa angka lebih besar dari 0.");
  }
  const { data: laborItem, error: laborItemError } = await supabase
    .from("project_labor_items")
    .select("id, project_id, mandor_name, unit_rate")
    .eq("id", input.labor_item_id)
    .eq("project_id", input.project_id)
    .eq("organization_id", user.organizationId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (laborItemError) throw new Error(`Gagal memvalidasi kontrak upah: ${laborItemError.message}`);
  if (!laborItem) throw new Error("Kontrak upah tidak ditemukan di proyek ini.");

  const unitRate = Number(laborItem.unit_rate);
  const claimedAmount = input.claimed_volume * unitRate;
  const dateStr = (input.claim_date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const claimNumber = `CLM-${dateStr}-${randomSuffix}`;

  const { data, error } = await supabase
    .from("labor_claims")
    .insert({
      organization_id: user.organizationId,
      project_id: input.project_id,
      labor_item_id: input.labor_item_id,
      claim_number: claimNumber,
      claim_date: input.claim_date || new Date().toISOString(),
      mandor_name: laborItem.mandor_name,
      work_description: input.work_description || null,
      claimed_volume: input.claimed_volume,
      verified_volume: 0,
      approved_volume: 0,
      unit_rate: unitRate,
      claimed_amount: claimedAmount,
      approved_amount: 0,
      paid_amount: 0,
      supervisor_notes: input.supervisor_notes || null,
      supporting_document_url: input.supporting_document_url || null,
      status: "SUBMITTED",
      created_by: user.profileId || user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal mengajukan klaim upah: ${error.message}`);

  await logAudit(user, {
    action: "SUBMIT_LABOR_CLAIM",
    entityType: "labor_claims",
    entityId: data.id,
    metadata: { claim_number: claimNumber, claimed_amount: claimedAmount },
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

export async function verifyLaborClaim(claimId: string, verifiedVolume: number, supervisorNotes?: string) {
  const user = await requireAuthUser();
  if (!["OWNER", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Hanya Owner atau Project Manager yang dapat memverifikasi klaim upah.");
  }
  const supabase = await createClient();

  const { data: claim, error: fetchErr } = await supabase
    .from("labor_claims")
    .select("*")
    .eq("id", claimId)
    .eq("organization_id", user.organizationId)
    .single();

  if (fetchErr || !claim) throw new Error("Klaim upah tidak ditemukan.");
  if (claim.status !== "SUBMITTED") throw new Error("Hanya klaim yang baru diajukan yang dapat diverifikasi.");
  if (
    !Number.isFinite(verifiedVolume) || verifiedVolume < 0 ||
    verifiedVolume > Number(claim.claimed_volume)
  ) {
    throw new Error("Volume terverifikasi harus berada di antara 0 dan volume klaim.");
  }

  const unitRate = Number(claim.unit_rate);
  const verifiedAmount = verifiedVolume * unitRate;

  const { data, error } = await supabase
    .from("labor_claims")
    .update({
      verified_volume: verifiedVolume,
      supervisor_notes: supervisorNotes || claim.supervisor_notes,
      status: "VERIFIED",
      verified_by: user.profileId || user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("organization_id", user.organizationId)
    .eq("status", "SUBMITTED")
    .select()
    .single();

  if (error) throw new Error(`Gagal memverifikasi klaim upah: ${error.message}`);

  await logAudit(user, {
    action: "VERIFY_LABOR_CLAIM",
    entityType: "labor_claims",
    entityId: claimId,
    metadata: { verified_volume: verifiedVolume, verified_amount: verifiedAmount, supervisorNotes },
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

export async function approveLaborClaim(claimId: string, approvedVolume: number) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Anda tidak memiliki izin untuk menyetujui klaim upah.");
  }
  const supabase = await createClient();

  const { data: claim, error: fetchErr } = await supabase
    .from("labor_claims")
    .select("*")
    .eq("id", claimId)
    .eq("organization_id", user.organizationId)
    .single();

  if (fetchErr || !claim) throw new Error("Klaim upah tidak ditemukan.");
  if (claim.status !== "VERIFIED") throw new Error("Klaim harus diverifikasi sebelum disetujui.");
  if (
    !Number.isFinite(approvedVolume) || approvedVolume <= 0 ||
    approvedVolume > Number(claim.verified_volume)
  ) {
    throw new Error("Volume yang disetujui harus lebih besar dari 0 dan tidak melebihi volume terverifikasi.");
  }

  const { data: laborItem, error: laborItemError } = await supabase
    .from("project_labor_items")
    .select("contract_volume")
    .eq("id", claim.labor_item_id)
    .eq("project_id", claim.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (laborItemError) throw new Error(`Gagal memvalidasi kontrak upah: ${laborItemError.message}`);
  if (!laborItem) throw new Error("Kontrak upah tidak ditemukan.");

  const { data: approvedClaims, error: approvedClaimsError } = await supabase
    .from("labor_claims")
    .select("approved_volume")
    .eq("labor_item_id", claim.labor_item_id)
    .eq("organization_id", user.organizationId)
    .in("status", ["APPROVED", "PAID"])
    .neq("id", claimId);
  if (approvedClaimsError) throw new Error(`Gagal memeriksa volume kontrak yang telah disetujui: ${approvedClaimsError.message}`);
  const alreadyApproved = (approvedClaims || []).reduce((sum, item) => sum + Number(item.approved_volume || 0), 0);
  if (alreadyApproved + approvedVolume > Number(laborItem.contract_volume)) {
    throw new Error("Volume disetujui melebihi sisa volume kontrak mandor.");
  }

  const unitRate = Number(claim.unit_rate);
  const approvedAmount = approvedVolume * unitRate;

  const { data, error } = await supabase
    .from("labor_claims")
    .update({
      approved_volume: approvedVolume,
      approved_amount: approvedAmount,
      status: "APPROVED",
      approved_by: user.profileId || user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("organization_id", user.organizationId)
    .eq("status", "VERIFIED")
    .select()
    .single();

  if (error) throw new Error(`Gagal menyetujui klaim upah: ${error.message}`);

  await logAudit(user, {
    action: "APPROVE_LABOR_CLAIM",
    entityType: "labor_claims",
    entityId: claimId,
    metadata: { approved_volume: approvedVolume, approved_amount: approvedAmount },
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

export async function rejectLaborClaim(claimId: string, reason: string) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Anda tidak memiliki izin untuk menolak klaim upah.");
  }
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("labor_claims")
    .update({
      status: "REJECTED",
      rejected_by: user.profileId || user.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("organization_id", user.organizationId)
    .in("status", ["SUBMITTED", "VERIFIED"])
    .select()
    .maybeSingle();

  if (error) throw new Error(`Gagal menolak klaim upah: ${error.message}`);
  if (!data) throw new Error("Klaim tidak ditemukan atau sudah diproses.");

  await logAudit(user, {
    action: "REJECT_LABOR_CLAIM",
    entityType: "labor_claims",
    entityId: claimId,
    metadata: { reason },
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

// ----------------------------------------------------
// 4. INTEGRASI PEMBAYARAN KE KAS/PENGELUARAN EXISTING
// ----------------------------------------------------

export async function payLaborClaim(input: {
  claim_id: string;
  cash_account_id: string;
  payment_date?: string;
  amount?: number;
  notes?: string;
}) {
  const user = await requireAuthUser();
  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat mencatat pembayaran upah.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pay_labor_claim", {
    p_claim_id: input.claim_id,
    p_cash_account_id: input.cash_account_id,
    p_payment_date: input.payment_date || null,
    p_amount: input.amount ?? null,
    p_notes: input.notes || null,
  });

  if (error) throw new Error(`Gagal memproses pembayaran klaim upah: ${error.message}`);
  const result = data as { claim?: typeof data; expense_id?: string; paid_amount?: number } | null;
  if (!result?.claim || !result.expense_id) {
    throw new Error("Pembayaran klaim upah tidak menghasilkan transaksi yang lengkap.");
  }
  const updatedClaim = result.claim;

  await logAudit(user, {
    action: "PAY_LABOR_CLAIM",
    entityType: "labor_claims",
    entityId: input.claim_id,
    metadata: {
      expense_id: result.expense_id,
      paid_amount: result.paid_amount,
      cash_account_id: input.cash_account_id,
    },
  });

  revalidatePath("/cost-control/labor-recap");
  revalidatePath("/cash-book");
  return updatedClaim;
}

// ----------------------------------------------------
// 4. RETENSI UPAH PROYEK (LABOR RETENTIONS)
// ----------------------------------------------------

export async function getProjectLaborRetentions(projectId: string): Promise<ProjectRetentionItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!projectId || projectId === "ALL") return [];

  const { data, error } = await supabase
    .from("project_labor_retentions")
    .select("*")
    .eq("organization_id", user.organizationId)
    .eq("project_id", projectId)
    .order("termin_number", { ascending: true });

  if (error) {
    console.warn("Gagal memuat data retensi upah:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    mandor_name: row.mandor_name,
    termin_number: Number(row.termin_number),
    claim_date: row.claim_date ? row.claim_date.slice(0, 10) : "",
    total_claim: Number(row.total_claim),
    paid_amount: Number(row.paid_amount),
    retention_amount: Number(row.retention_amount),
    status: row.status as "HELD" | "PAID" | "LUNAS",
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function createProjectLaborRetention(input: {
  project_id: string;
  mandor_name: string;
  termin_number: number;
  claim_date: string;
  total_claim: number;
  paid_amount?: number;
  retention_amount?: number;
  status?: "HELD" | "PAID" | "LUNAS";
  notes?: string;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const totalClaim = Number(input.total_claim);
  const isLunas = input.status === "LUNAS";
  const paidAmount = input.paid_amount !== undefined
    ? Number(input.paid_amount)
    : (isLunas ? totalClaim : Math.round(totalClaim * 0.9));
  const retentionAmount = input.retention_amount !== undefined
    ? Number(input.retention_amount)
    : (isLunas ? 0 : totalClaim - paidAmount);

  const { data, error } = await supabase
    .from("project_labor_retentions")
    .insert({
      organization_id: user.organizationId,
      project_id: input.project_id,
      mandor_name: input.mandor_name.trim(),
      termin_number: input.termin_number,
      claim_date: input.claim_date || new Date().toISOString(),
      total_claim: totalClaim,
      paid_amount: paidAmount,
      retention_amount: retentionAmount,
      status: input.status || (isLunas ? "LUNAS" : "HELD"),
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menyimpan data retensi: ${error.message}`);

  await logAudit(user, {
    action: "CREATE_LABOR_RETENTION",
    entityType: "project_labor_retentions",
    entityId: data.id,
    metadata: input,
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

export async function updateProjectLaborRetention(
  id: string,
  input: {
    status?: "HELD" | "PAID" | "LUNAS";
    paid_amount?: number;
    retention_amount?: number;
    notes?: string;
  }
) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_labor_retentions")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui status retensi: ${error.message}`);

  await logAudit(user, {
    action: "UPDATE_LABOR_RETENTION",
    entityType: "project_labor_retentions",
    entityId: id,
    metadata: input,
  });

  revalidatePath("/cost-control/labor-recap");
  return data;
}

export async function deleteProjectLaborRetention(id: string) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_labor_retentions")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) throw new Error(`Gagal menghapus retensi: ${error.message}`);

  revalidatePath("/cost-control/labor-recap");
  return { success: true };
}

export async function importProjectLaborRecapBatch(input: {
  project_name: string;
  project_code?: string;
  mandor_name: string;
  items: Array<{
    job_name: string;
    unit: string;
    unit_rate: number;
    total_volume: number;
    progress_records?: Array<{ date: string; volume: number }>;
  }>;
  retentions: Array<{
    termin_number: number;
    date: string;
    total_claim: number;
    paid_amount: number;
    retention_amount: number;
    status: string;
  }>;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  // 1. Find or create project
  let projectId: string;
  const { data: existingProject } = await supabase
    .from("projects")
    .select("id, name")
    .eq("organization_id", user.organizationId)
    .ilike("name", `%${input.project_name.trim()}%`)
    .maybeSingle();

  if (existingProject) {
    projectId = existingProject.id;
  } else {
    const code = input.project_code || `PRJ-${Math.floor(100 + Math.random() * 900)}`;
    const { data: newProj, error: newProjError } = await supabase
      .from("projects")
      .insert({
        organization_id: user.organizationId,
        code,
        name: input.project_name.trim(),
        project_year: new Date().getFullYear(),
        type: "CONSTRUCTION",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (newProjError) throw new Error(`Gagal membuat proyek baru: ${newProjError.message}`);
    projectId = newProj.id;
  }

  // 2. Insert items
  for (const item of input.items) {
    const totalAmount = item.total_volume * item.unit_rate;
    const { data: insertedItem, error: itemError } = await supabase
      .from("project_labor_items")
      .insert({
        organization_id: user.organizationId,
        project_id: projectId,
        mandor_name: input.mandor_name.trim(),
        job_name: item.job_name.trim(),
        category: "Pekerjaan Renovasi",
        unit: item.unit.trim(),
        unit_rate: item.unit_rate,
        contract_volume: item.total_volume,
        total_amount: totalAmount,
        status: "ACTIVE",
        notes: JSON.stringify(item.progress_records || []),
      })
      .select()
      .single();

    if (!itemError && insertedItem && item.progress_records) {
      for (let i = 0; i < item.progress_records.length; i++) {
        const prog = item.progress_records[i];
        if (prog.volume > 0) {
          const claimAmount = Math.round(prog.volume * item.unit_rate);
          await supabase.from("labor_claims").insert({
            organization_id: user.organizationId,
            project_id: projectId,
            labor_item_id: insertedItem.id,
            claim_number: `CLM-${Date.now().toString().slice(-6)}-${i + 1}`,
            claim_date: prog.date ? new Date(prog.date).toISOString() : new Date().toISOString(),
            mandor_name: input.mandor_name.trim(),
            work_description: `Progres ${item.job_name}`,
            claimed_volume: prog.volume,
            verified_volume: prog.volume,
            approved_volume: prog.volume,
            unit_rate: item.unit_rate,
            claimed_amount: claimAmount,
            approved_amount: claimAmount,
            paid_amount: claimAmount,
            status: "PAID",
            created_by: user.profileId || user.id,
          });
        }
      }
    }
  }

  // 3. Insert retentions
  for (const ret of input.retentions) {
    await supabase.from("project_labor_retentions").insert({
      organization_id: user.organizationId,
      project_id: projectId,
      mandor_name: input.mandor_name.trim(),
      termin_number: ret.termin_number,
      claim_date: ret.date ? new Date(ret.date).toISOString() : new Date().toISOString(),
      total_claim: ret.total_claim,
      paid_amount: ret.paid_amount,
      retention_amount: ret.retention_amount,
      status: ret.status || "HELD",
    });
  }

  revalidatePath("/cost-control/labor-recap");
  return { success: true, projectId };
}
