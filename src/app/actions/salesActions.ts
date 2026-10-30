"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { logAudit } from "@/lib/audit/auditLogger";
import { calculateSalesCommission } from "@/lib/accounting/salesCommission";

const canManageSalesPeople = (role: string) => ["OWNER", "FINANCE"].includes(role);

export interface SalesPersonProjectOption {
  salesPersonId: string;
  salesPersonName: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  contractValue: number;
  commissionRate: number;
  commissionAmount: number;
}

export interface SalesPersonAssignmentSummary extends SalesPersonProjectOption {
  paidAmount: number;
  bonusAmount: number;
  remainingAmount: number;
}

export interface SalesPersonSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bonusAmount: number;
  totalCommission: number;
  totalPaid: number;
  remainingAmount: number;
  assignments: SalesPersonAssignmentSummary[];
}

export async function getSalesPersonProjectOptions(): Promise<SalesPersonProjectOption[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const [{ data: people, error: peopleError }, { data: projects, error: projectsError },
    { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase
      .from("sales_persons")
      .select("id, name")
      .eq("organization_id", user.organizationId)
      .order("name"),
    supabase
      .from("projects")
      .select("id, code, name, contract_value")
      .eq("organization_id", user.organizationId)
      .order("name"),
    supabase
      .from("project_sales_assignments")
      .select("sales_person_id, project_id, commission_rate")
      .eq("organization_id", user.organizationId),
  ]);
  if (peopleError) throw new Error(`Gagal memuat sales person: ${peopleError.message}`);
  if (projectsError) throw new Error(`Gagal memuat proyek: ${projectsError.message}`);
  if (assignmentsError) throw new Error(`Gagal memuat penugasan sales: ${assignmentsError.message}`);

  const peopleById = new Map((people || []).map((person) => [person.id, person.name]));
  const projectsById = new Map((projects || []).map((project) => [project.id, project]));
  return (assignments || []).flatMap((assignment) => {
    const project = projectsById.get(assignment.project_id);
    const salesPersonName = peopleById.get(assignment.sales_person_id);
    if (!project || !salesPersonName) return [];
    const contractValue = Number(project.contract_value || 0);
    const commissionRate = Number(assignment.commission_rate || 0);
    return [{
      salesPersonId: assignment.sales_person_id,
      salesPersonName,
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      contractValue,
      commissionRate,
      commissionAmount: calculateSalesCommission(contractValue, commissionRate),
    }];
  });
}

export async function getSalesPersonOverview(): Promise<{
  people: SalesPersonSummary[];
  canManage: boolean;
}> {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const [{ data: people, error: peopleError }, { data: assignments, error: assignmentsError },
    { data: projects, error: projectsError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase
        .from("sales_persons")
        .select("id, name, phone, email")
        .eq("organization_id", user.organizationId)
        .order("name"),
      supabase
        .from("project_sales_assignments")
        .select("sales_person_id, project_id, commission_rate")
        .eq("organization_id", user.organizationId),
      supabase
        .from("projects")
        .select("id, name, code, contract_value")
        .eq("organization_id", user.organizationId),
      supabase
        .from("expenses")
        .select("sales_person_id, project_id, total_amount")
        .eq("organization_id", user.organizationId)
        .eq("category", "Marketing & Sales")
        .in("status", ["APPROVED", "POSTED"])
        .not("sales_person_id", "is", null),
    ]);

  if (peopleError) throw new Error(`Gagal memuat sales person: ${peopleError.message}`);
  if (assignmentsError) throw new Error(`Gagal memuat penugasan sales: ${assignmentsError.message}`);
  if (projectsError) throw new Error(`Gagal memuat nilai proyek: ${projectsError.message}`);
  if (paymentsError) throw new Error(`Gagal memuat pembayaran komisi: ${paymentsError.message}`);

  const projectsById = new Map((projects || []).map((project) => [project.id, project]));
  const peopleById = new Map((people || []).map((person) => [person.id, person.name]));
  const paidByAssignment = new Map<string, number>();
  (payments || []).forEach((payment) => {
    if (!payment.sales_person_id || !payment.project_id) return;
    const key = `${payment.sales_person_id}:${payment.project_id}`;
    paidByAssignment.set(
      key,
      (paidByAssignment.get(key) || 0) + Number(payment.total_amount || 0)
    );
  });
  const assignmentsByPerson = new Map<string, SalesPersonAssignmentSummary[]>();

  (assignments || []).forEach((assignment) => {
    const project = projectsById.get(assignment.project_id);
    if (!project) return;
    const commissionRate = Number(assignment.commission_rate || 0);
    const contractValue = Number(project.contract_value || 0);
    const commissionAmount = calculateSalesCommission(contractValue, commissionRate);
    const paidAmount = paidByAssignment.get(
      `${assignment.sales_person_id}:${assignment.project_id}`
    ) || 0;
    const summary: SalesPersonAssignmentSummary = {
      salesPersonId: assignment.sales_person_id,
      salesPersonName: peopleById.get(assignment.sales_person_id) || "",
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      contractValue,
      commissionRate,
      commissionAmount,
      paidAmount,
      bonusAmount: Math.max(0, paidAmount - commissionAmount),
      remainingAmount: Math.max(0, commissionAmount - paidAmount),
    };
    const entries = assignmentsByPerson.get(assignment.sales_person_id) || [];
    entries.push(summary);
    assignmentsByPerson.set(assignment.sales_person_id, entries);
  });

  const summaries = (people || []).map((person) => {
    const personAssignments = assignmentsByPerson.get(person.id) || [];
    const totalCommission = personAssignments.reduce((total, item) => total + item.commissionAmount, 0);
    const totalPaid = personAssignments.reduce((total, item) => total + item.paidAmount, 0);
    return {
      ...person,
      bonusAmount: personAssignments.reduce((total, item) => total + item.bonusAmount, 0),
      totalCommission,
      totalPaid,
      remainingAmount: personAssignments.reduce((total, item) => total + item.remainingAmount, 0),
      assignments: personAssignments,
    };
  });
  return {
    people: summaries,
    canManage: canManageSalesPeople(user.role),
  };
}

export async function saveSalesPerson(input: {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  assignments: Array<{ project_id: string; commission_rate: number }>;
}) {
  const user = await requireAuthUser();
  if (!canManageSalesPeople(user.role)) {
    throw new Error("Hanya Owner atau Finance yang dapat mengelola Sales Person.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Nama Sales Person wajib diisi.");
  if (input.assignments.some((assignment) =>
    !assignment.project_id ||
    !Number.isFinite(assignment.commission_rate) ||
    assignment.commission_rate < 0 ||
    assignment.commission_rate > 100
  )) {
    throw new Error("Proyek dan persentase komisi (0–100%) harus valid.");
  }
  if (new Set(input.assignments.map((assignment) => assignment.project_id)).size !== input.assignments.length) {
    throw new Error("Proyek yang sama tidak boleh ditambahkan dua kali untuk satu Sales Person.");
  }

  const supabase = await createClient();
  const projectIds = input.assignments.map((assignment) => assignment.project_id);
  if (projectIds.length) {
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id")
      .eq("organization_id", user.organizationId)
      .in("id", projectIds);
    if (projectsError) throw new Error(`Gagal memvalidasi proyek: ${projectsError.message}`);
    if (projects?.length !== projectIds.length) {
      throw new Error("Satu atau lebih proyek tidak ditemukan di organisasi Anda.");
    }
  }

  const personData = {
    name,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
  };
  const { data: person, error: personError } = input.id
    ? await supabase
        .from("sales_persons")
        .update(personData)
        .eq("id", input.id)
        .eq("organization_id", user.organizationId)
        .select("id, name")
        .maybeSingle()
    : await supabase
        .from("sales_persons")
        .insert({ ...personData, organization_id: user.organizationId })
        .select("id, name")
        .single();
  if (personError) throw new Error(`Gagal menyimpan Sales Person: ${personError.message}`);
  if (!person) throw new Error("Sales Person tidak ditemukan di organisasi Anda.");

  if (input.assignments.length) {
    const { error: assignmentsError } = await supabase
      .from("project_sales_assignments")
      .upsert(
        input.assignments.map((assignment) => ({
          organization_id: user.organizationId,
          sales_person_id: person.id,
          project_id: assignment.project_id,
          commission_rate: assignment.commission_rate,
        })),
        { onConflict: "sales_person_id,project_id" }
      );
    if (assignmentsError) {
      throw new Error(`Sales Person tersimpan, tetapi penugasan proyek gagal disimpan: ${assignmentsError.message}`);
    }
  }

  await logAudit(user, {
    action: input.id ? "UPDATE_SALES_PERSON" : "CREATE_SALES_PERSON",
    entityType: "SalesPerson",
    entityId: person.id,
    metadata: {
      name: person.name,
      phone: personData.phone,
      assignment_count: input.assignments.length,
    },
  });

  revalidatePath("/sales-persons");
  revalidatePath("/cash-book");
  return { success: true, id: person.id };
}