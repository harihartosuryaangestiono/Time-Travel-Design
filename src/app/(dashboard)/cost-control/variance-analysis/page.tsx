"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  GitCompare,
  Plus,
  RefreshCw,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  HardHat,
  Boxes,
  Ruler,
  TrendingDown,
  X,
  Loader2,
  Search,
  Sliders,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Eye,
} from "lucide-react";
import {
  getCostControlDashboard,
  getProjectTakeoffs,
  saveProjectTakeoff,
  deleteProjectTakeoff,
  CostControlDashboardData,
  ProjectTakeoffItem,
} from "@/app/actions/cost-control/varianceActions";
import { getProjects } from "@/app/actions/projectActions";
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

export default function VarianceAnalysisPage() {
  const [data, setData] = useState<CostControlDashboardData | null>(null);
  const [takeoffs, setTakeoffs] = useState<ProjectTakeoffItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"MATERIAL" | "LABOR" | "TAKEOFF">("MATERIAL");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTakeoff, setIsSavingTakeoff] = useState(false);
  const [deletingTakeoffId, setDeletingTakeoffId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Takeoff Modal
  const [showTakeoffModal, setShowTakeoffModal] = useState(false);
  const [editingTakeoff, setEditingTakeoff] = useState<ProjectTakeoffItem | null>(null);
  const [takeoffForm, setTakeoffForm] = useState({
    room_name: "",
    length_m: 6.0,
    width_m: 4.0,
    height_m: 3.5,
    door_window_area_m2: 4.2,
    lighting_points: 4,
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const projList = await getProjects();
      const formattedProj = (projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code }));
      setProjects(formattedProj);

      const activeId = selectedProjectId || formattedProj[0]?.id || "";
      if (activeId) {
        if (!selectedProjectId) setSelectedProjectId(activeId);
        const [dash, takeoffList] = await Promise.all([
          getCostControlDashboard(activeId),
          getProjectTakeoffs(activeId),
        ]);
        setData(dash);
        setTakeoffs(takeoffList);
      }
    } catch (err: any) {
      console.error("Gagal memuat analisis selisih:", err);
      setError(err?.message || "Gagal memuat analisis deviasi proyek.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate takeoffs
  const totalFloorArea = useMemo(() => takeoffs.reduce((sum, t) => sum + t.floor_area_m2, 0), [takeoffs]);
  const totalNetWallArea = useMemo(() => takeoffs.reduce((sum, t) => sum + t.net_wall_area_m2, 0), [takeoffs]);
  const totalEstimatedTiles = useMemo(() => takeoffs.reduce((sum, t) => sum + t.estimated_tile_m2, 0), [takeoffs]);
  const totalEstimatedPaint = useMemo(() => takeoffs.reduce((sum, t) => sum + t.estimated_paint_liters, 0), [takeoffs]);

  const handleOpenAddTakeoff = () => {
    setEditingTakeoff(null);
    setTakeoffForm({
      room_name: "",
      length_m: 6.0,
      width_m: 4.0,
      height_m: 3.5,
      door_window_area_m2: 4.0,
      lighting_points: 4,
      notes: "",
    });
    setShowTakeoffModal(true);
  };

  const handleSaveTakeoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingTakeoff) return;
    try {
      setIsSavingTakeoff(true);
      if (!selectedProjectId) throw new Error("Pilih proyek terlebih dahulu.");
      if (!takeoffForm.room_name.trim()) throw new Error("Nama ruang / zona wajib diisi.");

      await saveProjectTakeoff({
        id: editingTakeoff?.id,
        project_id: selectedProjectId,
        room_name: takeoffForm.room_name,
        length_m: Number(takeoffForm.length_m),
        width_m: Number(takeoffForm.width_m),
        height_m: Number(takeoffForm.height_m),
        door_window_area_m2: Number(takeoffForm.door_window_area_m2),
        lighting_points: Number(takeoffForm.lighting_points),
        notes: takeoffForm.notes,
      });

      setSuccessMsg("Parameter dimensi ruang berhasil disimpan.");
      setShowTakeoffModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan quantity takeoff.");
    } finally {
      setIsSavingTakeoff(false);
    }
  };

  const handleDeleteTakeoff = async (id: string) => {
    if (deletingTakeoffId || !confirm("Hapus dimensi ruang ini?")) return;
    try {
      setDeletingTakeoffId(id);
      await deleteProjectTakeoff(id);
      setSuccessMsg("Dimensi ruang berhasil dihapus.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus.");
    } finally {
      setDeletingTakeoffId(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
            <GitCompare className="h-3.5 w-3.5" />
            Cost Control & Variance Analytics
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Analisis Selisih Proyek
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Deteksi deviasi biaya, overclaim volume upah, anomali waste material, dan kalkulator Quantity Takeoff fisik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs shadow-sm">
            <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleOpenAddTakeoff()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Input Dimensi Ruang (QTO)
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Anggaran Proyek"
          value={formatCurrency(data?.totalBudget || 0)}
          subtitle="Target alokasi anggaran HPP"
          icon={DollarSign}
        />
        <StatCard
          title="Total Biaya Riil Aktual"
          value={formatCurrency(data?.totalActualCost || 0)}
          subtitle={`${data?.budgetConsumptionPercent || 0}% terserap`}
          icon={TrendingDown}
        />
        <StatCard
          title="Item Memerlukan Investigasi"
          value={`${data?.investigationItemsCount || 0} Item`}
          subtitle="Selisih melebihi batas kewajaran"
          icon={ShieldAlert}
        />
        <StatCard
          title="Luas Bangunan Terhitung"
          value={`${totalFloorArea.toFixed(1)} m²`}
          subtitle={`${takeoffs.length} zona ruangan terpetakan`}
          icon={Ruler}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
        <button
          onClick={() => setActiveTab("MATERIAL")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "MATERIAL"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <Boxes className="h-3.5 w-3.5" />
          Selisih Material & Waste ({data?.materialVariances.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("LABOR")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "LABOR"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <HardHat className="h-3.5 w-3.5" />
          Selisih Klaim Upah Tukang ({data?.laborVariances.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("TAKEOFF")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "TAKEOFF"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <Ruler className="h-3.5 w-3.5" />
          Quantity Takeoff Fisik ({takeoffs.length} Ruang)
        </button>
      </div>

      {/* TAB 1: MATERIAL VARIANCE TABLE */}
      {activeTab === "MATERIAL" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Analisis Deviasi & Waste Material</h2>
              <p className="text-xs text-zinc-500">Perbandingan kuantitas rencana vs pembelian riil dan toleransi susut</p>
            </div>
            <span className="text-xs text-zinc-500">
              Standar toleransi: <strong>4% - 8%</strong> tergantung jenis material
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Material</th>
                  <th className="px-4 py-3.5 text-right">RAB Target</th>
                  <th className="px-4 py-3.5 text-right">Dibeli</th>
                  <th className="px-4 py-3.5 text-right">Terpasang Riil</th>
                  <th className="px-4 py-3.5 text-right">Waste Aktual</th>
                  <th className="px-4 py-3.5 text-right">Toleransi</th>
                  <th className="px-4 py-3.5 text-right">Biaya Susut (Rp)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">Catatan Indikasi / Anomali</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(data?.materialVariances || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400">
                      Belum ada data material untuk analisis varian.
                    </td>
                  </tr>
                ) : (
                  (data?.materialVariances || []).map((row) => (
                    <tr key={row.material_id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <div>{row.name}</div>
                        <div className="text-[10px] font-mono text-zinc-400">{row.code}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800">
                        {row.planned_qty} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900">
                        {row.purchased_qty} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {row.installed_qty} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.waste_percent > 0 ? (
                          <span
                            className={
                              row.waste_percent > row.tolerance_percent
                                ? "text-red-600 font-bold"
                                : "text-zinc-600"
                            }
                          >
                            {row.waste_percent}% ({row.waste_qty} {row.unit})
                          </span>
                        ) : (
                          <span className="text-zinc-400">0%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 font-medium">
                        {row.tolerance_percent}%
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(row.waste_cost_idr)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            row.status === "NORMAL"
                              ? "success"
                              : row.status === "PERLU_VERIFIKASI"
                              ? "warning"
                              : "error"
                          }
                        >
                          {row.status === "NORMAL"
                            ? "Normal"
                            : row.status === "PERLU_VERIFIKASI"
                            ? "Verifikasi"
                            : "Investigasi"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs text-[11px] leading-relaxed text-zinc-600">
                        {row.anomaly_description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LABOR VARIANCE TABLE */}
      {activeTab === "LABOR" && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-4 bg-zinc-50 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-950">Analisis Selisih Klaim Upah Tukang</h2>
            <p className="text-xs text-zinc-500">
              Deteksi overclaim volume yang ditagihkan mandor terhadap hasil opname pengawas lapangan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Pekerjaan & Mandor</th>
                  <th className="px-4 py-3.5 text-right">Vol Klaim Tukang</th>
                  <th className="px-4 py-3.5 text-right">Vol Opname Pengawas</th>
                  <th className="px-4 py-3.5 text-right">Selisih Volume</th>
                  <th className="px-4 py-3.5 text-right">Tarif Satuan</th>
                  <th className="px-4 py-3.5 text-right font-bold text-red-700">Nilai Klaim Berlebih</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">Catatan Indikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(data?.laborVariances || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400">
                      Belum ada klaim upah tukang untuk dianalisis.
                    </td>
                  </tr>
                ) : (
                  (data?.laborVariances || []).map((row) => (
                    <tr key={row.claim_id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <div>{row.job_name}</div>
                        <div className="text-[10px] text-zinc-500">Mandor: {row.mandor_name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {row.claimed_volume} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {row.verified_volume} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.volume_diff > 0 ? (
                          <span className="font-bold text-amber-600">
                            +{row.volume_diff} {row.unit}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.unit_rate)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">
                        {row.overclaim_amount > 0 ? formatCurrency(row.overclaim_amount) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            row.status === "NORMAL"
                              ? "success"
                              : row.status === "PERLU_VERIFIKASI"
                              ? "warning"
                              : "error"
                          }
                        >
                          {row.status === "NORMAL"
                            ? "Normal"
                            : row.status === "PERLU_VERIFIKASI"
                            ? "Verifikasi"
                            : "Investigasi"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs text-[11px] leading-relaxed text-zinc-600">
                        {row.anomaly_description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUANTITY TAKEOFF (QTO) & DIMENSI BANGUNAN */}
      {activeTab === "TAKEOFF" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Kalkulator Quantity Takeoff (QTO) Berbasis Dimensi</h2>
              <p className="text-xs text-zinc-500">
                Hubungkan dimensi riil ruang (panjang, lebar, tinggi, bukaan) ke kebutuhan material otomatis
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-zinc-800">
              <span>Estimasi Keramik: <strong className="text-emerald-700">{totalEstimatedTiles.toFixed(1)} m²</strong></span>
              <span>Estimasi Cat Dinding: <strong className="text-blue-700">{totalEstimatedPaint.toFixed(1)} Liter</strong></span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Nama Ruangan / Zona</th>
                    <th className="px-4 py-3.5 text-right">Dimensi (P × L × T)</th>
                    <th className="px-4 py-3.5 text-right">Luas Lantai</th>
                    <th className="px-4 py-3.5 text-right">Luas Dinding Bersih</th>
                    <th className="px-4 py-3.5 text-right">Titik Lampu</th>
                    <th className="px-4 py-3.5 text-right font-semibold text-emerald-800">Est. Keramik (+7%)</th>
                    <th className="px-4 py-3.5 text-right font-semibold text-blue-800">Est. Cat (2 Lapis)</th>
                    <th className="px-4 py-3.5 text-right font-semibold text-zinc-800">Est. Gypsum</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {takeoffs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-400">
                        Belum ada parameter dimensi ruang yang diinput untuk proyek ini.
                      </td>
                    </tr>
                  ) : (
                    takeoffs.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-zinc-950">
                          <div>{item.room_name}</div>
                          {item.notes && <div className="text-[10px] text-zinc-400">{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-700">
                          {item.length_m}m × {item.width_m}m × {item.height_m}m
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">
                          {item.floor_area_m2} m²
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-800">
                          {item.net_wall_area_m2} m²
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">
                          {item.lighting_points} titik
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-800 bg-emerald-50/20">
                          {item.estimated_tile_m2} m²
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-800 bg-blue-50/20">
                          {item.estimated_paint_liters} L
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900 bg-zinc-50/50">
                          {item.estimated_ceiling_boards} lbr
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteTakeoff(item.id)}
                            disabled={deletingTakeoffId !== null}
                            aria-busy={deletingTakeoffId === item.id}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            {deletingTakeoffId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INPUT DIMENSI RUANG TAKEOFF */}
      {showTakeoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Input Dimensi Ruang & Parameter QTO</h3>
              <button onClick={() => setShowTakeoffModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTakeoff} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Ruangan / Zona</label>
                <input
                  type="text"
                  placeholder="Contoh: Kamar Tidur Utama (Lantai 2)"
                  value={takeoffForm.room_name}
                  onChange={(e) => setTakeoffForm({ ...takeoffForm, room_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Panjang (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={takeoffForm.length_m}
                    onChange={(e) => setTakeoffForm({ ...takeoffForm, length_m: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Lebar (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={takeoffForm.width_m}
                    onChange={(e) => setTakeoffForm({ ...takeoffForm, width_m: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tinggi (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={takeoffForm.height_m}
                    onChange={(e) => setTakeoffForm({ ...takeoffForm, height_m: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Total Luas Bukaan Pintu/Jendela (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={takeoffForm.door_window_area_m2}
                    onChange={(e) => setTakeoffForm({ ...takeoffForm, door_window_area_m2: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Jumlah Titik Lampu</label>
                  <input
                    type="number"
                    value={takeoffForm.lighting_points}
                    onChange={(e) => setTakeoffForm({ ...takeoffForm, lighting_points: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 text-xs space-y-1 text-zinc-700">
                <div className="flex justify-between">
                  <span>Luas Lantai:</span>
                  <span className="font-bold">{(takeoffForm.length_m * takeoffForm.width_m).toFixed(2)} m²</span>
                </div>
                <div className="flex justify-between">
                  <span>Luas Dinding Bersih:</span>
                  <span className="font-bold">
                    {Math.max(0, 2 * (takeoffForm.length_m + takeoffForm.width_m) * takeoffForm.height_m - takeoffForm.door_window_area_m2).toFixed(2)} m²
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowTakeoffModal(false)}
                  disabled={isSavingTakeoff}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingTakeoff}
                  aria-busy={isSavingTakeoff}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingTakeoff && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSavingTakeoff ? "Menyimpan Dimensi..." : "Simpan Dimensi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
