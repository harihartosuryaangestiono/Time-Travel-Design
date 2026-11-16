"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ClipboardCheck,
  ArrowLeft,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  Sliders,
  DollarSign,
  TrendingDown,
  TrendingUp,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  getRapProjectDetail,
  updateRapItem,
  getBudgetVsActualComparison,
  RapProjectItem,
  RapWorkItem,
  BudgetVsActualComparison,
} from "@/app/actions/cost-control/rapActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function RapDetailWorksheetPage() {
  const params = useParams();
  const rapId = params.id as string;

  const [rap, setRap] = useState<RapProjectItem | null>(null);
  const [comparison, setComparison] = useState<BudgetVsActualComparison | null>(null);
  const [activeTab, setActiveTab] = useState<"ITEMS" | "COMPARISON">("ITEMS");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit item modal
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RapWorkItem | null>(null);
  const [editForm, setEditForm] = useState({
    target_material_cost: 0,
    target_labor_cost: 0,
    target_equipment_cost: 0,
    procurement_schedule: "",
    execution_schedule: "",
    pic_name: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const detail = await getRapProjectDetail(rapId);
      setRap(detail);

      if (detail.project_id) {
        const comp = await getBudgetVsActualComparison(detail.project_id);
        setComparison(comp);
      }
    } catch (err: any) {
      console.error("Gagal memuat detail RAP:", err);
      setError(err?.message || "Gagal memuat worksheet RAP.");
    } finally {
      setIsLoading(false);
    }
  }, [rapId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenEdit = (item: RapWorkItem) => {
    setEditingItem(item);
    setEditForm({
      target_material_cost: item.target_material_cost,
      target_labor_cost: item.target_labor_cost,
      target_equipment_cost: item.target_equipment_cost,
      procurement_schedule: item.procurement_schedule || "",
      execution_schedule: item.execution_schedule || "",
      pic_name: item.pic_name || "",
    });
    setShowEditItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateRapItem(editingItem.id, rapId, {
        target_material_cost: Number(editForm.target_material_cost),
        target_labor_cost: Number(editForm.target_labor_cost),
        target_equipment_cost: Number(editForm.target_equipment_cost),
        procurement_schedule: editForm.procurement_schedule,
        execution_schedule: editForm.execution_schedule,
        pic_name: editForm.pic_name,
      });

      setSuccessMsg("Target biaya item RAP berhasil diperbarui.");
      setShowEditItemModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal memperbarui item RAP.");
    }
  };

  if (!rap && !isLoading) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500">Dokumen RAP tidak ditemukan.</p>
        <Link href="/cost-control/rap" className="mt-4 inline-flex items-center text-xs font-semibold text-zinc-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Daftar RAP
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/cost-control/rap"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-zinc-500">{rap?.rap_number}</span>
              <Badge variant="neutral">{rap?.status}</Badge>
              <span className="text-[11px] text-zinc-400">Versi {rap?.version}</span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
              {rap?.title}
            </h1>
            <p className="text-xs text-zinc-500">
              Proyek: {rap?.project?.name} ({rap?.project?.code}) • Diturunkan dari {rap?.rab?.rab_number || "RAB"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Target Anggaran RAP Internal"
          value={formatCurrency(rap?.total_planned_budget || 0)}
          subtitle="Plafon maksimal pengeluaran operasional"
          icon={ClipboardCheck}
        />
        <StatCard
          title="Target Efisiensi Internal"
          value={formatCurrency(rap?.target_savings || 0)}
          subtitle="Penghematan terhadap penawaran RAB"
          icon={TrendingDown}
        />
        <StatCard
          title="Total Realisasi Biaya Saat Ini"
          value={formatCurrency(comparison?.totalActualCost || 0)}
          subtitle="Material + Upah + Operasional riil"
          icon={DollarSign}
        />
        <StatCard
          title="Perkiraan Profit Akhir Proyek"
          value={comparison?.projectedProfit == null
            ? "Belum tersedia"
            : formatCurrency(comparison.projectedProfit)}
          subtitle={comparison?.projectedMarginPercent == null
            ? "Memerlukan progres terverifikasi dan pengeluaran aktual"
            : `Margin keuntungan ~${comparison.projectedMarginPercent}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
        <button
          onClick={() => setActiveTab("ITEMS")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "ITEMS"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          Lembar Kerja RAP & Jadwal Pengadaan ({rap?.items?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("COMPARISON")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "COMPARISON"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Budget vs Actual vs Realisasi
        </button>
      </div>

      {/* TAB 1: RAP WORKSHEET ITEMS TABLE */}
      {activeTab === "ITEMS" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Divisi & Pekerjaan</th>
                  <th className="px-4 py-3.5 text-right">Volume</th>
                  <th className="px-4 py-3.5 text-right">Target Material</th>
                  <th className="px-4 py-3.5 text-right">Target Upah</th>
                  <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Target Satuan</th>
                  <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Total Budget</th>
                  <th className="px-4 py-3.5">Jadwal Pengadaan / Eksekusi</th>
                  <th className="px-4 py-3.5">Penanggung Jawab (PIC)</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(rap?.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400">
                      Worksheet RAP belum memiliki item.
                    </td>
                  </tr>
                ) : (
                  (rap?.items || []).map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <div>{item.item_name}</div>
                        <div className="text-[10px] text-zinc-400">
                          {item.division} {item.sub_division ? `• ${item.sub_division}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {item.volume} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {formatCurrency(item.target_material_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">
                        {formatCurrency(item.target_labor_cost)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(item.target_unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-800">
                        {formatCurrency(item.total_budget)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Calendar className="h-3 w-3 text-zinc-400" />
                          <span>{item.procurement_schedule || "Minggu 1-2"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-800 font-medium">
                        <div className="flex items-center gap-1 text-[11px]">
                          <User className="h-3 w-3 text-zinc-400" />
                          <span>{item.pic_name || "Site Staff"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                          title="Ubah Target & Jadwal"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BUDGET VS ACTUAL COMPARISON ENGINE */}
      {activeTab === "COMPARISON" && comparison && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-950">Rekapitulasi Budget vs Realisasi Transaksi Nyata</h2>
            <p className="text-xs text-zinc-500">
              Analisis terpadu antara nilai kontrak klien, target RAP, dan realisasi biaya pengeluaran kas
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-100 text-xs">
              <div className="rounded-xl bg-zinc-50 p-4">
                <span className="text-zinc-500">Target RAP Internal:</span>
                <div className="mt-1 text-lg font-bold text-zinc-950">
                  {comparison.rapTotal === null ? "Belum tersedia" : formatCurrency(comparison.rapTotal)}
                </div>
                <span className="text-[11px] text-zinc-400">RAP disetujui / aktif</span>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <span className="text-zinc-500">Total Biaya Aktual Riil:</span>
                <div className="mt-1 text-lg font-bold text-blue-900">{formatCurrency(comparison.totalActualCost)}</div>
                <span className="text-[11px] text-zinc-400">Material + Upah + Lapangan</span>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <span className="text-zinc-500">Sisa Cadangan Anggaran:</span>
                <div className={`mt-1 text-lg font-bold ${
                  comparison.costVarianceVsRap === null
                    ? "text-zinc-500"
                    : comparison.costVarianceVsRap >= 0 ? "text-emerald-700" : "text-red-700"
                }`}>
                  {comparison.costVarianceVsRap === null
                    ? "Belum tersedia"
                    : formatCurrency(comparison.costVarianceVsRap)}
                </div>
                <span className="text-[11px] text-zinc-400">
                  {comparison.costVarianceVsRap === null
                    ? "Belum ada RAP disetujui / aktif"
                    : comparison.costVarianceVsRap >= 0 ? "Surplus (Di bawah budget)" : "Over budget"}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Divisi & Item Pekerjaan</th>
                    <th className="px-4 py-3.5 text-right">Volume</th>
                    <th className="px-4 py-3.5 text-right">Target Budget RAP</th>
                    <th className="px-4 py-3.5 text-right">Realisasi Aktual</th>
                    <th className="px-4 py-3.5 text-right">Deviasi / Sisa</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {comparison.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <div>{it.item_name}</div>
                        <div className="text-[10px] text-zinc-400">{it.division}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {it.volume} {it.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(it.rap_budget)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-900">
                        {it.actual_cost === null ? "Belum dialokasikan" : formatCurrency(it.actual_cost)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={it.variance === null
                          ? "text-zinc-500"
                          : it.variance >= 0 ? "text-emerald-700" : "text-red-700"}>
                          {it.variance === null
                            ? "-"
                            : it.variance >= 0 ? `+${formatCurrency(it.variance)}` : formatCurrency(it.variance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {it.status === "UNALLOCATED" ? (
                          <span className="text-zinc-500">Belum dialokasikan</span>
                        ) : (
                          <Badge variant={it.status === "ON_BUDGET" ? "success" : it.status === "NEAR_LIMIT" ? "warning" : "error"}>
                            {it.status === "ON_BUDGET" ? "Terkendali" : it.status === "NEAR_LIMIT" ? "Mendekati Batas" : "Over Budget"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ITEM TARGET RAP */}
      {showEditItemModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Target Biaya & Pelaksanaan</h3>
                <p className="text-xs text-zinc-500">{editingItem.item_name}</p>
              </div>
              <button onClick={() => setShowEditItemModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Target Material (Rp)</label>
                  <input
                    type="number"
                    value={editForm.target_material_cost}
                    onChange={(e) => setEditForm({ ...editForm, target_material_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Target Upah (Rp)</label>
                  <input
                    type="number"
                    value={editForm.target_labor_cost}
                    onChange={(e) => setEditForm({ ...editForm, target_labor_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Jadwal Pengadaan Material</label>
                <input
                  type="text"
                  placeholder="Contoh: Minggu ke-1 (Maret 2026)"
                  value={editForm.procurement_schedule}
                  onChange={(e) => setEditForm({ ...editForm, procurement_schedule: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Penanggung Jawab (PIC)</label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso (Site Manager)"
                  value={editForm.pic_name}
                  onChange={(e) => setEditForm({ ...editForm, pic_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 text-xs flex justify-between items-center font-bold text-zinc-950">
                <span>Total Target Item:</span>
                <span>
                  {formatCurrency(
                    (editForm.target_material_cost + editForm.target_labor_cost + editForm.target_equipment_cost) *
                      editingItem.volume
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowEditItemModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Simpan Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
