"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2, Lock } from "lucide-react";
import { updatePassword } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Gagal memperbarui kata sandi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FBFBFC]">
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-10 inline-block focus:outline-none">
            <BrandLogo variant="full" color="dark" size="lg" />
          </Link>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Buat Kata Sandi Baru
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Silakan masukkan kata sandi baru untuk akun Anda.
            </p>
          </div>

          {success ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-3" />
              <h3 className="text-base font-semibold text-emerald-900">Kata Sandi Berhasil Diperbarui</h3>
              <p className="mt-2 text-xs leading-relaxed text-emerald-700">
                Anda akan dialihkan ke halaman masuk dalam beberapa detik...
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 underline"
                >
                  Klik di sini jika tidak dialihkan otomatis
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Kata Sandi Baru
                </label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 py-2.5 text-sm text-zinc-900 shadow-sm transition-all focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Konfirmasi Kata Sandi Baru
                </label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 shadow-sm transition-all focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    placeholder="Ulangi kata sandi baru"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan Kata Sandi...</span>
                  </>
                ) : (
                  <span>Simpan Kata Sandi Baru</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-[#0F172A] p-12 xl:p-16 flex flex-col justify-between text-white overflow-hidden">
          <div className="relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              Security Update
            </span>
            <h1 className="mt-4 text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
              Perbarui Kata Sandi Akun
            </h1>
          </div>
          <div className="relative z-10 text-xs text-zinc-400">
            © {new Date().getFullYear()} PT. Ruma Inovasi Indonesia
          </div>
        </div>
      </div>
    </div>
  );
}
