"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import type { CashAdvanceStatus } from "@prisma/client";

export async function getCashAdvances(filters?: {
  status?: CashAdvanceStatus;
  employee_id?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("cash_advances")
    .select(`
      *,
      employee:profiles!employee_id(full_name, email)
    `)
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_advances")
    .select(`
      *,
      employee:profiles!employee_id(*),
      settlements:advance_settlements(*)
    `)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createCashAdvance(input: {
  date: string;
  employee_id: string;
  project_id?: string;
  purpose: string;
  amount: number;
  notes?: string;
}) {
  const user = await requireAuthUser();

  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Forbidden - You do not have permission to create cash advances");
  }

  const supabase = await createClient();

  // Generate number
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${(
    date.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}`;

  const { data: lastCA } = await supabase
    .from("cash_advances")
    .select("number")
    .eq("organization_id", user.organizationId)
    .like("number", `CA-${yearMonth}-%`)
    .order("number", { ascending: false })
    .limit(1);

  const nextNumber = lastCA && lastCA.length > 0
    ? parseInt(lastCA[0].number.split("-")[2]) + 1
    : 1;
  const number = `CA-${yearMonth}-${nextNumber
    .toString()
    .padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("cash_advances")
    .insert({
      organization_id: user.organizationId,
      number,
      date: input.date,
      employee_id: input.employee_id,
      project_id: input.project_id,
      purpose: input.purpose,
      amount: input.amount,
      status: "DRAFT",
      notes: input.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-advances");
  return data;
}

export async function submitCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("status, organization_id, employee_id")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Cash advance record not found");
  }

  if (existing.status !== "DRAFT") {
    throw new Error("Only draft cash advances can be submitted");
  }

  const { error } = await supabase
    .from("cash_advances")
    .update({ status: "SUBMITTED" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-advances");
  return { success: true };
}

export async function approveCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("status, organization_id, employee_id, amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Cash advance record not found");
  }

  if (existing.status !== "SUBMITTED") {
    throw new Error("Cash advance has not been submitted for review");
  }

  // Cannot approve own cash advance
  if (existing.employee_id === user.profileId) {
    throw new Error("You cannot authorize your own cash advance request");
  }

  const { error } = await supabase
    .from("cash_advances")
    .update({ status: "APPROVED" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-advances");
  return { success: true };
}

export async function disburseCashAdvance(id: string, cash_account_id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Forbidden - Only finance administrators can disburse cash advances");
  }

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("status, organization_id, amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Cash advance record not found");
  }

  if (existing.status !== "APPROVED") {
    throw new Error("Cash advance has not been authorized yet");
  }

  const { error } = await supabase
    .from("cash_advances")
    .update({
      status: "DISBURSED",
      disbursed_amount: existing.amount,
      cash_account_id,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-advances");
  return { success: true };
}

export async function settleCashAdvance(
  id: string,
  settlements: Array<{
    description: string;
    amount: number;
    type: "EXPENSE" | "RETURN";
    expense_id?: string;
  }>
) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("status, organization_id, amount, disbursed_amount, settled_amount, returned_amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Cash advance record not found");
  }

  if (existing.status !== "DISBURSED") {
    throw new Error("Cash advance has not been disbursed");
  }

  // Create settlement records
  const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
  const totalReturned = settlements
    .filter((s) => s.type === "RETURN")
    .reduce((sum, s) => sum + s.amount, 0);

  const newSettledAmount = Number(existing.settled_amount) + totalSettled;
  const newReturnedAmount = Number(existing.returned_amount) + totalReturned;
  const disbursedAmount = Number(existing.disbursed_amount);

  // Create settlement records
  for (const settlement of settlements) {
    await supabase.from("advance_settlements").insert({
      cash_advance_id: id,
      date: new Date().toISOString(),
      description: settlement.description,
      amount: settlement.amount,
      type: settlement.type,
      expense_id: settlement.expense_id,
      created_by: user.profileId,
    });
  }

  // Determine new status
  let newStatus: CashAdvanceStatus = "PARTIALLY_SETTLED";
  if (newSettledAmount + newReturnedAmount >= disbursedAmount) {
    newStatus = "SETTLED";
  }

  // Update cash advance
  await supabase.from("cash_advances").update({
    status: newStatus,
    settled_amount: newSettledAmount,
    returned_amount: newReturnedAmount,
  }).eq("id", id);

  revalidatePath("/cash-advances");
  return { success: true };
}

export async function deleteCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("cash_advances")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-advances");
  return { success: true };
}

export async function saveCashAdvanceRecord(input: {
  id?: string;
  number?: string;
  date: string;
  purpose: string;
  amount: number;
  status: CashAdvanceStatus;
  notes?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("cash_advances")
      .update({
        date: input.date,
        purpose: input.purpose,
        amount: input.amount,
        disbursed_amount:
          input.status === "DISBURSED" ||
          input.status === "PARTIALLY_SETTLED" ||
          input.status === "SETTLED"
            ? input.amount
            : 0,
        status: input.status,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("organization_id", user.organizationId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/cash-advances");
    return data;
  } else {
    const date = new Date(input.date || Date.now());
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const randNum = String(Math.floor(Math.random() * 9000) + 1000);
    const number = input.number || `CA-${yearMonth}-${randNum}`;

    const { data, error } = await supabase
      .from("cash_advances")
      .insert({
        organization_id: user.organizationId,
        number,
        date: input.date,
        employee_id: user.profileId || user.id,
        purpose: input.purpose,
        amount: input.amount,
        disbursed_amount:
          input.status === "DISBURSED" ||
          input.status === "PARTIALLY_SETTLED" ||
          input.status === "SETTLED"
            ? input.amount
            : 0,
        settled_amount: 0,
        returned_amount: 0,
        status: input.status,
        notes: input.notes,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/cash-advances");
    return data;
  }
}


