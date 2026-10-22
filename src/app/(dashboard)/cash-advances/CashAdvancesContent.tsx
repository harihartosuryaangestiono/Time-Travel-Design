"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Coins,
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { CashAdvanceModal, CashAdvanceFormData } from "@/components/modals/CashAdvanceModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteCashAdvance } from "@/app/actions/cashAdvanceActions";

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
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "DISBURSED" | "PARTIALLY_SETTLED" | "SETTLED" | "REJECTED" | "CANCELLED";
}

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export default function CashAdvancesContent() {
  const [advances, setAdvances] = useState<CashAdvanceItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<CashAdvanceFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState<CashAdvanceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAdvances = async () => {
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
        .from("cash_advances")
        .select(`
          *,
          employee:profiles!employee_id(full_name, email)
        `)
        .eq("organization_id", membership.organization_id)
        .order("date", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      const mapped: CashAdvanceItem[] = (data || []).map((ca: any) => {
        const empName = ca.employee?.full_name || ca.employee?.email || "Karyawan / Pelaksana";
        const amt = parseFloat(ca.amount || "0");
        const disb = parseFloat(ca.disbursed_amount || ca.amount || "0");
        const setl = parseFloat(ca.settled_amount || "0");
        const retn = parseFloat(ca.returned_amount || "0");

        return {
          id: ca.id,
          number: ca.number,
          date: ca.date ? new Date(ca.date).toISOString().split("T")[0] : "",
          purpose: ca.purpose,
          employee: empName,
          amount: isNaN(amt) ? 0 : amt,
          disbursed_amount: isNaN(disb) ? 0 : disb,
          settled_amount: isNaN(setl) ? 0 : setl,
          returned_amount: isNaN(retn) ? 0 : retn,
          status: ca.status || "DISBURSED",
        };
      });
      setAdvances(mapped);
    } catch (e: any) {
      console.error("Error fetching cash advances:", e);
      setError(e?.message || "Gagal memuat daftar kasbon.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const handleSaveAdvance = async () => {
    await fetchAdvances();
  };

  const handleDeleteAdvance = async () => {
    if (!advanceToDelete) return;
    try {
      setIsDeleting(true);
      await deleteCashAdvance(advanceToDelete.id);
      await fetchAdvances();
      setShowDelete(false);
      setAdvanceToDelete(null);
    } catch (err: any) {
      console.error("Delete cash advance error:", err);
      alert(err?.message || "Gagal menghapus kasbon.");
    } finally {
      setIsDeleting(false);
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

  const totalDisbursed = advances.reduce((sum, a) => sum + (Number(a.disbursed_amount) || 0), 0);
  const totalSettledAmount = advances.reduce((sum, a) => sum + (Number(a.settled_amount) || 0) + (Number(a.returned_amount) || 0), 0);
  const settlementVelocity = totalDisbursed > 0 ? Math.round((totalSettledAmount / totalDisbursed) * 100) : 0;

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
          title="Kasbon Berjalan (Open)"
          value={isLoading ? "..." : formatCurrency(totalOutstanding)}
          subtitle="Menunggu pertanggungjawaban nota"
          icon={Coins}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
          gradient
        />
        <StatCard
          title="Pengajuan Terbuka"
          value={isLoading ? "..." : `${activeCount} Berkas`}
          subtitle="Belum selesai direkonsiliasi"
          icon={Clock}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-600"
        />
        <StatCard
          title="Total Selesai (Lunas)"
          value={isLoading ? "..." : formatCurrency(totalSettled)}
          subtitle="Telah selesai dipertanggungjawabkan"
          icon={CheckCircle2}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Tingkat Penyelesaian"
          value={isLoading ? "..." : `${settlementVelocity}%`}
          subtitle="Rasio kasbon telah dipertanggungjawabkan"
          icon={DollarSign}
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
            onClick={fetchAdvances}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Controls Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nomor kasbon, penerima, atau keperluan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "Semua" },
              { id: "SUBMITTED", label: "Diajukan" },
              { id: "DISBURSED", label: "Dicairkan" },
              { id: "PARTIALLY_SETTLED", label: "Sebagian" },
              { id: "SETTLED", label: "Lunas" },
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

          <button
            type="button"
            onClick={() => {
              setSelectedAdvance(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Kasbon</span>
          </button>
        </div>
      </div>

      {/* ── Skeleton Loading ── */}
      {isLoading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-6 w-48 bg-zinc-100 rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-zinc-50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && advances.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-4">
            <Coins className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900">Belum Ada Pengajuan Kasbon</h4>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
            Catat kasbon operasional tukang, mandor, atau tim lapangan untuk memantau dana keluar yang belum direkonsiliasi.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedAdvance(null);
              setShowModal(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Buat Kasbon Pertama</span>
          </button>
        </div>
      )}

      {/* ── Cash Advances Table ── */}
      {!isLoading && advances.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Coins className="h-5 w-5 text-zinc-950" />
                Buku Kasbon &amp; Uang Muka Operasional
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Monitor pencairan dana, progres penyelesaian nota, dan sisa kewajiban kasbon
              </p>
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              {filteredAdvances.length} data ditemukan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">Nomor Ref</th>
                  <th className="pb-3">Tanggal</th>
                  <th className="pb-3">Penerima &amp; Keperluan</th>
                  <th className="pb-3 text-right">Dicairkan</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Dipertanggungjawabkan</th>
                  <th className="pb-3 text-right">Sisa Kasbon</th>
                  <th className="pb-3 pr-2 text-right">Aksi</th>
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
                      <td className="py-3.5 font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap text-right">
                        {formatCurrency(ca.disbursed_amount)}
                      </td>
                      <td className="py-3.5 text-center whitespace-nowrap">
                        <Badge
                          variant={
                            isComplete
                              ? "success"
                              : ca.status === "PARTIALLY_SETTLED"
                              ? "warning"
                              : ca.status === "REJECTED"
                              ? "error"
                              : "neutral"
                          }
                          size="sm"
                          dot
                        >
                          {isComplete
                            ? "Lunas"
                            : ca.status === "PARTIALLY_SETTLED"
                            ? "Sebagian"
                            : ca.status === "DISBURSED"
                            ? "Dicairkan"
                            : ca.status === "SUBMITTED"
                            ? "Diajukan"
                            : ca.status === "REJECTED"
                            ? "Ditolak"
                            : "Draft"}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                        {formatCurrency(ca.settled_amount + ca.returned_amount)}
                      </td>
                      <td className="py-3.5 text-right font-mono tabular-nums font-semibold text-zinc-900 whitespace-nowrap">
                        {formatCurrency(remaining)}
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
                                status: ca.status as any,
                              });
                              setShowModal(true);
                            }}
                            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                            title="Edit Kasbon"
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
                            title="Hapus Kasbon"
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
      )}

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
        title="Hapus Pengajuan Kasbon"
        description="Apakah Anda yakin ingin menghapus data kasbon ini secara permanen?"
        itemName={advanceToDelete ? `${advanceToDelete.number} • ${advanceToDelete.employee}` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
