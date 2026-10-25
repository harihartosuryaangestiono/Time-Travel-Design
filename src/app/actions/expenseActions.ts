"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import type { ExpenseStatus } from "@prisma/client";
import { validateExpenseBookCategory } from "@/lib/accounting/expenseCategories";

export async function getExpenses(filters?: {
  status?: ExpenseStatus;
  project_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(`
      *,
      profile:profiles!submitted_by(full_name, email),
      cash_account:cash_accounts(name),
      allocations:expense_allocations(
        *,
        project:projects(id, name, code)
      )
    `)
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.project_id) {
    query = query.eq("allocations.project_id", filters.project_id);
  }

  if (filters?.start_date) {
    query = query.gte("date", filters.start_date);
  }

  if (filters?.end_date) {
    query = query.lte("date", filters.end_date);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getExpense(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select(`
      *,
      profile:profiles!submitted_by(*),
      receipt:receipts(*),
      cash_account:cash_accounts(*),
      allocations:expense_allocations(
        *,
        project:projects(*)
      ),
      approvals:approvals(
        *,
        approver:organization_members(
          *,
          profile:profiles(full_name)
        )
      )
    `)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createExpense(input: {
  date: string;
  merchant?: string;
  description: string;
  amount: number;
  tax_amount?: number;
  payment_method?: string;
  cash_account_id?: string;
  category: string;
  category_id?: string;
  project_id?: string | null;
  project_allocations: Array<{
    project_id: string;
    amount: number;
    description?: string;
  }>;
  notes?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const projectIds = Array.from(
    new Set([
      ...input.project_allocations.map((allocation) => allocation.project_id),
      ...(input.project_id ? [input.project_id] : []),
    ])
  );
  const categoryError = validateExpenseBookCategory(
    input.category,
    projectIds.length ? "PROJECT" : "GENERAL"
  );
  if (categoryError) throw new Error(categoryError);

  // Generate expense number
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;

  const { data: lastExpense } = await supabase
    .from("expenses")
    .select("number")
    .eq("organization_id", user.organizationId)
    .like("number", `EXP-${yearMonth}-%`)
    .order("number", { ascending: false })
    .limit(1);

  const nextNumber = lastExpense && lastExpense.length > 0
    ? parseInt(lastExpense[0].number.split("-")[2]) + 1
    : 1;
  const number = `EXP-${yearMonth}-${nextNumber.toString().padStart(4, "0")}`;

  // Calculate total
  const totalAmount = input.amount + (input.tax_amount || 0);
  if (projectIds.length) {
    const { data: validProjects, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("organization_id", user.organizationId)
      .in("id", projectIds);

    if (projectError) {
      throw new Error(`Gagal memvalidasi proyek pengeluaran: ${projectError.message}`);
    }
    if ((validProjects || []).length !== projectIds.length) {
      throw new Error("Satu atau lebih proyek pengeluaran tidak valid atau bukan milik organisasi ini.");
    }
  }

  // Create expense
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      organization_id: user.organizationId,
      number,
      date: input.date,
      merchant: input.merchant,
      description: input.description,
      amount: input.amount,
      tax_amount: input.tax_amount || 0,
      total_amount: totalAmount,
      payment_method: input.payment_method,
      cash_account_id: input.cash_account_id,
      category: input.category,
      category_id: input.category_id,
      project_id: projectIds.length === 1 ? projectIds[0] : null,
      status: "DRAFT",
      submitted_by: user.profileId,
      notes: input.notes,
    })
    .select()
    .single();

  if (expenseError) {
    throw new Error(expenseError.message);
  }

  // Create allocations
  if (input.project_allocations.length > 0) {
    const { error: allocationError } = await supabase
      .from("expense_allocations")
      .insert(
        input.project_allocations.map((alloc) => ({
          expense_id: expense.id,
          project_id: alloc.project_id,
          amount: alloc.amount,
          description: alloc.description,
        }))
      );

    if (allocationError) {
      // Rollback expense
      await supabase.from("expenses").delete().eq("id", expense.id);
      throw new Error(allocationError.message);
    }
  }

  revalidatePath("/expenses");
  return expense;
}

export async function updateExpense(
  id: string,
  input: {
    date?: string;
    merchant?: string;
    description?: string;
    amount?: number;
    tax_amount?: number;
    payment_method?: string;
    cash_account_id?: string;
    category?: string;
    category_id?: string;
    project_id?: string | null;
    project_allocations?: Array<{
      project_id: string;
      amount: number;
      description?: string;
    }>;
    notes?: string;
  }
) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Check expense exists and is draft
  const { data: existing } = await supabase
    .from("expenses")
    .select("status, organization_id, submitted_by, project_id")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Expense voucher not found");
  }

  if (existing.status !== "DRAFT") {
    throw new Error("Only draft expense vouchers can be modified");
  }

  const { project_allocations, ...expenseInput } = input;
  let existingProjectIds = existing.project_id ? [existing.project_id] : [];
  if (
    input.project_id === undefined &&
    input.project_allocations === undefined &&
    existingProjectIds.length === 0
  ) {
    const { data: existingAllocations, error: allocationsError } = await supabase
      .from("expense_allocations")
      .select("project_id")
      .eq("expense_id", id);
    if (allocationsError) {
      throw new Error(`Gagal memeriksa alokasi proyek pengeluaran: ${allocationsError.message}`);
    }
    existingProjectIds = Array.from(
      new Set((existingAllocations || []).map((allocation) => allocation.project_id))
    );
  }
  const projectIds = input.project_allocations !== undefined
    ? Array.from(
        new Set([
          ...input.project_allocations.map((allocation) => allocation.project_id),
          ...(input.project_id ? [input.project_id] : []),
        ])
      )
    : input.project_id !== undefined
      ? input.project_id ? [input.project_id] : []
      : existingProjectIds;
  if (input.category !== undefined) {
    const categoryError = validateExpenseBookCategory(
      input.category,
      projectIds.length ? "PROJECT" : "GENERAL"
    );
    if (categoryError) throw new Error(categoryError);
  }
  if (project_allocations) {
    if (projectIds.length) {
      const { data: validProjects, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", user.organizationId)
        .in("id", projectIds);

      if (projectError) {
        throw new Error(`Gagal memvalidasi proyek pengeluaran: ${projectError.message}`);
      }
      if ((validProjects || []).length !== projectIds.length) {
        throw new Error("Satu atau lebih proyek pengeluaran tidak valid atau bukan milik organisasi ini.");
      }
    }
  }

  // Calculate total if amount changes
  let totalAmount = undefined;
  if (input.amount !== undefined) {
    const taxAmount = input.tax_amount ?? 0;
    totalAmount = input.amount + taxAmount;
  }

  // Update expense
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .update({
      ...expenseInput,
      project_id: projectIds.length === 1 ? projectIds[0] : null,
      total_amount: totalAmount,
    })
    .eq("id", id)
    .select()
    .single();

  if (expenseError) {
    throw new Error(expenseError.message);
  }

  // Update allocations if provided
  if (project_allocations) {
    // Delete existing allocations
    const { error: deleteAllocationsError } = await supabase
      .from("expense_allocations")
      .delete()
      .eq("expense_id", id);

    if (deleteAllocationsError) {
      throw new Error(`Pengeluaran tersimpan, tetapi alokasi proyek lama gagal dihapus: ${deleteAllocationsError.message}`);
    }

    // Create new allocations
    if (project_allocations.length > 0) {
      const { error: allocationError } = await supabase.from("expense_allocations").insert(
        project_allocations.map((alloc) => ({
          expense_id: id,
          project_id: alloc.project_id,
          amount: alloc.amount,
          description: alloc.description,
        }))
      );
      if (allocationError) {
        throw new Error(`Pengeluaran tersimpan, tetapi alokasi proyek gagal diperbarui: ${allocationError.message}`);
      }
    }
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return expense;
}

export async function submitExpense(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Check expense exists and is draft
  const { data: existing } = await supabase
    .from("expenses")
    .select("status, organization_id, submitted_by, total_amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Expense voucher not found");
  }

  if (existing.status !== "DRAFT") {
    throw new Error("Only draft expense vouchers can be submitted");
  }

  // Check if allocations total matches expense amount
  const { data: allocations } = await supabase
    .from("expense_allocations")
    .select("amount")
    .eq("expense_id", id);

  const allocTotal = allocations?.reduce((sum, a) => sum + Number(a.amount), 0) || 0;
  const expenseAmount = Number(existing.total_amount);

  if (allocations && allocations.length > 0 && allocTotal !== expenseAmount) {
    throw new Error(
      `Total project allocation (${allocTotal.toLocaleString("en-US")}) does not match voucher amount (${expenseAmount.toLocaleString("en-US")})`
    );
  }

  const { error } = await supabase
    .from("expenses")
    .update({ status: "SUBMITTED" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return { success: true };
}

export async function approveExpense(id: string, comments?: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Check expense exists and is submitted
  const { data: existing } = await supabase
    .from("expenses")
    .select("status, organization_id, total_amount, submitted_by")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Expense voucher not found");
  }

  if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_REVIEW") {
    throw new Error("Expense voucher is not pending approval or cannot be authorized");
  }

  // Cannot approve own expense
  if (existing.submitted_by === user.profileId) {
    throw new Error("You cannot authorize your own submitted expense voucher");
  }

  // Create approval record
  const { error: approvalError } = await supabase.from("approvals").insert({
    expense_id: id,
    approver_id: user.id, // Note: should be member_id, not user id
    action: "APPROVED",
    action_date: new Date().toISOString(),
    comments,
  });

  if (approvalError) {
    throw new Error(approvalError.message);
  }

  // Update expense status
  const { error: updateError } = await supabase
    .from("expenses")
    .update({ status: "APPROVED" })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/approvals");
  return { success: true };
}

export async function rejectExpense(id: string, reason: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!reason || reason.trim() === "") {
    throw new Error("Rejection rationale is required");
  }

  // Check expense exists and is submitted
  const { data: existing } = await supabase
    .from("expenses")
    .select("status, organization_id, submitted_by")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Expense voucher not found");
  }

  if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_REVIEW") {
    throw new Error("Expense voucher is not pending approval or cannot be rejected");
  }

  // Create approval record with rejection
  await supabase.from("approvals").insert({
    expense_id: id,
    approver_id: user.id,
    action: "REJECTED",
    action_date: new Date().toISOString(),
    comments: reason,
  });

  // Update expense status
  await supabase
    .from("expenses")
    .update({ status: "REJECTED" })
    .eq("id", id);

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/approvals");
  return { success: true };
}

export async function deleteExpense(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/expenses");
  return { success: true };
}
