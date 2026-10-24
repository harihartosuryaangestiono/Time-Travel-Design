"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import type { ProjectType, ProjectStatus } from "@prisma/client";

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
  status?: ProjectStatus;
  location?: string;
  start_date?: string;
  end_date?: string;
  contract_value?: number;
  description?: string;
}) {
  const user = await requireAuthUser();

  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Forbidden - You do not have permission to create projects");
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
      throw new Error("Project code is already in use");
    }
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  return data;
}

export async function updateProject(
  id: string,
  input: {
    code?: string;
    name?: string;
    client_id?: string;
    type?: ProjectType;
    status?: ProjectStatus;
    location?: string;
    start_date?: string;
    end_date?: string;
    contract_value?: number;
    description?: string;
  }
) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Check authorization
  const { data: existing } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Forbidden - Project not found");
  }

  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return data;
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
