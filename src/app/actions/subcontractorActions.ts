"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";

export interface SubcontractorContractSummary {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  vendorId: string;
  vendorName: string;
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
    .select("id, project_id, vendor_id, description, contract_amount")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (contractsError) throw new Error(`Gagal memuat kontrak subkontraktor: ${contractsError.message}`);
  if (!contracts?.length) return [];

  const projectIds = Array.from(new Set(contracts.map((contract) => contract.project_id)));
  const vendorIds = Array.from(new Set(contracts.map((contract) => contract.vendor_id)));
  const contractIds = contracts.map((contract) => contract.id);

  const [
    { data: projects, error: projectsError },
    { data: vendors, error: vendorsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, code").eq("organization_id", organizationId).in("id", projectIds),
    supabase.from("vendors").select("id, name").eq("organization_id", organizationId).in("id", vendorIds),
    supabase
      .from("expenses")
      .select("subcontractor_contract_id, project_id, merchant, description, category, total_amount")
      .eq("organization_id", organizationId)
      .in("project_id", projectIds)
      .in("status", ["APPROVED", "POSTED"]),
  ]);

  if (projectsError) throw new Error(`Gagal memuat proyek subkontraktor: ${projectsError.message}`);
  if (vendorsError) throw new Error(`Gagal memuat vendor subkontraktor: ${vendorsError.message}`);
  if (paymentsError) throw new Error(`Gagal memuat pembayaran subkontraktor: ${paymentsError.message}`);

  const projectById = new Map((projects || []).map((project) => [project.id, project]));
  const vendorById = new Map((vendors || []).map((vendor) => [vendor.id, vendor]));
  const paidByContract = new Map<string, number>();
  const contractsByProjectVendor = new Map<string, typeof contracts>();
  contracts.forEach((contract) => {
    const key = `${contract.project_id}:${contract.vendor_id}`;
    const group = contractsByProjectVendor.get(key) || [];
    group.push(contract);
    contractsByProjectVendor.set(key, group);
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
      const key = `${contract.project_id}:${contract.vendor_id}`;
      const sameProjectVendorContracts = contractsByProjectVendor.get(key) || [];
      const vendor = vendorById.get(contract.vendor_id);
      const vendorName = normalizeMatchText(vendor?.name);
      if (sameProjectVendorContracts.length !== 1 || !vendorName) return false;
      return paymentMerchant === vendorName || paymentDescription.includes(` ${vendorName} `);
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
    const vendor = vendorById.get(contract.vendor_id);
    if (!project || !vendor) {
      throw new Error(`Data proyek atau vendor untuk kontrak ${contract.id} tidak ditemukan.`);
    }
    const contractAmount = Number(contract.contract_amount || 0);
    const paidAmount = paidByContract.get(contract.id) || 0;
    return {
      id: contract.id,
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      vendorId: vendor.id,
      vendorName: vendor.name,
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
  const [contracts, { data: projects, error: projectsError }, { data: vendors, error: vendorsError }] =
    await Promise.all([
      getContractRows(user.organizationId),
      supabase.from("projects").select("id, name, code").eq("organization_id", user.organizationId).order("name"),
      supabase.from("vendors").select("id, name").eq("organization_id", user.organizationId).order("name"),
    ]);

  if (projectsError) throw new Error(`Gagal memuat daftar proyek: ${projectsError.message}`);
  if (vendorsError) throw new Error(`Gagal memuat daftar vendor: ${vendorsError.message}`);

  return {
    contracts,
    projects: projects || [],
    vendors: vendors || [],
    canManage: canManageContracts(user.role),
  };
}

export async function getSubcontractorPaymentOptions(): Promise<SubcontractorContractSummary[]> {
  const user = await requireAuthUser();
  return getContractRows(user.organizationId);
}

export async function createSubcontractorContract(input: {
  projectId: string;
  vendorId: string;
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
  const [{ data: project, error: projectError }, { data: vendor, error: vendorError }] = await Promise.all([
    supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
    supabase
      .from("vendors")
      .select("id")
      .eq("id", input.vendorId)
      .eq("organization_id", user.organizationId)
      .maybeSingle(),
  ]);

  if (projectError) throw new Error(`Gagal memvalidasi proyek: ${projectError.message}`);
  if (vendorError) throw new Error(`Gagal memvalidasi vendor: ${vendorError.message}`);
  if (!project || !vendor) throw new Error("Proyek atau vendor tidak ditemukan di organisasi ini.");

  const { error } = await supabase.from("subcontractor_contracts").insert({
    organization_id: user.organizationId,
    project_id: input.projectId,
    vendor_id: input.vendorId,
    description: input.description.trim(),
    contract_amount: input.contractAmount,
    created_by: user.profileId,
  });

  if (error) throw new Error(`Gagal menyimpan borongan: ${error.message}`);
  revalidatePath("/subcontractor-recap");
  revalidatePath("/cash-book");
  return { success: true };
}
