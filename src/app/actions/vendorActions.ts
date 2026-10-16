"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export interface VendorInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
}

export async function createVendorRecord(input: VendorInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      organization_id: user.organizationId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      tax_id: input.tax_id || null,
      bank_name: input.bank_name || null,
      bank_account: input.bank_account || null,
      bank_holder: input.bank_holder || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/vendors");
  return data;
}

export async function updateVendorRecord(id: string, input: Partial<VendorInput>) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .update(input)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/vendors");
  return data;
}

export async function deleteVendorRecord(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/vendors");
  return { success: true };
}
