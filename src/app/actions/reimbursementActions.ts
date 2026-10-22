"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

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

  // Jika employee_id tidak diberikan, gunakan user id pembuat sebagai default claimant
  const employeeId = input.employee_id || user.id;

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

    revalidatePath("/reimbursements");
    return data;
  } else {
    // Generate nomor unik jika belum ada
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

    revalidatePath("/reimbursements");
    return data;
  }
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

  revalidatePath("/reimbursements");
  return { success: true };
}
