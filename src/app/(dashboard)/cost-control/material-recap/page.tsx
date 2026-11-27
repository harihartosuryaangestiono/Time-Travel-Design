"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Plus,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Filter,
  FileText,
  Sliders,
  X,
  Package,
  Trash2,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  getProjectMaterialRecap,
  getMasterMaterials,
  recordMaterialMovement,
  setProjectMaterialPlan,
  ProjectMaterialRecapRow,
  MasterMaterialItem,
} from "@/app/actions/cost-control/materialActions";
import { getProjects } from "@/app/actions/projectActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { getUsageUnitPrice } from "@/lib/cost-control/materialUnits";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function MaterialRecapPage() {
  const [recap, setRecap] = useState<ProjectMaterialRecapRow[]>([]);
  const [materials, setMaterials] = useState<MasterMaterialItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"movement" | "plan" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ProjectMaterialRecapRow | null>(null);

  const [movementForm, setMovementForm] = useState({
    material_id: "",
    movement_type: "RECEIPT" as "RECEIPT" | "ISSUED_TO_FIELD" | "USED" | "RETURN" | "DAMAGED_WASTE" | "ADJUSTMENT",
    quantity: 10,
    unit: "sak",
    unit_price: 0,
    reference_document: "",
    notes: "",
  });

  const [planForm, setPlanForm] = useState({
    material_id: "",
    planned_quantity: 100,
    budget_unit_price: 65000,
    waste_tolerance_percent: 5,
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [projList, matList] = await Promise.all([
        getProjects(),
        getMasterMaterials(),
      ]);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      setMaterials(matList);

      const activeProjId = selectedProjectId || projList?.[0]?.id || "";
      if (activeProjId) {
        if (!selectedProjectId) setSelectedProjectId(activeProjId);
        const data = await getProjectMaterialRecap(activeProjId);
        setRecap(data);
      }
    } catch (err: any) {
      console.error("Gagal memuat rekap material:", err);
      setError(err?.message || "Gagal memuat rekapitulasi material.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    recap.forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [recap]);

  const filteredRecap = useMemo(() => {
    return recap.filter((item) => {
      const matchCat = categoryFilter === "ALL" || item.category === categoryFilter;
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [recap, categoryFilter, searchQuery]);

  // Aggregate stats
  const totalPlannedBudget = useMemo(() => recap.reduce((sum, r) => sum + r.total_budget, 0), [recap]);
  const totalItemsCount = recap.length;
  const itemsWithStock = useMemo(() => recap.filter((r) => r.current_stock > 0).length, [recap]);
  const anomalousItemsCount = useMemo(() => recap.filter((r) => r.status !== "NORMAL").length, [recap]);

  const handleOpenMovementModal = (row?: ProjectMaterialRecapRow, type?: typeof movementForm.movement_type) => {
    if (row) {
      setSelectedRow(row);
      setMovementForm({
        material_id: row.material_id,
        movement_type: type || "RECEIPT",
        quantity: 1,
        unit: row.unit,
        unit_price: row.budget_unit_price,
        reference_document: "",
        notes: "",
      });
    } else {
      setSelectedRow(null);
      setMovementForm({
        material_id: materials[0]?.id || "",
        movement_type: type || "RECEIPT",
        quantity: 1,
        unit: materials[0]?.usage_unit || "unit",
        unit_price: materials[0]
          ? getUsageUnitPrice(materials[0].standard_price, materials[0].conversion_factor)
          : 0,
        reference_document: "",
        notes: "",
      });
    }
    setShowMovementModal(true);
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    try {
      setPendingAction("movement");
      if (!selectedProjectId) throw new Error("Pilih proyek terlebih dahulu.");
      await recordMaterialMovement({
        project_id: selectedProjectId,
        material_id: movementForm.material_id,
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        unit: movementForm.unit,
        unit_price: Number(movementForm.unit_price),
        reference_document: movementForm.reference_document,
        notes: movementForm.notes,
      });

      setSuccessMsg(`Mutasi ${movementForm.movement_type} berhasil dicatat.`);
      setShowMovementModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal mencatat mutasi stok.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenPlanModal = (row: ProjectMaterialRecapRow) => {
    setSelectedRow(row);
    setPlanForm({
      material_id: row.material_id,
      planned_quantity: row.planned_quantity || 10,
      budget_unit_price: row.budget_unit_price || 0,
      waste_tolerance_percent: row.waste_tolerance_percent || 5,
      notes: "",
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    try {
      setPendingAction("plan");
      if (!selectedProjectId) throw new Error("Pilih proyek terlebih dahulu.");
      await setProjectMaterialPlan({
        project_id: selectedProjectId,
        material_id: planForm.material_id,
        planned_quantity: Number(planForm.planned_quantity),
        budget_unit_price: Number(planForm.budget_unit_price),
        waste_tolerance_percent: Number(planForm.waste_tolerance_percent),
        notes: planForm.notes,
      });

      setSuccessMsg("Kebutuhan rencana material berhasil diperbarui.");
      setShowPlanModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan rencana material.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <Boxes className="h-3.5 w-3.5" />
            Manajemen Material & Persediaan Proyek
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Rekapitulasi Material Proyek
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Pusat kontrol kebutuhan RAB, penerimaan gudang, pengeluaran ke lapangan, pemakaian fisik, dan analisis waste.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs shadow-sm">
            <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Pilih Proyek:</span>
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
            onClick={() => handleOpenMovementModal(undefined, "RECEIPT")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Catat Mutasi Material
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
          title="Total Estimasi Budget Material"
          value={formatCurrency(totalPlannedBudget)}
          subtitle="Berdasarkan alokasi kebutuhan proyek"
          icon={Boxes}
        />
        <StatCard
          title="Item Material Aktif"
          value={`${totalItemsCount} Material`}
          subtitle={`${itemsWithStock} item memiliki stok fisik`}
          icon={Package}
        />
        <StatCard
          title="Item Sisa Stok di Lapangan"
          value={`${itemsWithStock} Item`}
          subtitle="Tersedia di gudang lokasi proyek"
          icon={ArrowDownToLine}
        />
        <StatCard
          title="Indikator Anomali & Waste"
          value={`${anomalousItemsCount} Item`}
          subtitle={anomalousItemsCount > 0 ? "Perlu pengecekan lapangan" : "Semua material dalam toleransi"}
          icon={AlertTriangle}
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter("ALL")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              categoryFilter === "ALL"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari kode atau nama material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* Main Material Recap Table */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Material & Kode</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th className="px-4 py-3.5 text-right">Rencana (RAB)</th>
                <th className="px-4 py-3.5 text-right">Dibeli</th>
                <th className="px-4 py-3.5 text-right">Diterima</th>
                <th className="px-4 py-3.5 text-right">Dikeluarkan</th>
                <th className="px-4 py-3.5 text-right">Digunakan</th>
                <th className="px-4 py-3.5 text-right">Rusak/Waste</th>
                <th className="px-4 py-3.5 text-right font-bold text-zinc-900">Sisa Stok</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRecap.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-400">
                    Tidak ada data rekapitulasi material untuk proyek ini.
                  </td>
                </tr>
              ) : (
                filteredRecap.map((row) => (
                  <tr key={row.material_id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-4 py-3 font-semibold text-zinc-900">
                      <div>{row.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{row.code}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{row.category}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {row.planned_quantity > 0 ? (
                        `${row.planned_quantity} ${row.unit}`
                      ) : (
                        <button
                          onClick={() => handleOpenPlanModal(row)}
                          className="text-blue-600 hover:underline text-[11px]"
                        >
                          + Set Target
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-800">
                      {row.purchased_quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {row.received_quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">
                      {row.issued_quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 font-semibold">
                      {row.used_quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.damaged_quantity > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {row.damaged_quantity} {row.unit} ({row.actual_waste_percent}%)
                        </span>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-950 bg-zinc-50/50">
                      {row.current_stock} {row.unit}
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
                          ? "Perlu Cek"
                          : "Waste Tinggi"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenMovementModal(row, "ISSUED_TO_FIELD")}
                          title="Keluarkan ke Lapangan"
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Keluarkan
                        </button>
                        <button
                          onClick={() => handleOpenPlanModal(row)}
                          title="Ubah Target Kebutuhan"
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Target
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CATAT MUTASI MATERIAL */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Catat Mutasi Stok Material</h3>
              <button onClick={() => setShowMovementModal(false)} disabled={pendingAction === "movement"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordMovement} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Jenis Mutasi</label>
                <select
                  value={movementForm.movement_type}
                  onChange={(e: any) => setMovementForm({ ...movementForm, movement_type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 font-semibold"
                >
                  <option value="RECEIPT">Penerimaan di Lokasi / Gudang Proyek</option>
                  <option value="ISSUED_TO_FIELD">Pengeluaran ke Lapangan / Tukang</option>
                  <option value="USED">Pencatatan Pemakaian Terpasang</option>
                  <option value="RETURN">Pengembalian ke Gudang / Supplier (Retur)</option>
                  <option value="DAMAGED_WASTE">Material Rusak / Terbuang (Waste)</option>
                  <option value="ADJUSTMENT">Penyesuaian Stok Fisik (Stock Opname)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Material</label>
                <select
                  value={movementForm.material_id}
                  onChange={(e) => {
                    const m = materials.find((mat) => mat.id === e.target.value);
                    setMovementForm({
                      ...movementForm,
                      material_id: e.target.value,
                      unit: m?.usage_unit || "unit",
                      unit_price: m
                        ? getUsageUnitPrice(m.standard_price, m.conversion_factor)
                        : 0,
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} • {m.name} ({m.usage_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kuantitas</label>
                  <input
                    type="number"
                    step="any"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan</label>
                  <input
                    type="text"
                    value={movementForm.unit}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">No. Dokumen / Surat Jalan</label>
                <input
                  type="text"
                  placeholder="Contoh: SJ-2026/04/102"
                  value={movementForm.reference_document}
                  onChange={(e) => setMovementForm({ ...movementForm, reference_document: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan / Alasan</label>
                <input
                  type="text"
                  placeholder="Keterangan kondisi atau peruntukan"
                  value={movementForm.notes}
                  onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  disabled={pendingAction === "movement"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "movement"}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "movement" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "movement" ? "Menyimpan Mutasi..." : "Simpan Mutasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UBAH TARGET RENCANA KEBUTUHAN (RAB/RAP) */}
      {showPlanModal && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Target Kebutuhan Material</h3>
                <p className="text-xs text-zinc-500">{selectedRow.name}</p>
              </div>
              <button onClick={() => setShowPlanModal(false)} disabled={pendingAction === "plan"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">
                    Volume Rencana ({selectedRow.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={planForm.planned_quantity}
                    onChange={(e) => setPlanForm({ ...planForm, planned_quantity: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Estimasi Harga Satuan</label>
                  <input
                    type="number"
                    value={planForm.budget_unit_price}
                    onChange={(e) => setPlanForm({ ...planForm, budget_unit_price: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Batas Toleransi Waste (%)</label>
                <input
                  type="number"
                  step="any"
                  value={planForm.waste_tolerance_percent}
                  onChange={(e) => setPlanForm({ ...planForm, waste_tolerance_percent: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Sistem menandai anomali bila rasio material rusak melebihi angka ini.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 text-xs flex justify-between items-center">
                <span className="text-zinc-600">Total Anggaran Item:</span>
                <span className="font-bold text-zinc-950">
                  {formatCurrency(planForm.planned_quantity * planForm.budget_unit_price)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  disabled={pendingAction === "plan"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "plan"}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "plan" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "plan" ? "Menyimpan Target..." : "Simpan Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
