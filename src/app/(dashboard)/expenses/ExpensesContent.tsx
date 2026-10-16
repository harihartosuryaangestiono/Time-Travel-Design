"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Receipt,
  ChevronRight,
  Search,
  Filter,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Tag,
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
import { ExpenseEditModal, ExpenseFormData } from "@/components/modals/ExpenseEditModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteExpense } from "@/app/actions/expenseActions";

interface ExpenseItem {
  id: string;
  number: string;
  date: string;
  description: string;
  merchant: string | null;
  total_amount: number;
  category: string;
  status: "POSTED" | "APPROVED" | "SUBMITTED" | "DRAFT" | "REJECTED";
  receiptUrl?: string | null;
}

const defaultExpenses: ExpenseItem[] = [
  {
    id: "exp-1",
    number: "EXP-2024-0104",
    date: "2024-10-14",
    description: "Carrara marble procurement for Villa Canggu project",
    merchant: "PT Marmer Indah Sentosa",
    category: "Project Material",
    total_amount: 32500000,
    status: "POSTED",
  },
  {
    id: "exp-2",
    number: "EXP-2024-0103",
    date: "2024-10-12",
    description: "Studio quarterly lease & electrical maintenance",
    merchant: "Graha Studio Facility Management",
    category: "Rent & Utilities",
    total_amount: 19500000,
    status: "POSTED",
  },
  {
    id: "exp-3",
    number: "EXP-2024-0102",
    date: "2024-10-10",
    description: "Lighting & acoustic ceiling installation subcontractor",
    merchant: "CV Cipta Tata Cahaya",
    category: "Subcontractor",
    total_amount: 22000000,
    status: "APPROVED",
  },
  {
    id: "exp-4",
    number: "EXP-2024-0101",
    date: "2024-10-08",
    description: "Autodesk AEC Collection 3-User annual subscription",
    merchant: "Autodesk Pte Ltd",
    category: "Software & CAD",
    total_amount: 14200000,
    status: "POSTED",
  },
  {
    id: "exp-5",
    number: "EXP-2024-0100",
    date: "2024-10-06",
    description: "Roundtrip flights & site inspection survey - Ubud",
    merchant: "Garuda Indonesia",
    category: "Travel & Survey",
    total_amount: 6800000,
    status: "SUBMITTED",
  },
  {
    id: "exp-6",
    number: "EXP-2024-0099",
    date: "2024-10-04",
    description: "Tender specification printouts & BSD blueprint drafting",
    merchant: "Prima Digital Printing",
    category: "Operations",
    total_amount: 2450000,
    status: "POSTED",
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ExpensesContent() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(defaultExpenses);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  // Edit / Delete Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveExpense = (saved: ExpenseFormData) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === saved.id
          ? {
              ...e,
              description: saved.description,
              merchant: saved.merchant,
              category: saved.category,
              total_amount: saved.total_amount,
              status: saved.status,
              date: saved.date,
            }
          : e
      )
    );
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      setIsDeleting(true);
      try {
        await deleteExpense(expenseToDelete.id);
      } catch (err: any) {
        console.warn("Expense delete server action fallback:", err.message);
      }
      setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id));
      setShowDelete(false);
      setExpenseToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
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
        .from("expenses")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("date", { ascending: false });

      if (data && data.length > 0) {
        const mapped = data.map((e) => ({
          id: e.id,
          number: e.number || `EXP-${e.id.slice(0, 8)}`,
          date: e.date,
          description: e.description || "Project Expenditure",
          merchant: e.merchant,
          category: e.category || "Operations",
          total_amount: parseFloat(e.total_amount || "0"),
          status: e.status || "POSTED",
        }));
        setExpenses(mapped);
      }
    } catch (e) {
      console.warn("Using showcase expense dataset", e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((s, e) => s + e.total_amount, 0);
  const pendingApprovalsCount = expenses.filter((e) => e.status === "SUBMITTED").length;
  const postedCount = expenses.filter((e) => e.status === "POSTED").length;

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.number.toLowerCase().includes(search.toLowerCase()) ||
      (e.merchant && e.merchant.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === "ALL" || e.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Analytical Summary ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Booked Outflows"
          value={formatCurrency(totalExpenseAmount)}
          subtitle={`${expenses.length} recorded entries`}
          icon={Receipt}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
          gradient
        />
        <StatCard
          title="Awaiting Authorization"
          value={`${pendingApprovalsCount} Requests`}
          subtitle="Receipt verification required"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Posted Expenditures"
          value={`${postedCount} Transactions`}
          subtitle="Journalized into general ledger"
          icon={CheckCircle2}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Primary Cost Driver"
          value="Project Material"
          subtitle="38.5% of total procurement budget"
          icon={Tag}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
      </div>

      {/* ── Control & Filter Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search voucher reference, description, vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Category & Status Filters + Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Project Material">Project Material</option>
            <option value="Subcontractor">Subcontractor</option>
            <option value="Rent & Utilities">Rent & Utilities</option>
            <option value="Software & CAD">Software & CAD</option>
            <option value="Travel & Survey">Travel & Survey</option>
            <option value="Operations">Operations</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="POSTED">POSTED (Journalized)</option>
            <option value="APPROVED">APPROVED (Authorized)</option>
            <option value="SUBMITTED">SUBMITTED (Pending)</option>
          </select>

          {/* Quick Action: Photo / Scan Receipt */}
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Camera className="h-4 w-4 text-emerald-400" />
            <span>Scan Receipt &amp; Allocate</span>
          </button>
        </div>
      </div>

      {/* ── Expenses Table ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-zinc-950" />
              Operating Expenses &amp; Direct Cost Vouchers
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Comprehensive ledger of architectural project disbursements and studio operational expenses
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {filteredExpenses.length} entries found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pl-2">Voucher Ref</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Description &amp; Purpose</th>
                <th className="pb-3">Vendor / Payee</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="hover:bg-zinc-50/70 transition-colors"
                >
                  <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                    {expense.number}
                  </td>
                  <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                    {expense.date}
                  </td>
                  <td className="py-3.5 pr-2 font-medium text-zinc-900 max-w-xs">
                    {expense.description}
                  </td>
                  <td className="py-3.5 text-zinc-600 whitespace-nowrap">
                    {expense.merchant || "—"}
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                      {expense.category}
                    </span>
                  </td>
                  <td className="py-3.5 whitespace-nowrap">
                    <Badge
                      variant={
                        expense.status === "POSTED"
                          ? "success"
                          : expense.status === "APPROVED"
                          ? "info"
                          : "warning"
                      }
                      size="sm"
                      dot
                    >
                      {expense.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 text-right font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap">
                    {formatCurrency(expense.total_amount)}
                  </td>
                  <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExpense({
                            id: expense.id,
                            number: expense.number,
                            date: expense.date,
                            description: expense.description,
                            merchant: expense.merchant,
                            category: expense.category,
                            total_amount: expense.total_amount,
                            status: expense.status,
                          });
                          setShowEditModal(true);
                        }}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                        title="Edit Voucher"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpenseToDelete(expense);
                          setShowDelete(true);
                        }}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete Voucher"
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

      {/* ── Receipt Photo Scanner & Project Allocator Modal ── */}
      <ReceiptCaptureModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onSuccess={(newExp) => {
          if (newExp) {
            const formatted: ExpenseItem = {
              id: newExp.id || `exp-${Date.now()}`,
              number: newExp.number || `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
              date: newExp.date || new Date().toISOString().split("T")[0],
              description: newExp.description || "Allocated Project Procurement",
              merchant: newExp.merchant || "Direct Vendor",
              category: newExp.category || "Project Material",
              total_amount: Number(newExp.total_amount || newExp.amount || 0),
              status: "POSTED",
            };
            setExpenses((prev) => [formatted, ...prev]);
          }
        }}
      />

      {/* ── Edit Expense Modal ── */}
      <ExpenseEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedExpense(null);
        }}
        onSuccess={handleSaveExpense}
        expenseToEdit={selectedExpense}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setExpenseToDelete(null);
        }}
        onConfirm={handleDeleteExpense}
        title="Delete Expense Voucher"
        description="Are you sure you want to permanently delete this expense voucher? This will remove the transaction from project cost commitments and general ledger journals."
        itemName={expenseToDelete ? `${expenseToDelete.number} • ${expenseToDelete.description}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
