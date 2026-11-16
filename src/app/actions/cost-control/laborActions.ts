"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/auditLogger";

const LABOR_EDITOR_ROLES = ["OWNER", "FINANCE", "PROJECT_MANAGER"];

function assertLaborEditor(role: string) {
  if (!LABOR_EDITOR_ROLES.includes(role)) {
    throw new Error("Hanya Owner, Finance, atau Project Manager yang dapat mengelola tarif dan kontrak upah.");
  }
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
}

// ----------------------------------------------------
// 1. MASTER HARGA UPAH (LABOR RATES)
// ----------------------------------------------------

export async function getLaborRates(filters?: { category?: string; search?: string }) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("labor_rates")
    .select("*")
    .eq("organization_id", user.organizationId)
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

  return (data || []).map((row) => ({
    ...row,
    standard_rate: Number(row.standard_rate),
    min_rate: Number(row.min_rate),
    max_rate: Number(row.max_rate),
  }));
}

export async function createLaborRate(input: {
  job_code: string;
  job_name: string;
  category: string;
  description?: string;
  specifications?: string;
  unit: string;
  payment_system?: "BORONGAN" | "UPAH_KETENG" | "HARIAN";
  standard_rate: number;
  min_rate?: number;
  max_rate?: number;
  source?: string;
  effective_date?: string;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  const minR = input.min_rate !== undefined ? input.min_rate : input.standard_rate * 0.9;
  const maxR = input.max_rate !== undefined ? input.max_rate : input.standard_rate * 1.15;
  if (
    ![input.standard_rate, minR, maxR].every((rate) => Number.isFinite(rate) && rate >= 0) ||
    minR > input.standard_rate || maxR < input.standard_rate
  ) {
    throw new Error("Tarif upah dan rentang minimum/maksimum tidak valid.");
  }

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
      standard_rate: input.standard_rate,
      min_rate: minR,
      max_rate: maxR,
      source: input.source || "Standar Perusahaan",
      effective_date: input.effective_date || new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menambahkan item upah: ${error.message}`);

  await logAudit(user, {
    action: "CREATE_LABOR_RATE",
    entityType: "labor_rates",
    entityId: data.id,
    metadata: { job_code: input.job_code, job_name: input.job_name, standard_rate: input.standard_rate },
  });

  revalidatePath("/cost-control/labor-rates");
  return data;
}

export async function updateLaborRate(id: string, input: Partial<Parameters<typeof createLaborRate>[0]>) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  // Record rate history if rate changed
  const { data: existing, error: existingError } = await supabase
    .from("labor_rates")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (existingError) throw new Error(`Gagal memuat tarif upah: ${existingError.message}`);
  if (!existing) throw new Error("Tarif upah tidak ditemukan.");
  const nextRate = input.standard_rate ?? Number(existing.standard_rate);
  const nextMin = input.min_rate ?? Number(existing.min_rate);
  const nextMax = input.max_rate ?? Number(existing.max_rate);
  if (
    ![nextRate, nextMin, nextMax].every((rate) => Number.isFinite(rate) && rate >= 0) ||
    nextMin > nextRate || nextMax < nextRate
  ) {
    throw new Error("Tarif upah dan rentang minimum/maksimum tidak valid.");
  }

  if (input.standard_rate !== undefined && Number(existing.standard_rate) !== input.standard_rate) {
    const { error: historyError } = await supabase.from("labor_rate_history").insert({
      organization_id: user.organizationId,
      labor_rate_id: id,
      rate: Number(existing.standard_rate),
      payment_system: existing.payment_system,
      calculation_basis: "Perubahan Tarif Standar",
      effective_date: existing.updated_at || existing.created_at,
      notes: `Perubahan dari ${Number(existing.standard_rate)} ke ${input.standard_rate}`,
      created_by: user.profileId || user.id,
    });
    if (historyError) throw new Error(`Gagal menyimpan riwayat tarif upah: ${historyError.message}`);
  }

  const { data, error } = await supabase
    .from("labor_rates")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui item upah: ${error.message}`);

  await logAudit(user, {
    action: "UPDATE_LABOR_RATE",
    entityType: "labor_rates",
    entityId: id,
    metadata: input,
  });

  revalidatePath("/cost-control/labor-rates");
  return data;
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
    .select("labor_item_id, claimed_volume, verified_volume, approved_volume, unit_rate, paid_amount, status")
    .eq("organization_id", user.organizationId)
    .in("labor_item_id", itemIds);

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
      project: projectMap.get(item.project_id) || { id: item.project_id, name: "Proyek", code: "-" },
    };
  });
}

export async function createProjectLaborItem(input: {
  project_id: string;
  mandor_name: string;
  job_name: string;
  category: string;
  specifications?: string;
  unit: string;
  payment_system?: "BORONGAN" | "UPAH_KETENG" | "HARIAN";
  contract_volume: number;
  unit_rate: number;
  notes?: string;
  labor_rate_id?: string;
  subcontractor_id?: string;
}) {
  const user = await requireAuthUser();
  assertLaborEditor(user.role);
  const supabase = await createClient();

  if (
    !Number.isFinite(input.contract_volume) || input.contract_volume <= 0 ||
    !Number.isFinite(input.unit_rate) || input.unit_rate < 0
  ) {
    throw new Error("Volume kontrak harus lebih besar dari 0 dan tarif tidak boleh negatif.");
  }
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (!project) throw new Error("Proyek tidak ditemukan di organisasi ini.");

  const totalAmount = input.contract_volume * input.unit_rate;

  const { data, error } = await supabase
    .from("project_labor_items")
    .insert({
      organization_id: user.organizationId,
      project_id: input.project_id,
      mandor_name: input.mandor_name.trim(),
      job_name: input.job_name.trim(),
      category: input.category.trim(),
      specifications: input.specifications || null,
      unit: input.unit.trim(),
      payment_system: input.payment_system || "BORONGAN",
      contract_volume: input.contract_volume,
      unit_rate: input.unit_rate,
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
    metadata: { project_id: input.project_id, job_name: input.job_name, total_amount: totalAmount },
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
