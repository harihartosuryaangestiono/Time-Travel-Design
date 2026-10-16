"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { signIn } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn(email, password);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.needsSetup) {
        router.push("/setup-organization");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during authentication");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FBFBFC]">
      {/* Left: Login Form */}
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Brand Logo */}
          <Link href="/" className="mb-10 inline-block focus:outline-none">
            <BrandLogo variant="full" color="dark" size="lg" />
          </Link>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Welcome Back
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Access the Time Travel Design enterprise financial intelligence portal
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Corporate Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                placeholder="name@timetraveldesign.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                  placeholder="••••••••"
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

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2.5 text-zinc-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-950 accent-zinc-950 focus:ring-zinc-900/20"
                />
                <span className="text-xs font-medium">Remember this browser session</span>
              </label>
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
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-200/80 text-center">
            <p className="text-xs text-zinc-500">
              Need account provisioning?{" "}
              <Link href="/register" className="font-semibold text-zinc-900 hover:underline">
                Request Team Access
              </Link>
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            <span>Enterprise 256-Bit SSL • Audited Activity Log</span>
          </div>
        </div>
      </div>

      {/* Right: Luxury Architectural Visual Banner */}
      <div className="hidden flex-1 relative overflow-hidden bg-[#09090B] lg:flex lg:flex-col lg:justify-between lg:p-16 border-l border-zinc-800/80">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-zinc-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top brand stamp */}
        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo variant="icon" color="white" size="md" />
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Financial Architecture
          </span>
        </div>

        {/* Center message */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300 backdrop-blur-sm mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Core Treasury Engine Active
          </div>
          <h3 className="text-3xl lg:text-4xl font-light tracking-tight text-white leading-snug">
            Precision Accounting for <span className="font-semibold text-zinc-100">Modern Spatial Architecture</span>
          </h3>
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            An integrated financial architecture suite built for architecture and interior design studios—synchronizing project budgets, contractor disbursements, treasury cash runway, and real-time general ledger postings.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 backdrop-blur-sm">
              <p className="font-mono text-2xl font-semibold text-white tracking-tight">100%</p>
              <p className="mt-1 text-xs text-zinc-400">Budget &amp; Spend Traceability</p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 backdrop-blur-sm">
              <p className="font-mono text-2xl font-semibold text-white tracking-tight">Real-Time</p>
              <p className="mt-1 text-xs text-zinc-400">Multi-Tier Approval Verification</p>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-500 pt-6 border-t border-zinc-800/60">
          <p>© {new Date().getFullYear()} Time Travel Design. All rights reserved.</p>
          <p className="font-mono">v2.4.0</p>
        </div>
      </div>
    </div>
  );
}
