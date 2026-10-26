"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";

function ensureCanCleanDrafts(role: string) {
  if (role !== "OWNER" && role !== "FINANCE") {
    throw new Error("Hanya Owner atau Finance yang dapat menghapus voucher Draft.");
  }
}

export async function getDraftExpenseCleanupPreview() {
  const user = await requireAuthUser();
  if (user.role !== "OWNER" && user.role !== "FINANCE") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, total_amount")
    .eq("organization_id", user.organizationId)
    .eq("status", "DRAFT");

  if (error) {
    throw new Error(`Gagal memeriksa voucher Draft: ${error.message}`);
  }

  return {
    count: data?.length || 0,
    totalAmount: (data || []).reduce((total, expense) => total + Number(expense.total_amount || 0), 0),
  };
}

export async function deleteOrganizationDraftExpenses() {
  const user = await requireAuthUser();
  ensureCanCleanDrafts(user.role);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_organization_draft_expenses");
  if (error) {
    throw new Error(`Gagal menghapus voucher Draft: ${error.message}`);
  }

  revalidatePath("/cash-book");
  revalidatePath("/projects");
  revalidatePath("/reports/rekapitulasi");
  revalidatePath("/dashboard");

  return { deletedCount: Number(data || 0) };
}
