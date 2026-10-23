"use server";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  profileId: string;
  organizationId: string;
  role: Role;
  approvalLimit: number | null;
}

// Get authenticated user with organization context
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // The organization context is stored directly on the membership row.
  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("profile_id, organization_id, role, approval_limit")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Gagal memuat keanggotaan organisasi:", error);
    throw new Error("Gagal memuat keanggotaan organisasi.");
  }

  if (!membership) return null;

  return {
    id: user.id,
    email: user.email || "",
    profileId: membership.profile_id,
    organizationId: membership.organization_id,
    role: membership.role as Role,
    approvalLimit: membership.approval_limit
      ? Number(membership.approval_limit)
      : null,
  };
}

// Require authenticated user (throws if not authenticated)
export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized - Please login");
  }
  return user;
}

// Authorization check helper
export async function checkAuthorization(requiredRoles: Role[]): Promise<AuthUser> {
  const user = await requireAuthUser();
  if (!requiredRoles.includes(user.role)) {
    throw new Error("Forbidden - Insufficient permissions");
  }
  return user;
}
