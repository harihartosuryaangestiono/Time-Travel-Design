"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  FileCheck,
  Search,
  Filter,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Camera,
  Edit3,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { ReceiptCaptureModal } from "@/components/expenses/ReceiptCaptureModal";
import { ReimbursementModal, ReimbursementFormData } from "@/components/modals/ReimbursementModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";

interface ReimbursementItem {
  id: string;
  number: string;
  date: string;
  description: string;
  employee: string;
  amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED";
  paid_date: string | null;
}

const defaultReimbursements: ReimbursementItem[] = [
  {
    id: "r-1",
    number: "RMB-2024-0019",
    date: "2024-10-14",
    description: "Procurement of Dulux paint samples & studio interior finishes",
    employee: "Amelia Putri (Interior Designer)",
    amount: 1850000,
    status: "SUBMITTED",
    paid_date: null,
  },
  {
    id: "r-2",
    number: "RMB-2024-0018",
    date: "2024-10-10",
    description: "Fuel and highway toll for BSD Tangerang site inspection",
    employee: "Rian Pratama (Lead Architect)",
    amount: 650000,
    status: "PAID",
    paid_date: "2024-10-11",
  },
  {
    id: "r-3",
    number: "RMB-2024-0017",
    date: "2024-10-06",
    description: "Client liaison meeting catering & refreshments (Bali Project)",
    employee: "Dimas Anggara (Site Supervisor)",
    amount: 1200000,
    status: "APPROVED",
    paid_date: null,
  },
  {
    id: "r-4",
    number: "RMB-2024-0016",
    date: "2024-10-02",
    description: "Plotter ink cartridges, drafting paper & project stationery",
    employee: "Siti Rahma (Studio Admin)",
    amount: 950000,
    status: "PAID",
    paid_date: "2024-10-03",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReimbursementsPage() {
  const [data, setData] = useState<ReimbursementItem[]>(defaultReimbursements);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  // Edit / Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ReimbursementFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState<ReimbursementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveClaim = (saved: ReimbursementFormData) => {
    setData((prev) =>
      prev.map((item) =>
        item.id === saved.id
          ? {
              ...item,
              description: saved.description,
              employee: saved.employee,
              amount: saved.amount,
              status: saved.status,
              date: saved.date,
              paid_date: saved.paid_date,
            }
          : item
      )
    );
  };

  const handleDeleteClaim = async () => {
    if (!claimToDelete) return;
    try {
      setIsDeleting(true);
      setData((prev) => prev.filter((i) => i.id !== claimToDelete.id));
      setShowDelete(false);
      setClaimToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (!membership) return;

      const { data: dbData } = await supabase
        .from("reimbursements")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false });

      if (dbData && dbData.length > 0) {
        const mapped = dbData.map((r) => ({
          id: r.id,
          number: r.number,
          date: r.date,
          description: r.description,
          employee: "Studio Staff",
          amount: parseFloat(r.amount || "0"),
          status: r.status || "PAID",
          paid_date: r.paid_date,
        }));
        setData(mapped);
      }
    } catch (e) {
      console.warn("Using showcase reimbursement data", e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalReimbursed = data
    .filter((r) => r.status === "PAID")
    .reduce((s, r) => s + r.amount, 0);

  const pendingCount = data.filter((r) => r.status === "SUBMITTED").length;
  const approvedCount = data.filter((r) => r.status === "APPROVED").length;

  const filteredData = data.filter((r) => {
    const matchesSearch =
      r.number.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.employee.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Settled Claims (MTD)"
          value={formatCurrency(totalReimbursed)}
          subtitle="Disbursed directly to claimant accounts"
          icon={CheckCircle2}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
          gradient
        />
        <StatCard
          title="Pending Verification"
          value={`${pendingCount} Requests`}
          subtitle="Receipt verification required"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Approved for Payout"
          value={`${approvedCount} Claims`}
          subtitle="Authorized by project director"
          icon={DollarSign}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <StatCard
          title="Average Turnaround"
          value="1.8 Days"
          subtitle="Rapid expense claim turnaround"
          icon={FileCheck}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        />
      </div>

      {/* ── Control Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search claim reference, purpose, employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "All Claims" },
              { id: "SUBMITTED", label: "Pending" },
              { id: "APPROVED", label: "Approved" },
              { id: "PAID", label: "Settled" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-all text-xs",
                  statusFilter === tab.id
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Camera className="h-4 w-4 text-emerald-400" />
            <span>Scan Claim Receipt</span>
          </button>
        </div>
      </div>

      {/* ── Reimbursements Table ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-zinc-950" />
              Employee Expense Claims & Reimbursements
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Operational staff expense claims for architectural projects and studio logistics
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {filteredData.length} records found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Claim Ref</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Claimant &amp; Purpose</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Settlement Date</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredData.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-50/70 transition-colors"
                >
                  <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                    {item.number}
                  </td>
                  <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="py-3.5 pr-2">
                    <p className="font-semibold text-zinc-900">{item.employee}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {item.description}
                    </p>
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <Badge
                      variant={
                        item.status === "PAID"
                          ? "success"
                          : item.status === "APPROVED"
                          ? "info"
                          : "warning"
                      }
                      size="sm"
                      dot
                    >
                      {item.status === "PAID"
                        ? "Settled"
                        : item.status === "APPROVED"
                        ? "Approved"
                        : "Pending"}
                    </Badge>
                  </td>
                  <td className="py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                    {item.paid_date || "—"}
                  </td>
                  <td className="py-3.5 text-right font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClaim({
                            id: item.id,
                            number: item.number,
                            date: item.date,
                            description: item.description,
                            employee: item.employee,
                            amount: item.amount,
                            status: item.status,
                            paid_date: item.paid_date,
                          });
                          setShowEditModal(true);
                        }}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                        title="Edit Claim"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setClaimToDelete(item);
                          setShowDelete(true);
                        }}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete Claim"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Reimbursement Receipt Photo Capture & Allocation Modal ── */}
      <ReceiptCaptureModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onSuccess={(newExp) => {
          if (newExp) {
            const newClaim: ReimbursementItem = {
              id: newExp.id || `r-${Date.now()}`,
              number: `RMB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
              date: newExp.date || new Date().toISOString().split("T")[0],
              description: newExp.description || "Project out-of-pocket disbursement",
              employee: "Current Architect / Project Lead",
              amount: Number(newExp.total_amount || newExp.amount || 0),
              status: "SUBMITTED",
              paid_date: null,
            };
            setData((prev) => [newClaim, ...prev]);
          }
        }}
      />

      {/* ── Edit Reimbursement Claim Modal ── */}
      <ReimbursementModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedClaim(null);
        }}
        onSuccess={handleSaveClaim}
        claimToEdit={selectedClaim}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setClaimToDelete(null);
        }}
        onConfirm={handleDeleteClaim}
        title="Cancel Reimbursement Claim"
        description="Are you sure you want to permanently withdraw and cancel this employee reimbursement claim?"
        itemName={claimToDelete ? `${claimToDelete.number} • ${claimToDelete.employee}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
