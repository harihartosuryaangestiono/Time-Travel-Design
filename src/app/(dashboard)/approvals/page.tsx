"use client";

import { useState } from "react";
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Awaiting Approval"
          value="0 Klaim"
          subtitle="Requires executive authorization"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
          gradient
        />
        <StatCard
          title="Pending Total Volume"
          value="Rp 0"
          subtitle="Awaiting disbursement authorization"
          icon={DollarSign}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-900"
        />
        <StatCard
          title="Approved Claims"
          value="0 Disetujui"
          subtitle="Transferred to treasury payout queue"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Rejected / Clarification"
          value="0 Ditolak"
          subtitle="Requires receipt verification"
          icon={AlertTriangle}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
        />
      </div>

      {/* ── Control Bar: Status Filter Tabs ── */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-900">
            Authorization & Approval Inbox
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Audit and authorize project expenditures, vendor vouchers, and team cash advances
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
          <button
            onClick={() => setFilter("PENDING")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
              filter === "PENDING"
                ? "bg-white text-zinc-900 font-bold shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            <span>Pending</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
              0
            </span>
          </button>
          <button
            onClick={() => setFilter("APPROVED")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
              filter === "APPROVED"
                ? "bg-white text-zinc-900 font-bold shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            <span>Approved</span>
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-bold text-zinc-800">
              0
            </span>
          </button>
          <button
            onClick={() => setFilter("REJECTED")}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-all",
              filter === "REJECTED"
                ? "bg-white text-zinc-900 font-bold shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Rejected
          </button>
        </div>
      </div>

      {/* ── Approval Items List ── */}
      <div className="space-y-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">
          <CheckSquare className="mx-auto h-10 w-10 text-zinc-300 mb-2" />
          <p className="font-semibold text-zinc-700">Belum ada pengajuan persetujuan</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pengajuan yang membutuhkan persetujuan akan muncul di sini.
          </p>
        </div>
      </div>
    </div>
  );
}
