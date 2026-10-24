"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  Camera,
  Check,
  Loader2,
  LogOut,
  LockKeyhole,
  Save,
  UserRound,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred.";

export default function UserSettingsContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({ full_name: "", phone: "" });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Your session has expired. Please sign in again.");

        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone, avatar_url")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        if (!isMounted) return;

        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          phone: data.phone || "",
        });
      } catch (error) {
        if (isMounted) setErrorMessage(getErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(profile?.avatar_url || "");
      return;
    }

    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile, profile?.avatar_url]);

  const handleAvatarChange = (file: File | undefined) => {
    setProfileMessage("");
    setErrorMessage("");
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarFile(null);
      setErrorMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFile(null);
      setErrorMessage("The profile picture must be 5 MB or smaller.");
      return;
    }
    setAvatarFile(file);
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const fullName = formData.full_name.trim();
    if (!fullName) {
      setErrorMessage("Please enter your name.");
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage("");
    setErrorMessage("");

    try {
      const supabase = createClient();
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(`${profile.id}/avatar`, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;

        avatarUrl = `${supabase.storage
          .from("avatars")
          .getPublicUrl(`${profile.id}/avatar`).data.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: formData.phone.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id);
      if (error) throw error;

      setProfile({ ...profile, full_name: fullName, phone: formData.phone.trim() || null, avatar_url: avatarUrl });
      setAvatarFile(null);
      setProfileMessage("Your profile has been updated.");
      window.dispatchEvent(new Event("profile-updated"));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage("");
    setErrorMessage("");

    if (passwordData.newPassword.length < 8) {
      setErrorMessage("Your new password must be at least 8 characters.");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      if (error) throw error;

      setPasswordData({ newPassword: "", confirmPassword: "" });
      setPasswordMessage("Your password has been changed.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingPassword(false);
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          My Profile
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Update your name, profile picture, and account password.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {profileMessage && (
          <div role="status" className="mx-6 mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {profileMessage}
          </div>
        )}
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-zinc-500">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Profile picture preview"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <UserRound className="h-8 w-8" />
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                <Camera className="h-4 w-4" />
                Choose profile picture
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    handleAvatarChange(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <p className="mt-1.5 text-[11px] text-zinc-400">JPG, PNG, or WebP. Maximum 5 MB.</p>
            </div>
          </div>

          <div>
            <label htmlFor="full_name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Name
            </label>
            <input
              id="full_name"
              type="text"
              required
              maxLength={120}
              value={formData.full_name}
              onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="profile_email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Email
            </label>
            <input
              id="profile_email"
              type="email"
              value={profile?.email || ""}
              disabled
              className="block w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="profile_phone" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Phone / WhatsApp
            </label>
            <input
              id="profile_phone"
              type="tel"
              value={formData.phone}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              placeholder="+62 812-xxxx-xxxx"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-100 bg-zinc-50 px-6 py-4">
          <button
            type="submit"
            disabled={isSavingProfile || !profile}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-95 disabled:opacity-50"
          >
            {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
          <h3 className="text-sm font-bold text-zinc-900">Change Password</h3>
          <p className="mt-1 text-xs text-zinc-500">Use at least 8 characters for your new password.</p>
        </div>
        {passwordMessage && (
          <div role="status" className="mx-6 mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            <Check className="h-4 w-4" />
            {passwordMessage}
          </div>
        )}
        <div className="space-y-4 p-6">
          <div>
            <label htmlFor="new_password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              New Password
            </label>
            <input
              id="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={passwordData.newPassword}
              onChange={(event) => setPasswordData({ ...passwordData, newPassword: event.target.value })}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>
          <div>
            <label htmlFor="confirm_password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Confirm New Password
            </label>
            <input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={passwordData.confirmPassword}
              onChange={(event) => setPasswordData({ ...passwordData, confirmPassword: event.target.value })}
              className="block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-zinc-100 bg-zinc-50 px-6 py-4">
          <button
            type="submit"
            disabled={isSavingPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-95 disabled:opacity-50"
          >
            {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Change Password
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
          <h3 className="text-sm font-bold text-zinc-900">Sign Out</h3>
          <p className="mt-1 text-xs text-zinc-500">End your current account session.</p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
