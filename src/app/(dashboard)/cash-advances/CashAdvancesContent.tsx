"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Coins,
  ChevronRight,
  Search,
  Filter,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowRight,
  Edit3,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import { CashAdvanceModal, CashAdvanceFormData } from "@/components/modals/CashAdvanceModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";

interface CashAdvanceItem {
  id: string;
  number: string;
  date: string;
  purpose: string;
  employee: string;
  amount: number;
  disbursed_amount: number;
  settled_amount: number;
  returned_amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "DISBURSED" | "PARTIALLY_SETTLED" | "SETTLED";
}

const defaultAdvances: CashAdvanceItem[] = [
  {
    id: "ca-1",
    number: "CA-2024-0042",
    date: "2024-10-10",
    purpose: "Site inspection & contractor liaison for Bali Luxury Villa project",
    employee: "Rian Pratama (BIM & Architecture Lead)",
    amount: 8500000,
    disbursed_amount: 8500000,
    settled_amount: 6200000,
    returned_amount: 0,
    status: "PARTIALLY_SETTLED",
  },
  {
    id: "ca-2",
    number: "CA-2024-0041",
    date: "2024-10-08",
    purpose: "Marble and exotic wood veneer architectural samples procurement",
    employee: "Amelia Putri (Interior Designer)",
    amount: 5000000,
    disbursed_amount: 5000000,
    settled_amount: 5000000,
    returned_amount: 0,
    status: "SETTLED",
  },
  {
    id: "ca-3",
    number: "CA-2024-0040",
    date: "2024-10-05",
    purpose: "Site surveying & land elevation operational advance - BSD Masterplan",
    employee: "Fajar Nugraha (Site Surveyor)",
    amount: 4500000,
    disbursed_amount: 4500000,
    settled_amount: 4100000,
    returned_amount: 400000,
    status: "SETTLED",
  },
  {
    id: "ca-4",
    number: "CA-2024-0039",
    date: "2024-10-12",
    purpose: "Senopati Cafe interior supervisory accommodation & transit",
    employee: "Dimas Anggara (Project Supervisor)",
    amount: 3500000,
    disbursed_amount: 3500000,
    settled_amount: 0,
    returned_amount: 0,
    status: "DISBURSED",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CashAdvancesContent() {
  const [advances, setAdvances] = useState<CashAdvanceItem[]>(defaultAdvances);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<CashAdvanceFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState<CashAdvanceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveAdvance = (saved: CashAdvanceFormData) => {
    if (saved.id) {
      // Edit
      setAdvances((prev) =>
        prev.map((ca) =>
          ca.id === saved.id
            ? {
                ...ca,
                number: saved.number,
                date: saved.date,
                purpose: saved.purpose,
                employee: saved.employee,
                amount: saved.amount,
                disbursed_amount: saved.disbursed_amount,
                settled_amount: saved.settled_amount,
                returned_amount: saved.returned_amount,
                status: saved.status,
              }
            : ca
        )
      );
    } else {
      // Create
      const newAdv: CashAdvanceItem = {
        id: `ca-${Date.now()}`,
        number: saved.number,
        date: saved.date,
        purpose: saved.purpose,
        employee: saved.employee,
        amount: saved.amount,
        disbursed_amount: saved.disbursed_amount,
        settled_amount: saved.settled_amount || 0,
        returned_amount: saved.returned_amount || 0,
        status: saved.status,
      };
      setAdvances((prev) => [newAdv, ...prev]);
    }
  };

  const handleDeleteAdvance = async () => {
    if (!advanceToDelete) return;
    try {
      setIsDeleting(true);
      setAdvances((prev) => prev.filter((i) => i.id !== advanceToDelete.id));
      setShowDelete(false);
      setAdvanceToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const fetchAdvances = async () => {
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

      const { data } = await supabase
        .from("cash_advances")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("date", { ascending: false });

      if (data && data.length > 0) {
        const mapped = data.map((ca) => ({
          id: ca.id,
          number: ca.number,
          date: ca.date,
          purpose: ca.purpose,
          employee: "Operational Staff",
          amount: parseFloat(ca.amount || "0"),
          disbursed_amount: parseFloat(ca.disbursed_amount || ca.amount || "0"),
          settled_amount: parseFloat(ca.settled_amount || "0"),
          returned_amount: parseFloat(ca.returned_amount || "0"),
          status: ca.status || "DISBURSED",
        }));
        setAdvances(mapped);
      }
    } catch (e) {
      console.warn("Using rich showcase cash advance dataset", e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalOutstanding = advances
    .filter((a) => a.status === "DISBURSED" || a.status === "PARTIALLY_SETTLED")
    .reduce((sum, a) => sum + (a.disbursed_amount - a.settled_amount - a.returned_amount), 0);

  const totalSettled = advances
    .filter((a) => a.status === "SETTLED")
    .reduce((sum, a) => sum + a.amount, 0);

  const activeCount = advances.filter(
    (a) => a.status === "DISBURSED" || a.status === "PARTIALLY_SETTLED"
  ).length;

  const filteredAdvances = advances.filter((ca) => {
    const matchesSearch =
      ca.number.toLowerCase().includes(search.toLowerCase()) ||
      ca.purpose.toLowerCase().includes(search.toLowerCase()) ||
      ca.employee.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || ca.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Cash Advances"
          value={formatCurrency(totalOutstanding)}
          subtitle="Pending receipt reconciliation"
          icon={Coins}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
          gradient
        />
        <StatCard
          title="Unsettled Requests"
          value={`${activeCount} Open`}
          subtitle="Receipt verification required"
          icon={Clock}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
        />
        <StatCard
          title="Settled (MTD)"
          value={formatCurrency(totalSettled)}
          subtitle="Audited and closed"
          icon={CheckCircle2}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Settlement Velocity"
          value="94.2%"
          subtitle="Reconciled within milestone term"
          icon={DollarSign}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
      </div>

      {/* ── Controls Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search advance reference, claimant, purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "All Advances" },
              { id: "DISBURSED", label: "Disbursed" },
              { id: "PARTIALLY_SETTLED", label: "Partial" },
              { id: "SETTLED", label: "Settled" },
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
            onClick={() => {
              setSelectedAdvance(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Cash Advance</span>
          </button>
        </div>
      </div>

      {/* ── Cash Advances Table ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Coins className="h-5 w-5 text-zinc-950" />
              Site Cash Advances &amp; Petty Cash Ledger
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Monitor operational advances, receipt submission progress, and open employee balances
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {filteredAdvances.length} records found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Advance Ref</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Recipient &amp; Purpose</th>
                <th className="pb-3">Disbursed</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Settled Amount</th>
                <th className="pb-3 text-right">Open Balance</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredAdvances.map((ca) => {
                const remaining = ca.disbursed_amount - ca.settled_amount - ca.returned_amount;
                const isComplete = ca.status === "SETTLED";

                return (
                  <tr
                    key={ca.id}
                    className="hover:bg-zinc-50/70 transition-colors"
                  >
                    <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                      {ca.number}
                    </td>
                    <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                      {ca.date}
                    </td>
                    <td className="py-3.5 pr-2">
                      <p className="font-semibold text-zinc-900">
                        {ca.employee}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {ca.purpose}
                      </p>
                    </td>
                    <td className="py-3.5 font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap">
                      {formatCurrency(ca.disbursed_amount)}
                    </td>
                    <td className="py-3.5 whitespace-nowrap">
                      <Badge
                        variant={
                          isComplete
                            ? "success"
                            : ca.status === "PARTIALLY_SETTLED"
                            ? "warning"
                            : "neutral"
                        }
                        size="sm"
                        dot
                      >
                        {isComplete
                          ? "Settled"
                          : ca.status === "PARTIALLY_SETTLED"
                          ? "Partial"
                          : "Disbursed"}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                      {formatCurrency(ca.settled_amount)}
                    </td>
                    <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdvance({
                              id: ca.id,
                              number: ca.number,
                              date: ca.date,
                              purpose: ca.purpose,
                              employee: ca.employee,
                              amount: ca.amount,
                              disbursed_amount: ca.disbursed_amount,
                              settled_amount: ca.settled_amount,
                              returned_amount: ca.returned_amount,
                              status: ca.status,
                            });
                            setShowModal(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                          title="Edit Advance"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdvanceToDelete(ca);
                            setShowDelete(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Delete Advance"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cash Advance Create / Edit Modal ── */}
      <CashAdvanceModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAdvance(null);
        }}
        onSuccess={handleSaveAdvance}
        advanceToEdit={selectedAdvance}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setAdvanceToDelete(null);
        }}
        onConfirm={handleDeleteAdvance}
        title="Delete Cash Advance Voucher"
        description="Are you sure you want to permanently cancel and delete this site petty cash disbursement?"
        itemName={advanceToDelete ? `${advanceToDelete.number} • ${advanceToDelete.employee}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
