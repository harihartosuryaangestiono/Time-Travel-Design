"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, Check, ArrowRight } from "lucide-react";
import { setupOrganization } from "./actions";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function SetupOrganizationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    organizationName: "Time Travel Design",
    address: "",
    phone: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await setupOrganization({
        organizationName: formData.organizationName,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during workspace initialization");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FBFBFC]">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block focus:outline-none">
            <BrandLogo variant="full" color="dark" size="lg" />
          </Link>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Studio Workspace Configuration
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Configure your practice profile for general ledger reporting, invoice headers, and audit trails
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
                Legal Entity / Studio Name *
              </label>
              <input
                type="text"
                value={formData.organizationName}
                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                placeholder="Time Travel Design"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                Studio Registered Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                placeholder="HQ Studio / Atelier address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Studio Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                  placeholder="+62 21-XXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Finance Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all shadow-sm"
                  placeholder="finance@timetraveldesign.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.organizationName}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-zinc-950/20 transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  <span>Initialize &amp; Launch Dashboard</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right: Architectural Visual */}
      <div className="hidden flex-1 relative overflow-hidden bg-[#09090B] lg:flex lg:flex-col lg:justify-between lg:p-16 border-l border-zinc-800/80">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-zinc-700/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo variant="icon" color="white" size="md" />
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Initial Workspace Setup
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h3 className="text-3xl font-light tracking-tight text-white leading-tight">
            Financial Architecture <br />
            <span className="font-semibold text-zinc-100">Ready Out-of-the-Box</span>
          </h3>
          <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
            The system automatically initializes an architectural practice standard Chart of Accounts (COA), primary treasury accounts, and verified double-entry journals for your team.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Standard Architectural & Construction Chart of Accounts",
              "Integrated Treasury Cash & Bank General Ledgers",
              "Automated Fiscal Sequences & Double-Entry Postings",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-zinc-300">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                  <Check className="h-3 w-3 text-white" />
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
    </div>
  );
}
