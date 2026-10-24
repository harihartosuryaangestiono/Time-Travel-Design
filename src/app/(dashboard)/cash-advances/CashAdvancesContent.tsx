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
  Download,
  CreditCard,
  Users,
  HardHat,
  ShieldCheck,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { CashAdvanceModal, CashAdvanceFormData } from "@/components/modals/CashAdvanceModal";
import { AdvanceSettlementModal } from "@/components/modals/AdvanceSettlementModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import {
  deleteCashAdvance,
  approveCashAdvance,
  getCashAdvanceRecap,
  AdvanceRecapItem,
} from "@/app/actions/cashAdvanceActions";

interface CashAdvanceItem {
  id: string;
  number: string;
  date: string;
  advance_type: "EMPLOYEE" | "MANDOR";
  purpose: string;
  employee: string;
  mandor_name?: string;
  projectName?: string;
  project_id?: string;
  amount: number;
  disbursed_amount: number;
  settled_amount: number;
  returned_amount: number;
  open_balance: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "DISBURSED" | "PARTIALLY_SETTLED" | "SETTLED" | "REJECTED" | "CANCELLED";
  employee_id?: string;
  created_by?: string;
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
  const [recapItems, setRecapItems] = useState<AdvanceRecapItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "RECAP">("TRANSACTIONS");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<CashAdvanceFormData | null>(null);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<CashAdvanceItem | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState<CashAdvanceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState<string | null>(null);

  const fetchAdvancesAndRecap = async () => {
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
      setCurrentUserId(user.id);

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
        .select("*")
        .eq("organization_id", membership.organization_id)
        .order("date", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      const employeeIds = Array.from(
        new Set((data || []).map((advance) => advance.employee_id).filter(Boolean))
      ) as string[];
      const projectIds = Array.from(
        new Set((data || []).map((advance) => advance.project_id).filter(Boolean))
      ) as string[];
      const [{ data: employees, error: employeesError }, { data: projects, error: projectsError }] =
        await Promise.all([
          employeeIds.length
            ? supabase.from("profiles").select("id, full_name, email").in("id", employeeIds)
            : Promise.resolve({ data: [], error: null }),
          projectIds.length
            ? supabase
                .from("projects")
                .select("id, name, code")
                .eq("organization_id", membership.organization_id)
                .in("id", projectIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (employeesError) throw new Error(employeesError.message);
      if (projectsError) throw new Error(projectsError.message);

      const employeesById = new Map((employees || []).map((employee) => [employee.id, employee]));
      const projectsById = new Map((projects || []).map((project) => [project.id, project]));

      const mapped: CashAdvanceItem[] = (data || []).map((ca: any) => {
        const employee = employeesById.get(ca.employee_id);
        const project = ca.project_id ? projectsById.get(ca.project_id) : undefined;
        const isMandor = ca.advance_type === "MANDOR";
        const empName = isMandor
          ? ca.mandor_name || "Mandor Proyek"
          : employee?.full_name || employee?.email || "Karyawan";

        const amt = parseFloat(ca.amount || "0");
        const disb = parseFloat(ca.disbursed_amount || ca.amount || "0");
        const setl = parseFloat(ca.settled_amount || "0");
        const retn = parseFloat(ca.returned_amount || "0");
        const openBal = Math.max(0, disb - setl - retn);

        return {
          id: ca.id,
          number: ca.number,
          date: ca.date ? new Date(ca.date).toISOString().split("T")[0] : "",
          advance_type: ca.advance_type || "EMPLOYEE",
          purpose: ca.purpose,
          employee: empName,
          mandor_name: ca.mandor_name,
          projectName: project?.name,
          project_id: ca.project_id,
          amount: isNaN(amt) ? 0 : amt,
          disbursed_amount: isNaN(disb) ? 0 : disb,
          settled_amount: isNaN(setl) ? 0 : setl,
          returned_amount: isNaN(retn) ? 0 : retn,
          open_balance: isNaN(openBal) ? 0 : openBal,
          status: ca.status || "DISBURSED",
          employee_id: ca.employee_id,
          created_by: ca.created_by,
        };
      });

      setAdvances(mapped);

      // Fetch Rekap Kasbon
      try {
        const recap = await getCashAdvanceRecap();
        setRecapItems(recap);
      } catch (rErr) {
        console.error("Gagal memuat rekap kasbon:", rErr);
      }
    } catch (e: any) {
      console.error("Error fetching cash advances:", e);
      setError(e?.message || "Gagal memuat daftar kasbon.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvancesAndRecap();
  }, []);

  const handleSaveAdvance = async () => {
    await fetchAdvancesAndRecap();
  };

  const handleSettlementSuccess = async () => {
    await fetchAdvancesAndRecap();
  };

  const handleApprove = async (advance: CashAdvanceItem) => {
    try {
      setIsApproving(advance.id);
      await approveCashAdvance(advance.id);
      await fetchAdvancesAndRecap();
    } catch (err: any) {
      alert(err?.message || "Gagal menyetujui kasbon.");
    } finally {
      setIsApproving(null);
    }
  };

  const handleDeleteAdvance = async () => {
    if (!advanceToDelete) return;
    try {
      setIsDeleting(true);
      await deleteCashAdvance(advanceToDelete.id);
      await fetchAdvancesAndRecap();
      setShowDelete(false);
      setAdvanceToDelete(null);
    } catch (err: any) {
      console.error("Delete cash advance error:", err);
      alert(err?.message || "Gagal menghapus kasbon.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV / Excel Rekapitulasi
  const handleExportExcel = () => {
    const headers = [
      "Nama Penerima",
      "Tipe Kasbon",
      "Proyek Terkait",
      "Plafon (Limit)",
      "Total Kasbon Dicairkan",
      "Sudah Diselesaikan / Nota",
      "Sisa Kasbon (Open Balance)",
      "Sisa Plafon Tersedia",
      "Status Plafon",
    ];

    const rows = recapItems.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      item.type === "MANDOR" ? "Mandor (Upah Tukang)" : "Karyawan / Owner",
      `"${(item.projectName || "-").replace(/"/g, '""')}"`,
      item.maxAdvanceAmount,
      item.totalDisbursed,
      item.totalSettled,
      item.openBalance,
      item.remainingLimit,
      item.statusLimit,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Kasbon_Plafon_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalOutstanding = advances
    .filter((a) => a.status === "DISBURSED" || a.status === "PARTIALLY_SETTLED")
    .reduce((sum, a) => sum + a.open_balance, 0);

  const totalSettled = advances
    .filter((a) => a.status === "SETTLED")
    .reduce((sum, a) => sum + a.amount, 0);

  const activeCount = advances.filter(
    (a) => a.status === "DISBURSED" || a.status === "PARTIALLY_SETTLED"
  ).length;

  const totalDisbursed = advances.reduce((sum, a) => sum + (Number(a.disbursed_amount) || 0), 0);
  const totalSettledAmount = advances.reduce(
    (sum, a) => sum + (Number(a.settled_amount) || 0) + (Number(a.returned_amount) || 0),
    0
  );
  const settlementVelocity = totalDisbursed > 0 ? Math.round((totalSettledAmount / totalDisbursed) * 100) : 0;

  const filteredAdvances = advances.filter((ca) => {
    const matchesSearch =
      ca.number.toLowerCase().includes(search.toLowerCase()) ||
      ca.purpose.toLowerCase().includes(search.toLowerCase()) ||
      ca.employee.toLowerCase().includes(search.toLowerCase()) ||
      (ca.projectName && ca.projectName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || ca.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Kasbon Berjalan (Open Balance)"
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
          title="Tingkat Rekonsiliasi"
          value={isLoading ? "..." : `${settlementVelocity}%`}
          subtitle="Rasio kasbon telah selesai"
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
            onClick={fetchAdvancesAndRecap}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Main View Tabs & Controls Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* Toggle Tab: Transaksi vs Rekap Semua Orang */}
          <div className="flex items-center rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("TRANSACTIONS")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                activeTab === "TRANSACTIONS"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Daftar Kasbon</span>
            </button>
            <button
              onClick={() => setActiveTab("RECAP")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                activeTab === "RECAP"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Rekap Plafon Semua Orang</span>
            </button>
          </div>

          {activeTab === "RECAP" && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
              title="Unduh Rekapitulasi Kasbon & Plafon ke format Excel/CSV"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Excel / CSV</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "TRANSACTIONS" && (
            <>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Cari kasbon, penerima, proyek..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
                {[
                  { id: "ALL", label: "Semua" },
                  { id: "SUBMITTED", label: "Diajukan" },
                  { id: "DISBURSED", label: "Dicairkan" },
                  { id: "PARTIALLY_SETTLED", label: "Sebagian" },
                  { id: "SETTLED", label: "Lunas" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 transition-all text-xs",
                      statusFilter === tab.id
                        ? "bg-white text-zinc-950 font-bold shadow-sm"
                        : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedAdvance(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Kasbon</span>
          </button>
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
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

      {/* ── TAB 1: TRANSAKSI KASBON ── */}
      {!isLoading && activeTab === "TRANSACTIONS" && (
        <>
          {advances.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-4">
                <Coins className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-zinc-900">Belum Ada Pengajuan Kasbon</h4>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                Catat kasbon karyawan atau mandor proyek (Upah Tukang) untuk memantau dana keluar dan pelunasannya.
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
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-zinc-950" />
                    Buku Kasbon &amp; Uang Muka Operasional
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Monitor pencairan dana, kolom Open Balance, dan pelunasan bertahap
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
                      <th className="pb-3">Tipe &amp; Penerima</th>
                      <th className="pb-3">Keperluan</th>
                      <th className="pb-3 text-right">Dicairkan</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3 text-right">Diselesaikan</th>
                      <th className="pb-3 text-right font-bold text-amber-800">Open Balance</th>
                      <th className="pb-3 pr-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredAdvances.map((ca) => {
                      const isComplete = ca.status === "SETTLED";
                      const isMandor = ca.advance_type === "MANDOR";
                      const canSettle = ca.status === "DISBURSED" || ca.status === "PARTIALLY_SETTLED";
                      const canApprove = (ca.status === "SUBMITTED" || ca.status === "DRAFT");
                      const isOwnAdvance = ca.employee_id === currentUserId || ca.created_by === currentUserId;

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
                            <div className="flex items-center gap-1.5">
                              {isMandor ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                  <HardHat className="h-3 w-3" />
                                  Mandor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                                  <Users className="h-3 w-3" />
                                  Karyawan
                                </span>
                              )}
                              <span className="font-semibold text-zinc-900">{ca.employee}</span>
                            </div>
                            {isMandor && ca.projectName && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">
                                Proyek: {ca.projectName} (Upah Tukang)
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 pr-2 text-zinc-600 max-w-xs truncate">
                            {ca.purpose}
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
                                : ca.status === "APPROVED"
                                ? "Disetujui"
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
                          <td className="py-3.5 text-right font-mono tabular-nums font-bold text-amber-700 whitespace-nowrap">
                            {formatCurrency(ca.open_balance)}
                          </td>
                          <td className="py-3.5 pr-2 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Tombol Pelunasan */}
                              {canSettle && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettlementTarget(ca);
                                    setShowSettlementModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  title="Proses Pelunasan Kasbon"
                                >
                                  <CreditCard className="h-3 w-3" />
                                  <span>Pelunasan</span>
                                </button>
                              )}

                              {/* Tombol Setujui (Larang Approve Diri Sendiri) */}
                              {canApprove && (
                                <button
                                  type="button"
                                  disabled={isOwnAdvance || isApproving === ca.id}
                                  onClick={() => handleApprove(ca)}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors border",
                                    isOwnAdvance
                                      ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                                      : "bg-zinc-900 text-white hover:bg-black border-zinc-900"
                                  )}
                                  title={
                                    isOwnAdvance
                                      ? "Anda tidak diperkenankan menyetujui pengajuan kasbon Anda sendiri"
                                      : "Setujui pengajuan kasbon"
                                  }
                                >
                                  <Check className="h-3 w-3" />
                                  <span>{isApproving === ca.id ? "..." : "Setujui"}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAdvance({
                                    id: ca.id,
                                    number: ca.number,
                                    date: ca.date,
                                    advance_type: ca.advance_type,
                                    purpose: ca.purpose,
                                    employee: ca.employee,
                                    mandor_name: ca.mandor_name,
                                    project_id: ca.project_id,
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
        </>
      )}

      {/* ── TAB 2: REKAP SEMUA ORANG & PLAFON (Karyawan & Mandor) ── */}
      {!isLoading && activeTab === "RECAP" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 mb-4 gap-2">
            <div>
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                <Users className="h-5 w-5 text-zinc-950" />
                Rekapitulasi Kasbon &amp; Plafon per Orang
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Monitoring plafon individu, total dicairkan, sudah dibayar, Open Balance, dan sisa plafon
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Excel / CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">Nama Penerima</th>
                  <th className="pb-3">Tipe</th>
                  <th className="pb-3">Proyek Terkait</th>
                  <th className="pb-3 text-right">Plafon (Limit)</th>
                  <th className="pb-3 text-right">Total Kasbon</th>
                  <th className="pb-3 text-right">Sudah Dibayar</th>
                  <th className="pb-3 text-right font-bold text-amber-800">Open Balance</th>
                  <th className="pb-3 text-right font-bold text-emerald-800">Sisa Plafon</th>
                  <th className="pb-3 pr-2 text-center">Status Plafon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recapItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-400">
                      Belum ada data penerima kasbon yang tercatat.
                    </td>
                  </tr>
                ) : (
                  recapItems.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3.5 pl-2 font-semibold text-zinc-950">
                        {item.name}
                      </td>
                      <td className="py-3.5">
                        {item.type === "MANDOR" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            <HardHat className="h-3 w-3" />
                            Mandor Proyek
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            <Users className="h-3 w-3" />
                            Karyawan / Tim
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-zinc-500">
                        {item.projectName || "-"}
                      </td>
                      <td className="py-3.5 text-right font-mono font-semibold text-zinc-800 tabular-nums">
                        {item.maxAdvanceAmount > 0 ? formatCurrency(item.maxAdvanceAmount) : "Tanpa Limit"}
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-700 tabular-nums">
                        {formatCurrency(item.totalDisbursed)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-700 tabular-nums">
                        {formatCurrency(item.totalSettled)}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-amber-700 tabular-nums">
                        {formatCurrency(item.openBalance)}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {item.maxAdvanceAmount > 0 ? formatCurrency(item.remainingLimit) : "Tersedia"}
                      </td>
                      <td className="py-3.5 pr-2 text-center">
                        <Badge
                          variant={
                            item.statusLimit === "MELEBIHI_LIMIT"
                              ? "error"
                              : item.statusLimit === "MENDEKATI_LIMIT"
                              ? "warning"
                              : "success"
                          }
                          size="sm"
                          dot
                        >
                          {item.statusLimit === "MELEBIHI_LIMIT"
                            ? "Melebihi Limit"
                            : item.statusLimit === "MENDEKATI_LIMIT"
                            ? "Mendekati Limit"
                            : "Aman"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
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

      {/* ── Advance Settlement Modal ── */}
      <AdvanceSettlementModal
        isOpen={showSettlementModal}
        onClose={() => {
          setShowSettlementModal(false);
          setSettlementTarget(null);
        }}
        onSuccess={handleSettlementSuccess}
        advance={settlementTarget}
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
