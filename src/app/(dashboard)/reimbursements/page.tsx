"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  FileCheck,
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Camera,
  Edit3,
  Trash2,
  Receipt,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { ReimbursementModal, ReimbursementFormData } from "@/components/modals/ReimbursementModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { deleteReimbursementRecord, getReimbursements } from "@/app/actions/reimbursementActions";

interface ReimbursementItem {
  id: string;
  number: string;
  date: string;
  description: string;
  employee_id?: string;
  employee: string;
  amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  paid_date: string | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReimbursementsPage() {
  const [data, setData] = useState<ReimbursementItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit / Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ReimbursementFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState<ReimbursementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const records = await getReimbursements();

      const mapped: ReimbursementItem[] = records.map((r: any) => {
        const empName =
          r.employee?.full_name ||
          (r.employee?.email ? r.employee.email.split("@")[0] : "Anggota Tim");
        const amt = parseFloat(r.amount || "0");

        return {
          id: r.id,
          number: r.number,
          date: r.date ? r.date.split("T")[0] : "-",
          description: r.description,
          employee_id: r.employee_id,
          employee: empName,
          amount: isNaN(amt) ? 0 : amt,
          status: r.status,
          paid_date: r.paid_date ? r.paid_date.split("T")[0] : null,
        };
      });

      setData(mapped);
    } catch (e: any) {
      console.error("Gagal memuat klaim reimbursement:", e);
      setErrorMessage(e.message || "Gagal memuat data reimbursement.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveClaim = async () => {
    await fetchData();
  };

  const handleDeleteClaim = async () => {
    if (!claimToDelete) return;
    try {
      setIsDeleting(true);
      await deleteReimbursementRecord(claimToDelete.id);
      setShowDelete(false);
      setClaimToDelete(null);
      await fetchData();
    } catch (err: any) {
      alert(`Gagal menghapus klaim: ${err.message || "Terjadi kesalahan"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalReimbursed = data
    .filter((r) => r.status === "PAID")
    .reduce((s, r) => s + (r.amount || 0), 0);

  const pendingCount = data.filter((r) => r.status === "SUBMITTED").length;
  const approvedCount = data.filter((r) => r.status === "APPROVED").length;
  const totalClaimsSum = data.reduce((s, r) => s + (r.amount || 0), 0);

  const filteredData = data.filter((r) => {
    const s = search.toLowerCase();
    const matchesSearch =
      r.number.toLowerCase().includes(s) ||
      r.description.toLowerCase().includes(s) ||
      r.employee.toLowerCase().includes(s);

    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Klaim Dicairkan"
          value={isLoading ? "..." : formatCurrency(totalReimbursed)}
          subtitle="Telah ditransfer ke anggota tim"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Menunggu Review"
          value={isLoading ? "..." : `${pendingCount} Pengajuan`}
          subtitle="Menunggu verifikasi bukti bon"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Disetujui untuk Bayar"
          value={isLoading ? "..." : `${approvedCount} Klaim`}
          subtitle="Telah disetujui, siap transfer"
          icon={DollarSign}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <StatCard
          title="Total Nilai Klaim"
          value={isLoading ? "..." : formatCurrency(totalClaimsSum)}
          subtitle={`Dari total ${data.length} pengajuan`}
          icon={FileCheck}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        />
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
          <button
            onClick={() => fetchData()}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Control Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nomor klaim, keperluan, atau nama staf..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            {[
              { id: "ALL", label: "Semua" },
              { id: "SUBMITTED", label: "Menunggu" },
              { id: "APPROVED", label: "Disetujui" },
              { id: "PAID", label: "Dicairkan" },
              { id: "REJECTED", label: "Ditolak" },
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
              setSelectedClaim(null);
              setShowEditModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Klaim Baru</span>
          </button>
        </div>
      </div>

      {/* ── Reimbursements Table ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-zinc-950" />
              Klaim Reimbursement Operasional
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Daftar pengeluaran operasional dan talangan anggota tim
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {isLoading ? "Memuat..." : `${filteredData.length} transaksi`}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-xl bg-zinc-100"
              />
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center my-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-zinc-200 text-zinc-400 mb-3 shadow-sm">
              <Receipt className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-900 mb-1">
              {search || statusFilter !== "ALL"
                ? "Tidak Ada Klaim Sesuai Filter"
                : "Belum Ada Pengajuan Reimbursement"}
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              {search || statusFilter !== "ALL"
                ? "Cobalah untuk mengubah kata kunci pencarian atau memilih filter status lain."
                : "Ajukan reimbursement pengeluaran operasional pertama Anda dengan menekan tombol di bawah."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedClaim(null);
                setShowEditModal(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Ajukan Reimbursement</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">No. Referensi</th>
                  <th className="pb-3">Tanggal</th>
                  <th className="pb-3">Pemohon &amp; Keperluan</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Tgl Dicairkan</th>
                  <th className="pb-3 text-right">Nominal</th>
                  <th className="pb-3 pr-2 text-right">Aksi</th>
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
                            : item.status === "REJECTED"
                            ? "error"
                            : "warning"
                        }
                        size="sm"
                        dot
                      >
                        {item.status === "PAID"
                          ? "Dicairkan"
                          : item.status === "APPROVED"
                          ? "Disetujui"
                          : item.status === "REJECTED"
                          ? "Ditolak"
                          : item.status === "DRAFT"
                          ? "Draft"
                          : "Menunggu"}
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
                              employee_id: item.employee_id,
                              employee: item.employee,
                              amount: item.amount,
                              status: item.status,
                              paid_date: item.paid_date,
                            });
                            setShowEditModal(true);
                          }}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                          title="Edit Klaim"
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
                          title="Hapus Klaim"
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
        )}
      </div>

      {/* ── Modal Edit/Create ── */}
      <ReimbursementModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
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
        title="Hapus Klaim Reimbursement"
        description={`Apakah Anda yakin ingin menghapus klaim "${claimToDelete?.number}" (${claimToDelete?.description})? Tindakan ini tidak dapat dibatalkan.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
