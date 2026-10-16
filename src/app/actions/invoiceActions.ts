"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export interface InvoiceInput {
  number: string;
  invoice_date: string;
  due_date: string;
  client_id?: string;
  project_id?: string;
  total: number;
  amount_paid?: number;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE";
  notes?: string;
}

export async function createInvoiceRecord(input: InvoiceInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: user.organizationId,
      number: input.number,
      invoice_date: input.invoice_date,
      due_date: input.due_date,
      client_id: input.client_id || null,
      project_id: input.project_id || null,
      subtotal: input.total,
      total: input.total,
      amount_paid: input.amount_paid || 0,
      status: input.status,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/invoices");
  return data;
}

export async function updateInvoiceRecord(id: string, input: Partial<InvoiceInput>) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update(input)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/invoices");
  return data;
}

export async function deleteInvoiceRecord(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/invoices");
  return { success: true };
}
