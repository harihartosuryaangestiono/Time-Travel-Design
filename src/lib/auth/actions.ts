"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { User } from "@/types";

export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Check if profile exists, create if not
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile && data.user.email) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || null,
      });
    }

    // Check if user has organization membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("profile_id", data.user.id)
      .limit(1)
      .maybeSingle();

    // If no membership, return special flag to redirect to setup
    if (!membership) {
      revalidatePath("/", "layout");
      return { data, needsSetup: true };
    }
  }

  revalidatePath("/", "layout");
  return { data };
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  organizationName: string
) {
  const supabase = await createClient();

  // Check if email already exists
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return { error: "Email sudah terdaftar" };
  }

  // Create auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      email: email,
      full_name: fullName,
    });

    if (profileError) {
      return { error: "Gagal membuat profil" };
    }
  }

  revalidatePath("/", "layout");
  return { data };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function resetPassword(email: string) {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get profile safely
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email || profile?.email || "",
    full_name: profile?.full_name || undefined,
    phone: profile?.phone || undefined,
    avatar_url: profile?.avatar_url || undefined,
  } as User;
}

export async function getOrganizationMembership(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      *,
      profile:profiles(*),
      organization:organizations(*)
    `)
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}
