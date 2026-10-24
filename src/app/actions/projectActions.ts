"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import type { ProjectType, ProjectStatus } from "@prisma/client";

type ProjectActionResult<T> = { data: T; error?: never } | { data?: never; error: string };

const canManageProjects = (role: string) =>
  ["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(role);

export async function getProjects() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getProject(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      client:clients(*),
      budget_versions(*,
        items:budget_items(*)
      ),
      members:project_members(
        *,
        member:organization_members(
          *,
          profile:profiles(*)
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

export async function createProject(input: {
  code: string;
  name: string;
  client_id?: string;
  type: ProjectType;
  building_function?: string;
  work_category?: string;
  status?: ProjectStatus;
  location?: string;
  start_date?: string;
  end_date?: string;
  contract_value?: number;
  description?: string;
}): Promise<ProjectActionResult<Record<string, unknown>>> {
  const user = await requireAuthUser();

  if (!canManageProjects(user.role)) {
    return { error: "Anda tidak memiliki izin untuk membuat proyek." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...input,
      organization_id: user.organizationId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Kode proyek sudah digunakan. Gunakan kode lain." };
    }
    return { error: `Gagal membuat proyek: ${error.message}` };
  }

  revalidatePath("/projects");
  return { data };
}

export async function updateProject(
  id: string,
  input: {
    code?: string;
    name?: string;
    client_id?: string;
    type?: ProjectType;
    building_function?: string;
    work_category?: string;
    status?: ProjectStatus;
    location?: string;
    start_date?: string;
    end_date?: string;
    contract_value?: number;
    description?: string;
  }
): Promise<ProjectActionResult<Record<string, unknown>>> {
  const user = await requireAuthUser();
  if (!canManageProjects(user.role)) {
    return { error: "Anda tidak memiliki izin untuk mengubah proyek." };
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (existingError) {
    return { error: `Gagal memeriksa proyek: ${existingError.message}` };
  }
  if (!existing) {
    return { error: "Proyek tidak ditemukan di organisasi Anda." };
  }

  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .select()
    .maybeSingle();

  if (error) {
    return { error: `Gagal memperbarui proyek: ${error.message}` };
  }
  if (!data) {
    return { error: "Proyek tidak berubah. Periksa izin edit dan kebijakan database organisasi." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { data };
}

export async function deleteProject(id: string) {
  const user = await requireAuthUser();

  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Forbidden - You do not have permission to delete projects");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  return { success: true };
}
