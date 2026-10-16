"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { signUp } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Password confirmation does not match");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must contain at least 8 characters");
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        ""
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "An error occurred during account creation");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFC] px-4">
        <div className="w-full max-w-md text-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Registration Successful</h2>
          <p className="mt-2 text-xs text-zinc-500">
            Your team account has been initialized. Redirecting you to the sign-in portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FBFBFC]">
      {/* Left: Luxury Architectural Visual Banner */}
      <div className="hidden flex-1 relative overflow-hidden bg-[#09090B] lg:flex lg:flex-col lg:justify-between lg:p-16 border-r border-zinc-800/80">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-zinc-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo variant="icon" color="white" size="md" />
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Team &amp; Partner Portal
          </span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-3xl lg:text-4xl font-light tracking-tight text-white leading-tight">
            Join <br />
            <span className="font-semibold text-zinc-100">Time Travel Design Finance</span>
          </h2>
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            Centralized fiscal administration platform for architects, quantity surveyors, project directors, and executive leadership.
          </p>

          <div className="mt-10 space-y-3">
            {[
              "Role-based authorization aligned with project fiduciary levels",
              "Transparent field advance disbursements & structured approval workflows",
              "Real-time monitoring of actual project expenditures vs. approved baseline budgets",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-zinc-300">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700/60">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-zinc-500 pt-6 border-t border-zinc-800/60">
          <p>© {new Date().getFullYear()} Time Travel Design. All rights reserved.</p>
        </div>
      </div>

      {/* Right: Register Form */}
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block focus:outline-none">
            <BrandLogo variant="full" color="dark" size="lg" />
          </Link>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Create Team Account
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Already have verified credentials?{" "}
              <Link href="/login" className="font-semibold text-zinc-900 hover:underline">
                Sign in here
              </Link>
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                placeholder="e.g. Adrian Sterling"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Corporate Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                placeholder="name@timetraveldesign.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                  placeholder="Minimum 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                placeholder="Repeat password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-zinc-950/20 transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Register Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-zinc-400 leading-relaxed">
            By creating an account, you adhere to Time Travel Design internal confidentiality policies and fiduciary standards.
          </p>
        </div>
      </div>
    </div>
  );
}
