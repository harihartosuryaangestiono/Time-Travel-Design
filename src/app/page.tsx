import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calculator,
  FileText,
  PieChart,
  Receipt,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FBFBFC] text-zinc-900 selection:bg-zinc-950 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <BrandLogo variant="full" color="dark" size="md" />
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/login"
                className="text-xs sm:text-sm font-semibold text-zinc-600 hover:text-zinc-950 transition-colors px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-95"
              >
                <span>Access Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #000000 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-medium text-zinc-700 shadow-sm mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
              Treasury Management &amp; Financial Architecture
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-zinc-950 leading-[1.1]">
              Precision Accounting for{" "}
              <span className="font-semibold text-zinc-950 block mt-1">
                Modern Architectural Practices
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed">
              An enterprise financial system built for <strong>Time Travel Design</strong>. Synchronize project budgets, field cash advances, treasury bank accounts, and double-entry general ledgers with effortless clarity.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 rounded-xl bg-zinc-950 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-xl shadow-zinc-950/20 transition-all hover:bg-black active:scale-[0.98]"
              >
                <span>Launch Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-[0.98]"
              >
                Request Team Access
              </Link>
            </div>
          </div>

          {/* Architectural Preview Dashboard Card */}
          <div className="mt-16 sm:mt-20 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 shadow-2xl shadow-zinc-950/5">
            <div className="rounded-xl border border-zinc-800/90 bg-[#09090B] p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <BrandLogo variant="icon" color="white" size="md" />
                  <div>
                    <h2 className="text-base font-semibold text-white tracking-wide">
                      Time Travel Design — Executive Finance Pulse
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Multi-project financial monitoring &amp; accounting engine
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Fiscal Stream
                  </span>
                </div>
              </div>

              {/* Sample Metrics Mockup Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
                  <p className="text-xs text-zinc-400 font-medium">Treasury Reserves</p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    IDR 2,450,000,000
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                    <TrendingUp className="h-3 w-3 text-emerald-400" /> Liquid Cash &amp; Bank
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
                  <p className="text-xs text-zinc-400 font-medium">Active Commissions</p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    12 Projects
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400 font-mono">
                    100% Budget Tracked
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
                  <p className="text-xs text-zinc-400 font-medium">Active Field Advances</p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    IDR 84,500,000
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400 font-mono">
                    Real-Time Settlement Audit
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
                  <p className="text-xs text-zinc-400 font-medium">Net Operating Margin</p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    +28.4%
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400 font-mono">
                    YTD Studio Performance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t border-zinc-200 bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500 font-semibold">
              Integrated Capabilities
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
              Engineered for the Spatial Design &amp; Build Lifecycle
            </h2>
            <p className="mt-4 text-sm text-zinc-600">
              End-to-end financial orchestration from project budget estimating to double-entry ledger financial statements.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Project Portfolios & Cost Baselines",
                desc: "Track architectural, interior, and masterplan commissions with detailed cost itemization, billable milestones, and real-time variance monitoring.",
              },
              {
                icon: Receipt,
                title: "Procurement & Operating Vouchers",
                desc: "Log contractor invoices, stone & finishing procurement, and studio expenses with direct mapping to project cost codes and general ledger accounts.",
              },
              {
                icon: Wallet,
                title: "Field Cash Advances & Settlements",
                desc: "Structured workflow for site survey advances, disbursement approvals, digital receipt attachments, and prompt variance reconciliation.",
              },
              {
                icon: Calculator,
                title: "Automated Double-Entry Ledger",
                desc: "Compliant accounting engine that generates synchronized journal entries with immutable posting references and audit trail integrity.",
              },
              {
                icon: PieChart,
                title: "Executive Financial Reporting",
                desc: "Comprehensive Profit & Loss, Balance Sheet, Direct Cash Flows, and Trial Balance reports prepared for immediate export and partner reviews.",
              },
              {
                icon: Building2,
                title: "Multi-Account Treasury Control",
                desc: "Oversee studio petty cash floats, commercial bank accounts (BCA, Mandiri), and track inter-account fund transfers with zero discrepancy.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-7 transition-all duration-300 hover:border-zinc-950/20 hover:bg-white hover:shadow-xl hover:shadow-zinc-950/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-950 text-white transition-transform group-hover:scale-105">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-bold text-zinc-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Luxury Dark CTA Section */}
      <section className="bg-[#09090B] py-20 sm:py-24 border-t border-zinc-800 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <BrandLogo variant="icon" color="white" size="lg" className="mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
            Manage Design Finances with{" "}
            <span className="font-semibold text-white">Uncompromising Precision</span>
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Sign in to the Time Travel Design Finance portal to gain full operational visibility over project budgets, subcontractor payouts, and studio treasury runway.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-lg transition-all hover:bg-zinc-100 active:scale-95"
            >
              <span>Access Portal Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-4">
              <BrandLogo variant="full" color="dark" size="sm" />
              <span className="text-xs text-zinc-400 border-l border-zinc-200 pl-4 font-mono">
                Enterprise Internal Accounting
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono">
              &copy; {new Date().getFullYear()} Time Travel Design. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
