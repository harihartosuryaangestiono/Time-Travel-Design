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
  Boxes,
  HardHat,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
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
  const [activeTab, setActiveTab] = useState<"ITEMS" | "MATERIAL_TAKEOFF" | "LABOR_TAKEOFF" | "COMPARISON">("ITEMS");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded items in WBS table
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

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

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  const totalCalculatedMaterials = useMemo(() => {
    return (rap?.material_takeoff || []).reduce((sum, m) => sum + m.total_cost, 0);
  }, [rap?.material_takeoff]);

  const totalCalculatedLabor = useMemo(() => {
    return (rap?.labor_takeoff || []).reduce((sum, l) => sum + l.total_cost, 0);
  }, [rap?.labor_takeoff]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/cost-control/rap" className="hover:text-zinc-900 transition flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Daftar RAP
            </Link>
            <span>/</span>
            <span className="font-mono text-zinc-900 font-semibold">{rap?.rap_number || "..."}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              {rap?.title || "Worksheet RAP Proyek"}
            </h1>
            <Badge
              variant={
                rap?.status === "APPROVED"
                  ? "emerald"
                  : rap?.status === "ACTIVE"
                  ? "info"
                  : "zinc"
              }
            >
              {rap?.status || "DRAFT"}
            </Badge>
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            Proyek: <span className="font-semibold text-zinc-800">{rap?.project?.name}</span> ({rap?.project?.code})
            {rap?.rab && (
              <>
                {" "}• Diterbitkan dari RAB:{" "}
                <span className="font-semibold text-zinc-800">{rap.rab.rab_number}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Dustin Concept Highlight Banner */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/60 p-4 shadow-sm text-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-700 p-2 text-white shadow">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-zinc-900">RAP Proyek (Rencana Anggaran Pelaksanaan)</span>
              <p className="mt-0.5 text-zinc-600">
                Modal rincian per proyek dari banyaknya item pekerjaan + <b>Waste Material 5%</b>.
                Gunakan tab <b>Rekap Kebutuhan Material (MTO)</b> untuk kontrol logistik pengadaan: berapa m³ hebel, berapa sak semen, dan berapa kg paku yang harus dibeli untuk proyek ini.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/cost-control/ahsp"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <Layers className="h-3 w-3 text-blue-600" />
              Lihat Master AHSP
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          title="Total Anggaran RAP"
          value={formatCurrency(rap?.total_planned_budget || 0)}
          subtitle="Plafon maksimal belanja proyek"
          icon={DollarSign}
        />
        <StatCard
          title="Estimasi Belanja Material (+5% Waste)"
          value={formatCurrency(totalCalculatedMaterials || rap?.total_material_budget || 0)}
          subtitle={`${rap?.material_takeoff?.length || 0} jenis material toko`}
          icon={Boxes}
        />
        <StatCard
          title="Estimasi Upah Tukang"
          value={formatCurrency(totalCalculatedLabor || rap?.total_labor_budget || 0)}
          subtitle={`${rap?.labor_takeoff?.length || 0} keahlian mandor/tukang`}
          icon={HardHat}
        />
        <StatCard
          title="Target Efisiensi Budget"
          value={formatCurrency(rap?.target_savings || 0)}
          subtitle="Potensi margin penghematan internal"
          icon={TrendingDown}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
        <button
          onClick={() => setActiveTab("ITEMS")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "ITEMS"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Rincian Pekerjaan & Biaya ({rap?.items?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("MATERIAL_TAKEOFF")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "MATERIAL_TAKEOFF"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <Boxes className="h-3.5 w-3.5" />
          Rekap Kebutuhan Material (+5% Waste) ({rap?.material_takeoff?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("LABOR_TAKEOFF")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "LABOR_TAKEOFF"
              ? "bg-zinc-950 text-white shadow-sm"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          <HardHat className="h-3.5 w-3.5" />
          Rekapitulasi Upah Tukang ({rap?.labor_takeoff?.length || 0})
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
          Budget vs Realisasi Lapangan
        </button>
      </div>

      {/* TAB 1: RAP WORKSHEET ITEMS TABLE (With expandable components) */}
      {activeTab === "ITEMS" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Divisi & Uraian Pekerjaan</th>
                    <th className="px-4 py-3.5 text-right">Volume Proyek</th>
                    <th className="px-4 py-3.5 text-right">Target Material</th>
                    <th className="px-4 py-3.5 text-right">Target Upah</th>
                    <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Target Satuan</th>
                    <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Total Budget</th>
                    <th className="px-4 py-3.5">Jadwal Pengadaan</th>
                    <th className="px-4 py-3.5">PIC</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(rap?.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-400">
                        Worksheet RAP belum memiliki item pekerjaan.
                      </td>
                    </tr>
                  ) : (
                    (rap?.items || []).map((item) => {
                      const isExpanded = !!expandedItems[item.id];
                      const comps = item.components || [];

                      return (
                        <>
                          <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                            <td className="px-4 py-3 font-semibold text-zinc-950">
                              <div className="flex items-center gap-2">
                                {comps.length > 0 && (
                                  <button
                                    onClick={() => toggleExpand(item.id)}
                                    className="text-zinc-400 hover:text-zinc-700"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                                <div>
                                  <div>{item.item_name}</div>
                                  <div className="text-[10px] text-zinc-400 font-normal">
                                    {item.division} {item.sub_division ? `• ${item.sub_division}` : ""}
                                    {comps.length > 0 && ` (${comps.length} komponen)`}
                                  </div>
                                </div>
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

                          {/* Expandable row showing material & labor breakdowns with waste */}
                          {isExpanded && comps.length > 0 && (
                            <tr key={`${item.id}-comps`} className="bg-zinc-50/70">
                              <td colSpan={9} className="px-8 py-3">
                                <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                                  <div className="text-[11px] font-bold text-zinc-800">
                                    Rincian Kebutuhan Lapangan untuk {item.volume} {item.unit} {item.item_name}:
                                  </div>
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-zinc-50 text-[10px] font-semibold text-zinc-500 uppercase border-b border-zinc-100">
                                      <tr>
                                        <th className="py-1.5 px-2">Kebutuhan Bahan / Upah</th>
                                        <th className="py-1.5 px-2">Tipe</th>
                                        <th className="py-1.5 px-2 text-right">Koefisien AHSP</th>
                                        <th className="py-1.5 px-2 text-right">Kebutuhan Dasar</th>
                                        <th className="py-1.5 px-2 text-right">Waste (5%)</th>
                                        <th className="py-1.5 px-2 text-right font-bold text-zinc-900">Total Kebutuhan Proyek</th>
                                        <th className="py-1.5 px-2 text-right">Harga Toko / Satuan</th>
                                        <th className="py-1.5 px-2 text-right font-bold">Total Biaya</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                      {comps.map((c, ci) => (
                                        <tr key={ci} className="hover:bg-zinc-50">
                                          <td className="py-1.5 px-2 font-medium text-zinc-900">{c.name}</td>
                                          <td className="py-1.5 px-2">
                                            <span
                                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                                c.component_type === "MATERIAL"
                                                  ? "bg-blue-50 text-blue-800"
                                                  : "bg-amber-50 text-amber-800"
                                              }`}
                                            >
                                              {c.component_type}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono">{c.coefficient}</td>
                                          <td className="py-1.5 px-2 text-right">
                                            {c.base_quantity.toFixed(2)} {c.unit}
                                          </td>
                                          <td className="py-1.5 px-2 text-right text-amber-700">
                                            {c.waste_percent > 0 ? `+${(c.base_quantity * 0.05).toFixed(2)} ${c.unit}` : "-"}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-bold text-zinc-950">
                                            {c.planned_quantity.toFixed(2)} {c.unit}
                                          </td>
                                          <td className="py-1.5 px-2 text-right text-zinc-600">
                                            {formatCurrency(c.unit_price)}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-bold text-emerald-800">
                                            {formatCurrency(c.planned_total_cost)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REKAP KEBUTUHAN MATERIAL PROYEK (+5% WASTE) — DUSTIN / PDF 1 */}
      {activeTab === "MATERIAL_TAKEOFF" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">
                  Rekapitulasi Kebutuhan Belanja Material Proyek (Material Take-Off)
                </h3>
                <p className="text-xs text-zinc-500">
                  Agregasi kebutuhan belanja seluruh material di proyek ini, dihitung dari volume pekerjaan x koefisien AHSP + toleransi waste 5%.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-zinc-400">Total Anggaran Belanja Bahan:</span>
                <div className="text-base font-bold text-emerald-700">
                  {formatCurrency(totalCalculatedMaterials)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-600 uppercase border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-3">No</th>
                    <th className="py-3 px-3">Nama Material Bangunan</th>
                    <th className="py-3 px-3">Satuan Beli</th>
                    <th className="py-3 px-3 text-right">Kebutuhan Dasar</th>
                    <th className="py-3 px-3 text-right text-amber-700">Waste (5%)</th>
                    <th className="py-3 px-3 text-right font-bold text-zinc-950 bg-emerald-50/50">
                      Total Belanja Lapangan
                    </th>
                    <th className="py-3 px-3 text-right">Harga Toko / Satuan</th>
                    <th className="py-3 px-3 text-right font-bold text-zinc-900">Total Anggaran</th>
                    <th className="py-3 px-3">Digunakan Pada Pekerjaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(rap?.material_takeoff || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-zinc-400">
                        Belum ada rincian material terhubung. Pastikan item pekerjaan dimasukkan dari Master AHSP.
                      </td>
                    </tr>
                  ) : (
                    rap!.material_takeoff!.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60">
                        <td className="py-2.5 px-3 text-zinc-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-950">{mat.name}</td>
                        <td className="py-2.5 px-3 text-zinc-600">{mat.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-700">
                          {mat.total_base_qty.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                          +{(mat.total_base_qty * 0.05).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-900 bg-emerald-50/50 font-mono">
                          {Math.ceil(mat.total_planned_qty)} {mat.unit}
                          <span className="text-[10px] text-zinc-400 font-normal block">
                            (persis: {mat.total_planned_qty.toFixed(2)})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-600 font-mono">
                          {formatCurrency(mat.unit_price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-zinc-950 font-mono">
                          {formatCurrency(mat.total_cost)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-zinc-500 max-w-xs truncate" title={mat.used_in_items.join(", ")}>
                          {mat.used_in_items.join(", ")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-zinc-50 border-t border-zinc-200 font-bold text-zinc-900">
                  <tr>
                    <td colSpan={7} className="py-3 px-3 text-right">
                      TOTAL ANGGARAN BELANJA MATERIAL PROYEK
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800">
                      {formatCurrency(totalCalculatedMaterials)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REKAPITULASI UPAH TUKANG PROYEK */}
      {activeTab === "LABOR_TAKEOFF" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">
                  Rekapitulasi Kebutuhan Upah Tukang & Mandor Proyek
                </h3>
                <p className="text-xs text-zinc-500">
                  Total anggaran upah borongan dan keteng untuk seluruh item pekerjaan di proyek ini.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-zinc-400">Total Anggaran Upah:</span>
                <div className="text-base font-bold text-amber-700">
                  {formatCurrency(totalCalculatedLabor)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-600 uppercase border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-3">No</th>
                    <th className="py-3 px-3">Jenis Pekerjaan Upah Tukang</th>
                    <th className="py-3 px-3">Satuan</th>
                    <th className="py-3 px-3 text-right font-bold text-zinc-950">Total Volume Proyek</th>
                    <th className="py-3 px-3 text-right">Tarif Satuan Upah</th>
                    <th className="py-3 px-3 text-right font-bold text-zinc-900">Total Anggaran Upah</th>
                    <th className="py-3 px-3">Item Pekerjaan Terkait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(rap?.labor_takeoff || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-zinc-400">
                        Belum ada rincian upah terhubung.
                      </td>
                    </tr>
                  ) : (
                    rap!.labor_takeoff!.map((lab, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60">
                        <td className="py-2.5 px-3 text-zinc-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-950">{lab.name}</td>
                        <td className="py-2.5 px-3 text-zinc-600">{lab.unit}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-zinc-950 font-mono">
                          {lab.total_volume.toFixed(2)} {lab.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-600 font-mono">
                          {formatCurrency(lab.unit_rate)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-800 font-mono">
                          {formatCurrency(lab.total_cost)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-zinc-500 max-w-xs truncate" title={lab.used_in_items.join(", ")}>
                          {lab.used_in_items.join(", ")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-zinc-50 border-t border-zinc-200 font-bold text-zinc-900">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-right">
                      TOTAL ANGGARAN UPAH TUKANG PROYEK
                    </td>
                    <td className="py-3 px-3 text-right text-amber-800">
                      {formatCurrency(totalCalculatedLabor)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BUDGET VS ACTUAL COMPARISON ENGINE */}
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
                <div
                  className={`mt-1 text-lg font-bold ${
                    comparison.costVarianceVsRap === null
                      ? "text-zinc-500"
                      : comparison.costVarianceVsRap >= 0
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {comparison.costVarianceVsRap === null
                    ? "Belum tersedia"
                    : formatCurrency(comparison.costVarianceVsRap)}
                </div>
                <span className="text-[11px] text-zinc-400">
                  {comparison.costVarianceVsRap === null
                    ? "Belum ada RAP disetujui / aktif"
                    : comparison.costVarianceVsRap >= 0
                    ? "Surplus (Di bawah budget)"
                    : "Over budget"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditItemModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Ubah Target Biaya & Eksekusi</h3>
                <p className="text-xs text-zinc-500">{editingItem.item_name}</p>
              </div>
              <button
                onClick={() => setShowEditItemModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-zinc-700">Target Material (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.target_material_cost}
                    onChange={(e) => setEditForm({ ...editForm, target_material_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700">Target Upah (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.target_labor_cost}
                    onChange={(e) => setEditForm({ ...editForm, target_labor_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400 font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-zinc-700">Jadwal Pengadaan</label>
                  <input
                    type="text"
                    value={editForm.procurement_schedule}
                    onChange={(e) => setEditForm({ ...editForm, procurement_schedule: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700">Penanggung Jawab (PIC)</label>
                  <input
                    type="text"
                    value={editForm.pic_name}
                    onChange={(e) => setEditForm({ ...editForm, pic_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowEditItemModal(false)}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
