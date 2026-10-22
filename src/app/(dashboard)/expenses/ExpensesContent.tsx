"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Receipt,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
  Camera,
  Edit3,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { ReceiptCaptureModal } from "@/components/expenses/ReceiptCaptureModal";
import { ExpenseEditModal, ExpenseFormData } from "@/components/modals/ExpenseEditModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteExpense } from "@/app/actions/expenseActions";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounting/defaultCoa";

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

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export default function ExpensesContent() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);

  // Edit / Delete Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        setIsLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from("expenses")
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("date", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      const mapped: ExpenseItem[] = (data || []).map((e) => {
        const amt = parseFloat(e.total_amount || "0");
        return {
          id: e.id,
          number: e.number || `EXP-${e.id.slice(0, 8)}`,
          date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
          description: e.description || "Pengeluaran Proyek/Operasional",
          merchant: e.merchant,
          category: e.category || "Lain-lain",
          total_amount: isNaN(amt) ? 0 : amt,
          status: e.status || "POSTED",
        };
      });
      setExpenses(mapped);
    } catch (e: any) {
      console.error("Error fetching expenses:", e);
      setError(e?.message || "Gagal memuat daftar pengeluaran.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSaveExpense = async () => {
    await fetchExpenses();
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      setIsDeleting(true);
      await deleteExpense(expenseToDelete.id);
      await fetchExpenses();
      setShowDelete(false);
      setExpenseToDelete(null);
    } catch (err: any) {
      console.error("Expense delete error:", err);
      alert(err?.message || "Gagal menghapus pengeluaran.");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((s, e) => s + (isNaN(e.total_amount) ? 0 : e.total_amount), 0);
  const pendingApprovalsCount = expenses.filter((e) => e.status === "SUBMITTED").length;
  const postedCount = expenses.filter((e) => e.status === "POSTED" || e.status === "APPROVED").length;

  // Compute Primary Cost Driver dynamically from real data
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || "Lain-lain";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + e.total_amount;
  });
  const categoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const primaryDriverName = categoryEntries.length > 0 ? categoryEntries[0][0] : "-";
  const primaryDriverPercent =
    categoryEntries.length > 0 && totalExpenseAmount > 0
      ? Math.round((categoryEntries[0][1] / totalExpenseAmount) * 100)
      : 0;

  // Available categories for filter dropdown
  const availableCategories = Array.from(
    new Set([
      ...DEFAULT_CHART_OF_ACCOUNTS.filter(
        (a) => a.category_group === "HPP" || a.category_group === "OPEX"
      ).map((a) => a.name),
      ...expenses.map((e) => e.category),
    ])
  ).filter(Boolean);

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
          title="Total Pengeluaran Tercatat"
          value={isLoading ? "..." : formatCurrency(totalExpenseAmount)}
          subtitle={`${expenses.length} transaksi dibukukan`}
          icon={Receipt}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
          gradient
        />
        <StatCard
          title="Menunggu Persetujuan"
          value={isLoading ? "..." : `${pendingApprovalsCount} Pengajuan`}
          subtitle="Verifikasi nota & persetujuan owner"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Biaya Terposting / Disetujui"
          value={isLoading ? "..." : `${postedCount} Transaksi`}
          subtitle="Telah masuk dalam buku besar"
          icon={CheckCircle2}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Kategori Terbesar"
          value={isLoading ? "..." : primaryDriverName}
          subtitle={
            categoryEntries.length > 0
              ? `${primaryDriverPercent}% dari total pengeluaran`
              : "Belum ada data pengeluaran"
          }
          icon={Tag}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchExpenses}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Control & Filter Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nomor voucher, deskripsi, merchant / toko..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Category & Status Filters + Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none max-w-[180px] truncate"
          >
            <option value="ALL">Semua Kategori</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "Semua" },
              { id: "SUBMITTED", label: "Diajukan" },
              { id: "APPROVED", label: "Disetujui" },
              { id: "POSTED", label: "Terposting" },
              { id: "REJECTED", label: "Ditolak" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 transition-all text-xs",
                  statusFilter === tab.id
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* OCR Scan Button */}
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 active:scale-95 transition-all shadow-sm"
          >
            <Camera className="h-4 w-4 text-zinc-600" />
            <span>Scan Struk</span>
          </button>

          {/* Manual Input Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedExpense(null);
              setShowEditModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Input Biaya</span>
          </button>
        </div>
      </div>

      {/* ── Skeleton Loading ── */}
      {isLoading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-6 w-48 bg-zinc-100 rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-zinc-50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && expenses.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-4">
            <Receipt className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900">Belum Ada Pengeluaran Tercatat</h4>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
            Mulai catat pengeluaran proyek atau operasional kantor dengan foto struk OCR atau input manual.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Scan Bon / Struk</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedExpense(null);
                setShowEditModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Input Manual</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Expenses Table ── */}
      {!isLoading && expenses.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-zinc-950" />
                Daftar Voucher Biaya &amp; Pengeluaran
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Semua pengeluaran bahan material, upah kerja, dan biaya operasional kantor
              </p>
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              {filteredExpenses.length} transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">No. Voucher</th>
                  <th className="pb-3">Tanggal</th>
                  <th className="pb-3">Deskripsi &amp; Toko</th>
                  <th className="pb-3">Kategori</th>
                  <th className="pb-3 text-right">Nominal</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 pr-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-zinc-50/70 transition-colors"
                  >
                    <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                      {exp.number}
                    </td>
                    <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-zinc-900 line-clamp-1">
                        {exp.description}
                      </p>
                      {exp.merchant && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {exp.merchant}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap text-right">
                      {formatCurrency(exp.total_amount)}
                    </td>
                    <td className="py-3.5 text-center whitespace-nowrap">
                      <Badge
                        variant={
                          exp.status === "POSTED"
                            ? "neutral"
                            : exp.status === "APPROVED"
                            ? "success"
                            : exp.status === "SUBMITTED"
                            ? "warning"
                            : exp.status === "REJECTED"
                            ? "error"
                            : "neutral"
                        }
                        size="sm"
                        dot
                      >
                        {exp.status === "POSTED"
                          ? "Terposting"
                          : exp.status === "APPROVED"
                          ? "Disetujui"
                          : exp.status === "SUBMITTED"
                          ? "Diajukan"
                          : exp.status === "REJECTED"
                          ? "Ditolak"
                          : "Draft"}
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExpense({
                              id: exp.id,
                              number: exp.number,
                              date: exp.date,
                              description: exp.description,
                              merchant: exp.merchant,
                              category: exp.category,
                              total_amount: exp.total_amount,
                              status: exp.status,
                            });
                            setShowEditModal(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                          title="Edit Pengeluaran"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpenseToDelete(exp);
                            setShowDelete(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Hapus Pengeluaran"
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
      )}

      {/* ── Receipt Capture Modal (OCR Scan) ── */}
      <ReceiptCaptureModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onSuccess={handleSaveExpense}
      />

      {/* ── Expense Edit Modal ── */}
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
        title="Hapus Voucher Biaya"
        description="Apakah Anda yakin ingin menghapus voucher pengeluaran ini secara permanen?"
        itemName={expenseToDelete ? `${expenseToDelete.number} • ${formatCurrency(expenseToDelete.total_amount)}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
