"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";

export interface ReimbursementInput {
  id?: string;
  number?: string;
  date: string;
  description: string;
  amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  employee_id?: string;
  notes?: string;
}

export async function getReimbursements() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reimbursements")
    .select(`
      *,
      employee:profiles!employee_id(full_name, email)
    `)
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function saveReimbursementRecord(input: ReimbursementInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const employeeId = input.employee_id || user.profileId || user.id;

  if (input.id) {
    // Update
    const { data, error } = await supabase
      .from("reimbursements")
      .update({
        description: input.description,
        amount: input.amount,
        date: new Date(input.date).toISOString(),
        status: input.status,
        notes: input.notes || null,
        paid_date: input.status === "PAID" ? new Date().toISOString() : null,
        paid_amount: input.status === "PAID" ? input.amount : 0,
      })
      .eq("id", input.id)
      .eq("organization_id", user.organizationId)
      .select(`
        *,
        employee:profiles!employee_id(full_name, email)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logAudit(user, {
      action: "UPDATE_REIMBURSEMENT",
      entityType: "REIMBURSEMENT",
      entityId: input.id,
      metadata: { description: input.description, amount: input.amount, status: input.status },
    });

    revalidatePath("/reimbursements");
    return data;
  } else {
    let docNumber = input.number;
    if (!docNumber) {
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 9000) + 1000);
      docNumber = `RMB-${year}-${randNum}`;
    }

    const { data, error } = await supabase
      .from("reimbursements")
      .insert({
        organization_id: user.organizationId,
        number: docNumber,
        date: new Date(input.date).toISOString(),
        employee_id: employeeId,
        amount: input.amount,
        description: input.description,
        status: input.status || "SUBMITTED",
        notes: input.notes || null,
        paid_amount: 0,
      })
      .select(`
        *,
        employee:profiles!employee_id(full_name, email)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logAudit(user, {
      action: "CREATE_REIMBURSEMENT",
      entityType: "REIMBURSEMENT",
      entityId: data.id,
      metadata: { number: docNumber, amount: input.amount },
    });

    revalidatePath("/reimbursements");
    return data;
  }
}

/**
 * Approve Reimbursement dengan aturan self-approval protection:
 * Pengaju tidak boleh menyetujui klaimnya sendiri.
 */
export async function approveReimbursement(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Anda tidak memiliki wewenang untuk menyetujui reimbursement.");
  }

  const { data: existing } = await supabase
    .from("reimbursements")
    .select("id, number, amount, employee_id, organization_id, status")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data reimbursement tidak ditemukan.");
  }

  // ATURAN: Larang approve pengajuan sendiri
  const actorId = user.profileId || user.id;
  if (existing.employee_id === actorId || existing.employee_id === user.id) {
    throw new Error("Anda tidak diperkenankan menyetujui pengajuan reimbursement Anda sendiri.");
  }

  const { error } = await supabase
    .from("reimbursements")
    .update({
      status: "APPROVED",
      approved_by: actorId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "APPROVE_REIMBURSEMENT",
    entityType: "REIMBURSEMENT",
    entityId: id,
    metadata: { number: existing.number, amount: existing.amount },
  });

  revalidatePath("/reimbursements");
  return { success: true };
}

export async function deleteReimbursementRecord(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("reimbursements")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "DELETE_REIMBURSEMENT",
    entityType: "REIMBURSEMENT",
    entityId: id,
  });

  revalidatePath("/reimbursements");
  return { success: true };
}
