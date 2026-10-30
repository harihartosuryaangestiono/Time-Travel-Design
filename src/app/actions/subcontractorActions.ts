"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";

export interface SubcontractorContractSummary {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  subcontractorId: string;
  subcontractorName: string;
  description: string;
  contractAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

function canManageContracts(role: string) {
  return role === "OWNER" || role === "FINANCE";
}

function normalizeMatchText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getContractRows(organizationId: string) {
  const supabase = await createClient();
  const { data: contracts, error: contractsError } = await supabase
    .from("subcontractor_contracts")
    .select("id, project_id, subcontractor_id, description, contract_amount")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (contractsError) throw new Error(`Gagal memuat kontrak subkontraktor: ${contractsError.message}`);
  if (!contracts?.length) return [];

  const projectIds = Array.from(new Set(contracts.map((contract) => contract.project_id)));
  const subcontractorIds = Array.from(new Set(contracts.map((contract) => contract.subcontractor_id)));

  const [
    { data: projects, error: projectsError },
    { data: subcontractors, error: subcontractorsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, code").eq("organization_id", organizationId).in("id", projectIds),
    supabase.from("subcontractors").select("id, name").eq("organization_id", organizationId).in("id", subcontractorIds),
    supabase
      .from("expenses")
      .select("subcontractor_contract_id, project_id, merchant, description, category, total_amount")
      .eq("organization_id", organizationId)
      .in("project_id", projectIds)
      .in("status", ["APPROVED", "POSTED"]),
  ]);

  if (projectsError) throw new Error(`Gagal memuat proyek subkontraktor: ${projectsError.message}`);
  if (subcontractorsError) throw new Error(`Gagal memuat data subkontraktor: ${subcontractorsError.message}`);
  if (paymentsError) throw new Error(`Gagal memuat pembayaran subkontraktor: ${paymentsError.message}`);

  const projectById = new Map((projects || []).map((project) => [project.id, project]));
  const subcontractorById = new Map((subcontractors || []).map((subcontractor) => [subcontractor.id, subcontractor]));
  const paidByContract = new Map<string, number>();
  const contractsByProjectSubcontractor = new Map<string, typeof contracts>();
  contracts.forEach((contract) => {
    const key = `${contract.project_id}:${contract.subcontractor_id}`;
    const group = contractsByProjectSubcontractor.get(key) || [];
    group.push(contract);
    contractsByProjectSubcontractor.set(key, group);
  });

  (payments || []).forEach((payment) => {
    if (payment.subcontractor_contract_id) {
      const contractId = payment.subcontractor_contract_id;
      paidByContract.set(
        contractId,
        (paidByContract.get(contractId) || 0) + Number(payment.total_amount || 0)
      );
      return;
    }

    const projectContracts = contracts.filter((contract) => contract.project_id === payment.project_id);
    if (!payment.category?.toLowerCase().startsWith("subcontractor")) return;
    const paymentMerchant = normalizeMatchText(payment.merchant);
    const paymentDescription = ` ${normalizeMatchText(payment.description)} `;
    const matches = projectContracts.filter((contract) => {
      const key = `${contract.project_id}:${contract.subcontractor_id}`;
      const sameProjectSubcontractorContracts = contractsByProjectSubcontractor.get(key) || [];
      const subcontractor = subcontractorById.get(contract.subcontractor_id);
      const subcontractorName = normalizeMatchText(subcontractor?.name);
      if (sameProjectSubcontractorContracts.length !== 1 || !subcontractorName) return false;
      return paymentMerchant === subcontractorName || paymentDescription.includes(` ${subcontractorName} `);
    });

    if (matches.length === 1) {
      const contractId = matches[0].id;
      paidByContract.set(
        contractId,
        (paidByContract.get(contractId) || 0) + Number(payment.total_amount || 0)
      );
    }
  });

  return contracts.map((contract): SubcontractorContractSummary => {
    const project = projectById.get(contract.project_id);
    const subcontractor = subcontractorById.get(contract.subcontractor_id);
    if (!project || !subcontractor) {
      throw new Error(`Data proyek atau subkontraktor untuk kontrak ${contract.id} tidak ditemukan.`);
    }
    const contractAmount = Number(contract.contract_amount || 0);
    const paidAmount = paidByContract.get(contract.id) || 0;
    return {
      id: contract.id,
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      subcontractorId: subcontractor.id,
      subcontractorName: subcontractor.name,
      description: contract.description,
      contractAmount,
      paidAmount,
      remainingAmount: Math.max(0, contractAmount - paidAmount),
    };
  });
}

export async function getSubcontractorRecap() {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const [contracts, { data: projects, error: projectsError }, { data: subcontractors, error: subcontractorsError }] =
    await Promise.all([
      getContractRows(user.organizationId),
      supabase.from("projects").select("id, name, code").eq("organization_id", user.organizationId).order("name"),
      supabase.from("subcontractors").select("id, name").eq("organization_id", user.organizationId).order("name"),
    ]);

  if (projectsError) throw new Error(`Gagal memuat daftar proyek: ${projectsError.message}`);
  if (subcontractorsError) throw new Error(`Gagal memuat daftar subkontraktor: ${subcontractorsError.message}`);

  return {
    contracts,
    projects: projects || [],
    subcontractors: subcontractors || [],
    canManage: canManageContracts(user.role),
  };
}

export async function getSubcontractors() {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcontractors")
    .select("id, name, email, phone, address")
    .eq("organization_id", user.organizationId)
    .order("name");

  if (error) throw new Error(`Gagal memuat data subkontraktor: ${error.message}`);
  return { subcontractors: data || [], canManage: canManageContracts(user.role) };
}

export async function saveSubcontractor(input: {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  const user = await requireAuthUser();
  if (!canManageContracts(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat mengelola data subkontraktor.");
  }
  if (!input.name.trim()) throw new Error("Nama subkontraktor wajib diisi.");

  const supabase = await createClient();
  const values = {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
  };
  const { data: saved, error } = input.id
    ? await supabase
        .from("subcontractors")
        .update(values)
        .eq("id", input.id)
        .eq("organization_id", user.organizationId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("subcontractors")
        .insert({ ...values, organization_id: user.organizationId })
        .select("id")
        .single();

  if (error) throw new Error(`Gagal menyimpan data subkontraktor: ${error.message}`);
  if (!saved) throw new Error("Data subkontraktor tidak ditemukan atau tidak dapat diubah.");
  revalidatePath("/subcontractors");
  revalidatePath("/subcontractor-recap");
  return { success: true };
}

export async function deleteSubcontractor(id: string) {
  const user = await requireAuthUser();
  if (!canManageContracts(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat menghapus data subkontraktor.");
  }
  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("subcontractors")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503") {
      throw new Error("Subkontraktor sudah digunakan pada kontrak borongan dan tidak dapat dihapus.");
    }
    throw new Error(`Gagal menghapus data subkontraktor: ${error.message}`);
  }
  if (!deleted) throw new Error("Data subkontraktor tidak ditemukan atau tidak dapat dihapus.");
  revalidatePath("/subcontractors");
  revalidatePath("/subcontractor-recap");
  return { success: true };
}

export async function getSubcontractorPaymentOptions(): Promise<SubcontractorContractSummary[]> {
  const user = await requireAuthUser();
  return getContractRows(user.organizationId);
}

export async function createSubcontractorContract(input: {
  projectId: string;
  subcontractorId: string;
  description: string;
  contractAmount: number;
}) {
  const user = await requireAuthUser();
  if (!canManageContracts(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat mencatat nilai borongan subkontraktor.");
  }
  if (!Number.isFinite(input.contractAmount) || input.contractAmount <= 0) {
    throw new Error("Nilai borongan harus lebih besar dari 0.");
  }
  if (!input.description.trim()) {
    throw new Error("Nama pekerjaan borongan wajib diisi.");
  }

  const supabase = await createClient();
  const [{ data: project, error: projectError }, { data: subcontractor, error: subcontractorError }] = await Promise.all([
    supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
    supabase
      .from("subcontractors")
      .select("id")
      .eq("id", input.subcontractorId)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
  ]);

  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (subcontractorError) throw new Error(`Gagal memvalidasi subkontraktor: ${subcontractorError.message}`);
  if (!project || !subcontractor) throw new Error("Proyek atau subkontraktor tidak ditemukan di organisasi ini.");

  const { error } = await supabase.from("subcontractor_contracts").insert({
    organization_id: user.organizationId,
    project_id: input.projectId,
    subcontractor_id: input.subcontractorId,
    description: input.description.trim(),
    contract_amount: input.contractAmount,
    created_by: user.profileId,
  });

  if (error) throw new Error(`Gagal menyimpan borongan: ${error.message}`);
  revalidatePath("/subcontractor-recap");
  revalidatePath("/cash-book");
  return { success: true };
}

export async function updateSubcontractorContract(input: {
  id: string;
  projectId: string;
  subcontractorId: string;
  description: string;
  contractAmount: number;
}) {
  const user = await requireAuthUser();
  if (!canManageContracts(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat mengubah borongan subkontraktor.");
  }
  if (!input.description.trim()) throw new Error("Nama pekerjaan borongan wajib diisi.");
  if (!Number.isFinite(input.contractAmount) || input.contractAmount <= 0) {
    throw new Error("Nilai borongan harus lebih besar dari 0.");
  }

  const supabase = await createClient();
  const { data: contract, error: contractError } = await supabase
    .from("subcontractor_contracts")
    .select("id, project_id, subcontractor_id")
    .eq("id", input.id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();
  if (contractError) throw new Error(`Gagal memuat borongan subkontraktor: ${contractError.message}`);
  if (!contract) throw new Error("Borongan subkontraktor tidak ditemukan.");

  const currentContract = (await getContractRows(user.organizationId))
    .find((row) => row.id === input.id);
  if (!currentContract) throw new Error("Data borongan subkontraktor tidak ditemukan.");
  if (input.contractAmount < currentContract.paidAmount) {
    throw new Error(
      `Nilai borongan tidak boleh lebih kecil dari pembayaran yang sudah dilakukan (${currentContract.paidAmount.toLocaleString("id-ID")}).`
    );
  }
  if (
    currentContract.paidAmount > 0 &&
    (contract.project_id !== input.projectId || contract.subcontractor_id !== input.subcontractorId)
  ) {
    throw new Error("Proyek atau subkontraktor tidak dapat diubah karena borongan sudah memiliki pembayaran.");
  }

  const [{ data: project, error: projectError }, { data: subcontractor, error: subcontractorError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id")
        .eq("id", input.projectId)
        .eq("organization_id", user.organizationId)
        .maybeSingle(),
      supabase
        .from("subcontractors")
        .select("id")
        .eq("id", input.subcontractorId)
        .eq("organization_id", user.organizationId)
        .maybeSingle(),
    ]);

  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (subcontractorError) throw new Error(`Gagal memvalidasi subkontraktor: ${subcontractorError.message}`);
  if (!project || !subcontractor) throw new Error("Proyek atau subkontraktor tidak ditemukan di organisasi ini.");

  const { data: updated, error } = await supabase
    .from("subcontractor_contracts")
    .update({
      project_id: input.projectId,
      subcontractor_id: input.subcontractorId,
      description: input.description.trim(),
      contract_amount: input.contractAmount,
    })
    .eq("id", input.id)
    .eq("organization_id", user.organizationId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Gagal memperbarui borongan subkontraktor: ${error.message}`);
  if (!updated) throw new Error("Borongan subkontraktor tidak ditemukan atau tidak dapat diubah.");

  revalidatePath("/subcontractor-recap");
  revalidatePath("/cash-book");
  return { success: true };
}

export async function deleteSubcontractorContract(id: string) {
  const user = await requireAuthUser();
  if (!canManageContracts(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat menghapus borongan subkontraktor.");
  }

  const contracts = await getContractRows(user.organizationId);
  const contract = contracts.find((row) => row.id === id);
  if (!contract) throw new Error("Borongan subkontraktor tidak ditemukan.");
  if (contract.paidAmount > 0) {
    throw new Error("Borongan sudah memiliki pembayaran dan tidak dapat dihapus.");
  }

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("subcontractor_contracts")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503") {
      throw new Error("Borongan masih terhubung ke transaksi Buku Kas dan tidak dapat dihapus.");
    }
    throw new Error(`Gagal menghapus borongan subkontraktor: ${error.message}`);
  }
  if (!deleted) throw new Error("Borongan subkontraktor tidak ditemukan atau tidak dapat dihapus.");

  revalidatePath("/subcontractor-recap");
  revalidatePath("/cash-book");
  return { success: true };
}
