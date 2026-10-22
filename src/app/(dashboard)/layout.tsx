import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClientShell from "@/components/layout/DashboardClientShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Ensure user has at least one organization membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, organization_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/setup-organization");
  }

  return <DashboardClientShell>{children}</DashboardClientShell>;
}
