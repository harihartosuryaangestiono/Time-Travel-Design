"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";

export interface ClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  tax_id?: string;
}

export async function createClientRecord(input: ClientInput) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: user.organizationId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      contact_person: input.contact_person || null,
      tax_id: input.tax_id || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects/clients");
  return data;
}

export async function updateClientRecord(id: string, input: Partial<ClientInput>) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .update(input)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects/clients");
  return data;
}

export async function deleteClientRecord(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects/clients");
  return { success: true };
}
