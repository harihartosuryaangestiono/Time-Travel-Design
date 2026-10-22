"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await resetPassword(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim link pemulihan kata sandi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FBFBFC]">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-10 inline-block focus:outline-none">
            <BrandLogo variant="full" color="dark" size="lg" />
          </Link>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Reset Password
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Masukkan email akun Anda untuk menerima tautan pemulihan kata sandi.
            </p>
          </div>

          {success ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-3" />
              <h3 className="text-base font-semibold text-emerald-900">Email Pemulihan Terkirim</h3>
              <p className="mt-2 text-xs leading-relaxed text-emerald-700">
                Silakan periksa kotak masuk atau spam email <strong>{email}</strong> dan klik tautan untuk membuat kata sandi baru.
              </p>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke halaman Masuk
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
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Email Akun
                </label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 shadow-sm transition-all focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    placeholder="nama@timetraveldesign.id"
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
                    <span>Mengirim Tautan...</span>
                  </>
                ) : (
                  <span>Kirim Tautan Reset Password</span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Kembali ke Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Right: Design Branding Panel */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-[#0F172A] p-12 xl:p-16 flex flex-col justify-between text-white overflow-hidden">
          <div className="relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              Account Security
            </span>
            <h1 className="mt-4 text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
              Akses Aman Sistem Keuangan Time Travel Design
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
