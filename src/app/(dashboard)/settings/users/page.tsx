"use client";

import { useState, useEffect } from "react";
import { Save, LogOut, Loader2, User } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UserSettingsContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", phone: "" });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setFormData({
        full_name: data?.full_name || "",
        phone: data?.phone || "",
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: formData.full_name || null,
        phone: formData.phone || null,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-950" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          Personal Profile &amp; Account
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Manage your full name, direct contact phone, and account security preferences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        {saved && (
          <div className="mx-6 mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            Profile specifications saved successfully
          </div>
        )}

        <div className="space-y-4 p-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              placeholder="e.g. Alexander Hamilton"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Corporate Email
            </label>
            <input
              type="email"
              value={profile?.email || ""}
              disabled
              className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-500 cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Primary email is verified by your organization directory
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Direct Telephone / WhatsApp
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              placeholder="+62 812-xxxx-xxxx"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-100 bg-zinc-50 px-6 py-4">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-all active:scale-95"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Profile
          </button>
        </div>
      </form>

      {/* Sign Out */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 px-6 py-4 bg-zinc-50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Sign Out of Workspace Session
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Safely terminate your current active accounting authentication session
          </p>
        </div>
        <div className="p-6">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
