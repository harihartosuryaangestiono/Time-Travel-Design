"use client";

import { useState, useEffect } from "react";
import {
  CheckSquare,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileCheck,
  Coins,
  DollarSign,
  User,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface ApprovalItem {
  id: string;
  type: "EXPENSE" | "REIMBURSEMENT" | "CASH_ADVANCE";
  number: string;
  date: string;
  description: string;
  applicant: string;
  project: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comments?: string | null;
}

const defaultApprovals: ApprovalItem[] = [
  {
    id: "app-1",
    type: "EXPENSE",
    number: "EXP-2024-0104",
    date: "2024-10-14",
    description: "Carrara Marble Slabs Procurement - Villa Canggu Project",
    applicant: "Rian Pratama (Principal Architect)",
    project: "PRJ-24-001 Villa Canggu",
    amount: 32500000,
    status: "PENDING",
  },
  {
    id: "app-2",
    type: "CASH_ADVANCE",
    number: "CA-2024-0042",
    date: "2024-10-12",
    description: "Site Survey & Structural Inspection Advance - Bandung Masterplan",
    applicant: "Fajar Nugraha (Lead Site Surveyor)",
    project: "PRJ-24-003 Masterplan BSD",
    amount: 4500000,
    status: "PENDING",
  },
  {
    id: "app-3",
    type: "REIMBURSEMENT",
    number: "RMB-2024-0019",
    date: "2024-10-10",
    description: "Interior Material Swatches & Custom Hardware Procurement",
    applicant: "Amelia Putri (Senior Interior Designer)",
    project: "PRJ-24-002 Cafe Senopati",
    amount: 1850000,
    status: "PENDING",
  },
  {
    id: "app-4",
    type: "EXPENSE",
    number: "EXP-2024-0098",
    date: "2024-10-04",
    description: "Electrical & Acoustic Engineering Subcontractor Retainer",
    applicant: "Dimas Anggara (Field Supervisor)",
    project: "PRJ-24-002 Cafe Senopati",
    amount: 22000000,
    status: "APPROVED",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(defaultApprovals);
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = (id: string, action: "APPROVED" | "REJECTED") => {
    setProcessingId(id);
    setTimeout(() => {
      setApprovals((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: action } : item))
      );
      setProcessingId(null);
    }, 400);
  };

  const pendingList = approvals.filter((a) => a.status === "PENDING");
  const approvedList = approvals.filter((a) => a.status === "APPROVED");
  const rejectedList = approvals.filter((a) => a.status === "REJECTED");

  const totalPendingAmount = pendingList.reduce((s, a) => s + a.amount, 0);

  const currentList =
    filter === "PENDING" ? pendingList : filter === "APPROVED" ? approvedList : rejectedList;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Awaiting Approval"
          value={`${pendingList.length} Claims`}
          subtitle="Requires executive authorization"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
          gradient
        />
        <StatCard
          title="Pending Total Volume"
          value={formatCurrency(totalPendingAmount)}
          subtitle="Awaiting disbursement authorization"
          icon={DollarSign}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-900"
        />
        <StatCard
          title="Approved Claims"
          value={`${approvedList.length} Authorized`}
          subtitle="Transferred to treasury payout queue"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Rejected / Clarification"
          value={`${rejectedList.length} Flagged`}
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
              {pendingList.length}
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
              {approvedList.length}
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
        {currentList.length > 0 ? (
          currentList.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm hover:border-zinc-300 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-5"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md">
                    {item.number}
                  </span>
                  <Badge
                    variant={
                      item.type === "EXPENSE"
                        ? "zinc"
                        : item.type === "CASH_ADVANCE"
                        ? "purple"
                        : "info"
                    }
                    size="sm"
                  >
                    {item.type === "EXPENSE"
                      ? "Expense Voucher"
                      : item.type === "CASH_ADVANCE"
                      ? "Cash Advance"
                      : "Staff Claim"}
                  </Badge>
                  <span className="text-xs text-zinc-400 font-mono">
                    {item.date}
                  </span>
                </div>

                <h4 className="text-base font-bold text-zinc-900">
                  {item.description}
                </h4>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Requester: {item.applicant}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Cost Center: {item.project}</span>
                  </div>
                </div>
              </div>

              {/* Amount and Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-100 justify-between md:justify-end">
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Voucher Value
                  </span>
                  <p className="text-xl font-bold font-mono text-zinc-900 tabular-nums">
                    {formatCurrency(item.amount)}
                  </p>
                </div>

                {item.status === "PENDING" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(item.id, "REJECTED")}
                      disabled={processingId === item.id}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(item.id, "APPROVED")}
                      disabled={processingId === item.id}
                      className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition-all"
                    >
                      <Check className="h-4 w-4" />
                      {processingId === item.id ? "Authorizing..." : "Authorize"}
                    </button>
                  </div>
                )}

                {item.status !== "PENDING" && (
                  <Badge
                    variant={item.status === "APPROVED" ? "success" : "error"}
                    dot
                  >
                    {item.status === "APPROVED" ? "Authorized" : "Rejected"}
                  </Badge>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">
            <CheckSquare className="mx-auto h-10 w-10 text-zinc-300 mb-2" />
            <p className="font-semibold text-zinc-700">No vouchers in this queue</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              All pending operational disbursements have been authorized and settled
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
