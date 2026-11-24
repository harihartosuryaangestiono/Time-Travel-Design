"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Layers,
  Plus,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronRight,
  HardHat,
  Boxes,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Info,
  Sparkles,
  ArrowRight,
  Calculator,
  X,
  Loader2,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import {
  getMasterAhspList,
  createMasterAhsp,
  updateMasterAhsp,
  deleteMasterAhsp,
  seedStandardAhspCatalog,
  MasterAhspItem,
  AhspComponentInput,
} from "@/app/actions/cost-control/ahspActions";
import { getMasterMaterials, MasterMaterialItem } from "@/app/actions/cost-control/materialActions";
import { getLaborRates, LaborRateItem } from "@/app/actions/cost-control/laborActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";

import { STANDARD_AHSP_CATEGORIES } from "@/lib/cost-control/ahspCategories";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

const CATEGORIES = ["ALL", ...STANDARD_AHSP_CATEGORIES];

const COMMON_UNITS = ["m2", "m3", "m'", "pcs", "set", "ls", "titik", "bln", "unit"];

export default function MasterAhspPage() {
  const [ahspList, setAhspList] = useState<MasterAhspItem[]>([]);
  const [materials, setMaterials] = useState<MasterMaterialItem[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded items
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [editingAhsp, setEditingAhsp] = useState<MasterAhspItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MasterAhspItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "Pekerjaan Arsitektural",
    unit: "m2",
    overhead_percent: 10,
    notes: "",
    components: [
      {
        component_type: "LABOR" as "LABOR" | "MATERIAL" | "EQUIPMENT",
        name: "",
        coefficient: 1.0,
        unit: "m2",
        unit_price: 55000,
        material_id: null,
        labor_rate_id: null,
      },
    ] as AhspComponentInput[],
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [list, matList, labList] = await Promise.all([
        getMasterAhspList(),
        getMasterMaterials().catch(() => []),
        getLaborRates().catch(() => []),
      ]);
      setAhspList(list);
      setMaterials(matList);
      setLaborRates(labList);
    } catch (err: any) {
      console.error("Gagal memuat katalog Master AHSP:", err);
      setError(err?.message || "Gagal memuat Master AHSP.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    ahspList.forEach((a) => {
      all[a.id] = true;
    });
    setExpandedItems(all);
  };

  const collapseAll = () => {
    setExpandedItems({});
  };

  const executeSeedStandard = async () => {
    try {
      setIsSeeding(true);
      setError(null);
      const res = await seedStandardAhspCatalog();
      setSuccessMsg(`Berhasil memuat ${res.count} item standar AHSP 2026.`);
      setShowSeedModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal memuat template standar AHSP.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingAhsp(null);
    setForm({
      code: "",
      name: "",
      category: categoryFilter !== "ALL" ? categoryFilter : "Pekerjaan Arsitektural",
      unit: "m2",
      overhead_percent: 10,
      notes: "",
      components: [
        {
          component_type: "LABOR",
          name: "Upah Tukang",
          coefficient: 1.0,
          unit: "m2",
          unit_price: 55000,
          material_id: null,
          labor_rate_id: null,
        },
      ],
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: MasterAhspItem) => {
    setEditingAhsp(item);
    setForm({
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      overhead_percent: item.overhead_percent,
      notes: item.notes || "",
      components: item.components.map((c) => ({
        id: c.id,
        component_type: c.component_type,
        name: c.name,
        coefficient: c.coefficient,
        unit: c.unit,
        unit_price: c.unit_price,
        material_id: c.material_id || null,
        labor_rate_id: c.labor_rate_id || null,
      })),
    });
    setShowAddModal(true);
  };

  const handleAddComponentRow = (type: "LABOR" | "MATERIAL" | "EQUIPMENT") => {
    setForm((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          component_type: type,
          name: type === "LABOR" ? "Upah Tukang" : type === "MATERIAL" ? "Material Bahan" : "Sewa Alat",
          coefficient: type === "LABOR" ? 1.0 : 0.1,
          unit: type === "LABOR" ? prev.unit : "sak",
          unit_price: 0,
          material_id: null,
          labor_rate_id: null,
        },
      ],
    }));
  };

  const handleRemoveComponentRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const handleComponentChange = (index: number, field: string, val: any) => {
    setForm((prev) => {
      const next = [...prev.components];
      next[index] = { ...next[index], [field]: val };

      // If choosing material from master materials
      if (field === "material_id" && val) {
        const selectedMat = materials.find((m) => m.id === val);
        if (selectedMat) {
          next[index].name = selectedMat.name;
          next[index].unit = selectedMat.purchase_unit;
          next[index].unit_price = selectedMat.standard_price;
        }
      }

      // If choosing labor from labor rates
      if (field === "labor_rate_id" && val) {
        const selectedLab = laborRates.find((l) => l.id === val);
        if (selectedLab) {
          next[index].name = selectedLab.job_name;
          next[index].unit = selectedLab.unit;
          next[index].unit_price = selectedLab.standard_rate;
        }
      }

      return { ...prev, components: next };
    });
  };

  // Live modal totals calculation
  const modalCalculations = useMemo(() => {
    let mat = 0;
    let lab = 0;
    let eq = 0;
    form.components.forEach((c) => {
      const sub = Number(c.coefficient || 0) * Number(c.unit_price || 0);
      if (c.component_type === "MATERIAL") mat += sub;
      else if (c.component_type === "LABOR") lab += sub;
      else eq += sub;
    });
    const modalTotal = mat + lab + eq;
    const marginRate = Number(form.overhead_percent || 0) / 100;
    const rabPrice = Math.round(modalTotal * (1 + marginRate));
    return { mat, lab, eq, modalTotal, rabPrice };
  }, [form.components, form.overhead_percent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (!form.name.trim()) throw new Error("Nama pekerjaan AHSP wajib diisi.");
      if (form.components.length === 0) throw new Error("Minimal tambahkan 1 komponen (Upah atau Material).");

      if (editingAhsp) {
        await updateMasterAhsp(editingAhsp.id, {
          code: form.code,
          name: form.name,
          category: form.category,
          unit: form.unit,
          overhead_percent: form.overhead_percent,
          notes: form.notes,
          components: form.components,
        });
        setSuccessMsg(`Master AHSP "${form.name}" berhasil diperbarui.`);
      } else {
        await createMasterAhsp({
          code: form.code,
          name: form.name,
          category: form.category,
          unit: form.unit,
          overhead_percent: form.overhead_percent,
          notes: form.notes,
          components: form.components,
        });
        setSuccessMsg(`Master AHSP "${form.name}" berhasil dibuat.`);
      }

      setShowAddModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan Master AHSP.");
    }
  };

  const executeDelete = async () => {
    if (!deletingItem) return;
    try {
      setIsDeleting(true);
      setError(null);
      await deleteMasterAhsp(deletingItem.id);
      setSuccessMsg(`Master AHSP "${deletingItem.name}" berhasil dihapus.`);
      setDeletingItem(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus AHSP.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAhsp = useMemo(() => {
    return ahspList.filter((a) => {
      const matchCat = categoryFilter === "ALL" || a.category === categoryFilter;
      const matchSearch =
        !searchQuery.trim() ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.components.some((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [ahspList, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalItems = ahspList.length;
    const catSet = new Set(ahspList.map((a) => a.category));
    const avgModal = totalItems > 0 ? ahspList.reduce((sum, a) => sum + a.total_modal_hpp, 0) / totalItems : 0;
    return {
      totalItems,
      totalCategories: catSet.size,
      avgModal,
    };
  }, [ahspList]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <Layers className="h-3.5 w-3.5" />
            Unit Price Analysis & Recipe Library
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Master AHSP (Analisis Harga Satuan Pekerjaan)
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Katalog baku harga modal per satuan volume (Upah Tukang + Material). Resep dasar untuk estimasi RAP & RAB proyek.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowSeedModal(true)}
            disabled={isSeeding}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
            title="Muat 25+ resep standar 2026 (Time Travel Design / PDF 3)"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            {isSeeding ? "Memuat Template..." : "Template Standar 2026"}
          </button>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Tambah AHSP Baru
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
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

      {/* Quick Explainer Banner (Dustin Rule) */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-600 p-2 text-white shadow">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-zinc-900">Alur Standar: Database ➔ AHSP ➔ RAP ➔ RAB</span>
              <p className="mt-0.5 text-zinc-600">
                <b>AHSP</b> = Modal satuan murni (1 m2 dinding = 0.1 m3 hebel + 0.1 sak mortar + upah).
                <b> RAP</b> = Kebutuhan proyek (volume x koefisien x 105% waste).
                <b> RAB</b> = Penawaran klien (RAP + Margin 20%).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cost-control/labor-rates"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <HardHat className="h-3 w-3 text-amber-600" />
              Database Upah
            </Link>
            <Link
              href="/cost-control/material-prices"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Boxes className="h-3 w-3 text-blue-600" />
              Database Material
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Resep AHSP"
          value={stats.totalItems.toString()}
          subtitle={`${stats.totalCategories} kategori pekerjaan aktif`}
          icon={Layers}
        />
        <StatCard
          title="Rata-rata Modal HPP"
          value={formatCurrency(stats.avgModal)}
          subtitle="Biaya modal dasar per satuan pekerjaan"
          icon={DollarSign}
        />
        <StatCard
          title="Sinkronisasi Proyek"
          value="Siap Dipakai"
          subtitle="Bisa langsung dipanggil saat buat RAB & RAP"
          icon={CheckCircle2}
        />
      </div>

      {/* Controls: Search & Category Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari pekerjaan (contoh: Dinding Bata Ringan, Plafon, Keramik, Cat)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-3 text-xs outline-none focus:border-zinc-400 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-400"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "ALL" ? "Semua Kategori Pekerjaan" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end text-xs text-zinc-500">
          <button onClick={expandAll} className="hover:text-zinc-900 underline">
            Buka Semua Rincian
          </button>
          <span>•</span>
          <button onClick={collapseAll} className="hover:text-zinc-900 underline">
            Tutup Semua
          </button>
        </div>
      </div>

      {/* AHSP Catalog List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
          <div className="flex flex-col items-center gap-2 text-xs text-zinc-500">
            <RefreshCw className="h-5 w-5 animate-spin text-zinc-400" />
            <span>Memuat Master AHSP...</span>
          </div>
        </div>
      ) : filteredAhsp.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
          <Layers className="h-10 w-10 text-zinc-300" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900">Belum Ada Item AHSP</h3>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">
            {searchQuery || categoryFilter !== "ALL"
              ? "Tidak ada item AHSP yang cocok dengan filter pencarian."
              : "Katalog AHSP masih kosong. Anda dapat menambahkan item baru atau memuat template standar 2026."}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowSeedModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Muat Template Standar 2026
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Buat AHSP Manual
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAhsp.map((item, idx) => {
            const isExpanded = !!expandedItems[item.id];
            const laborComps = item.components.filter((c) => c.component_type === "LABOR");
            const materialComps = item.components.filter((c) => c.component_type === "MATERIAL");
            const equipComps = item.components.filter((c) => c.component_type === "EQUIPMENT");

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:border-zinc-300"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="flex cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50/60"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="mt-0.5 text-zinc-400 hover:text-zinc-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(item.id);
                      }}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-500">{item.code}</span>
                        <Badge variant="zinc" className="text-[10px]">
                          {item.category}
                        </Badge>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                          Satuan: /{item.unit}
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-bold text-zinc-950">{item.name}</h3>
                      {item.notes && <p className="text-[11px] text-zinc-500 mt-0.5">{item.notes}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    {/* Breakdown pill */}
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-400">Total Modal Satuan (HPP)</div>
                      <div className="text-sm font-bold text-emerald-700">
                        {formatCurrency(item.total_modal_hpp)}{" "}
                        <span className="text-[10px] text-zinc-500 font-normal">/{item.unit}</span>
                      </div>
                    </div>

                    <div className="text-right border-l border-zinc-200 pl-4">
                      <div className="text-[10px] text-zinc-400">Estimasi RAB Penawaran (+10%)</div>
                      <div className="text-sm font-bold text-blue-700">
                        {formatCurrency(item.indicative_rab_price)}{" "}
                        <span className="text-[10px] text-zinc-500 font-normal">/{item.unit}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center gap-1 border-l border-zinc-200 pl-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        title="Edit Resep AHSP"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingItem(item)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Hapus AHSP"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Recipe Breakdown Table */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50 p-4">
                    <div className="text-[11px] font-semibold text-zinc-700 mb-2.5 flex items-center gap-2">
                      <span>Rincian Komponen Pembentuk Satuan Pekerjaan</span>
                      <span className="text-zinc-400 font-normal">
                        ({item.components.length} komponen: {laborComps.length} Upah, {materialComps.length} Material)
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-[11px] font-semibold text-zinc-600 border-b border-zinc-200">
                          <tr>
                            <th className="py-2 px-3">Golongan</th>
                            <th className="py-2 px-3">Nama Kebutuhan / Bahan</th>
                            <th className="py-2 px-3 text-right">Koefisien (Convert)</th>
                            <th className="py-2 px-3">Satuan</th>
                            <th className="py-2 px-3 text-right">Harga Satuan Toko / Upah</th>
                            <th className="py-2 px-3 text-right">Subtotal Modal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {/* Labor Components */}
                          {laborComps.map((c, i) => (
                            <tr key={`lab-${i}`} className="hover:bg-amber-50/30">
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                  <HardHat className="h-3 w-3" />
                                  Upah Tukang
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-zinc-900">{c.name}</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{c.coefficient}</td>
                              <td className="py-2 px-3 text-zinc-500">{c.unit}</td>
                              <td className="py-2 px-3 text-right text-zinc-600">{formatCurrency(c.unit_price)}</td>
                              <td className="py-2 px-3 text-right font-semibold text-zinc-900">{formatCurrency(c.subtotal)}</td>
                            </tr>
                          ))}

                          {/* Material Components */}
                          {materialComps.map((c, i) => (
                            <tr key={`mat-${i}`} className="hover:bg-blue-50/30">
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 border border-blue-200">
                                  <Boxes className="h-3 w-3" />
                                  Material Toko
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-zinc-900">{c.name}</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{c.coefficient}</td>
                              <td className="py-2 px-3 text-zinc-500">{c.unit}</td>
                              <td className="py-2 px-3 text-right text-zinc-600">{formatCurrency(c.unit_price)}</td>
                              <td className="py-2 px-3 text-right font-semibold text-zinc-900">{formatCurrency(c.subtotal)}</td>
                            </tr>
                          ))}

                          {/* Equipment Components */}
                          {equipComps.map((c, i) => (
                            <tr key={`eq-${i}`} className="hover:bg-purple-50/30">
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800 border border-purple-200">
                                  Alat / Sewa
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-zinc-900">{c.name}</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">{c.coefficient}</td>
                              <td className="py-2 px-3 text-zinc-500">{c.unit}</td>
                              <td className="py-2 px-3 text-right text-zinc-600">{formatCurrency(c.unit_price)}</td>
                              <td className="py-2 px-3 text-right font-semibold text-zinc-900">{formatCurrency(c.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-zinc-100/70 border-t border-zinc-200 font-semibold text-zinc-900 text-xs">
                          <tr>
                            <td colSpan={5} className="py-2.5 px-3 text-right">
                              TOTAL MODAL SATUAN (HPP) / {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                              {formatCurrency(item.total_modal_hpp)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Tambah / Edit Master AHSP */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950">
                  {editingAhsp ? `Edit Master AHSP (${editingAhsp.code})` : "Tambah Master AHSP Baru"}
                </h2>
                <p className="text-xs text-zinc-500">
                  Definisikan resep satuan pekerjaan dengan menggabungkan Upah Tukang & Material.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Basic Fields */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700">Kode AHSP (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: AHSP-ARS-01"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs font-mono outline-none focus:border-zinc-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-zinc-700">Nama Pekerjaan *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Dinding Bata Ringan 10 cm"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700">Satuan Pekerjaan *</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-400"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          /{u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-zinc-700">Kategori Pekerjaan *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-400"
                    >
                      {CATEGORIES.filter((c) => c !== "ALL").map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-zinc-700">Estimasi Margin Laba RAB (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.overhead_percent}
                      onChange={(e) => setForm({ ...form, overhead_percent: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-400"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-semibold text-zinc-700">Catatan / Spesifikasi Pekerjaan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Termasuk perekat mortar instan 40kg dan tukang plesteran"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-zinc-400"
                    />
                  </div>
                </div>

                {/* Component Builder Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">Komponen Bahan & Upah Pembentuk Satuan</h4>
                      <p className="text-[11px] text-zinc-500">
                        Pilih dari Database Upah / Material atau ketik manual beserta angka konversi (koefisien).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddComponentRow("LABOR")}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        <Plus className="h-3 w-3" />
                        + Upah Tukang
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddComponentRow("MATERIAL")}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-900 hover:bg-blue-100"
                      >
                        <Plus className="h-3 w-3" />
                        + Material Toko
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {form.components.map((comp, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border p-3 text-xs ${
                          comp.component_type === "LABOR"
                            ? "border-amber-200 bg-amber-50/40"
                            : comp.component_type === "MATERIAL"
                            ? "border-blue-200 bg-blue-50/40"
                            : "border-purple-200 bg-purple-50/40"
                        }`}
                      >
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center">
                          {/* Type */}
                          <div className="sm:col-span-2">
                            <select
                              value={comp.component_type}
                              onChange={(e) => handleComponentChange(idx, "component_type", e.target.value)}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none"
                            >
                              <option value="LABOR">Upah Tukang</option>
                              <option value="MATERIAL">Material</option>
                              <option value="EQUIPMENT">Alat</option>
                            </select>
                          </div>

                          {/* Quick Pick Database or Name */}
                          <div className="sm:col-span-4">
                            {comp.component_type === "MATERIAL" && materials.length > 0 ? (
                              <div className="space-y-1">
                                <select
                                  value={comp.material_id || ""}
                                  onChange={(e) => handleComponentChange(idx, "material_id", e.target.value)}
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] outline-none"
                                >
                                  <option value="">-- Pilih dari Database Material --</option>
                                  {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({formatCurrency(m.standard_price)}/{m.purchase_unit})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Atau ketik nama material bebas..."
                                  value={comp.name}
                                  onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none"
                                />
                              </div>
                            ) : comp.component_type === "LABOR" && laborRates.length > 0 ? (
                              <div className="space-y-1">
                                <select
                                  value={comp.labor_rate_id || ""}
                                  onChange={(e) => handleComponentChange(idx, "labor_rate_id", e.target.value)}
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] outline-none"
                                >
                                  <option value="">-- Pilih dari Database Upah --</option>
                                  {laborRates.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.job_name} ({formatCurrency(l.standard_rate)}/{l.unit})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Atau ketik nama upah tukang..."
                                  value={comp.name}
                                  onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none"
                                />
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Nama bahan atau upah..."
                                value={comp.name}
                                onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none"
                              />
                            )}
                          </div>

                          {/* Coefficient */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-zinc-500 block">Koefisien / Vol</label>
                            <input
                              type="number"
                              step="any"
                              required
                              value={comp.coefficient}
                              onChange={(e) => handleComponentChange(idx, "coefficient", Number(e.target.value))}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-right font-mono outline-none"
                            />
                          </div>

                          {/* Unit */}
                          <div className="sm:col-span-1">
                            <label className="text-[10px] text-zinc-500 block">Satuan</label>
                            <input
                              type="text"
                              required
                              value={comp.unit}
                              onChange={(e) => handleComponentChange(idx, "unit", e.target.value)}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>

                          {/* Unit Price */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-zinc-500 block">Harga Satuan (Rp)</label>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              required
                              value={comp.unit_price}
                              onChange={(e) => handleComponentChange(idx, "unit_price", Number(e.target.value))}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-right font-mono outline-none"
                            />
                          </div>

                          {/* Delete Row */}
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveComponentRow(idx)}
                              disabled={form.components.length <= 1}
                              className="rounded p-1 text-zinc-400 hover:text-rose-600 disabled:opacity-30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Row Subtotal */}
                        <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500 border-t border-zinc-200/50 pt-1">
                          <span>
                            Formula: {comp.coefficient || 0} {comp.unit} x {formatCurrency(comp.unit_price || 0)}
                          </span>
                          <span className="font-semibold text-zinc-900">
                            Subtotal: {formatCurrency((comp.coefficient || 0) * (comp.unit_price || 0))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation Summary Box (Matching Dustin's Exact Flow) */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="text-xs font-bold text-emerald-950 mb-2">
                    Hasil Kalkulasi AHSP untuk 1 {form.unit || "m2"} {form.name || "Pekerjaan"}:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-[11px] text-zinc-600">Total Upah:</span>
                      <div className="font-bold text-zinc-900">{formatCurrency(modalCalculations.lab)}</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-600">Total Material:</span>
                      <div className="font-bold text-zinc-900">{formatCurrency(modalCalculations.mat)}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-100 p-2 border border-emerald-300">
                      <span className="text-[11px] font-semibold text-emerald-900">MODAL HPP / {form.unit}:</span>
                      <div className="text-sm font-bold text-emerald-900">
                        {formatCurrency(modalCalculations.modalTotal)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-100 p-2 border border-blue-300">
                      <span className="text-[11px] font-semibold text-blue-900">
                        RAB Jual (+{form.overhead_percent}%):
                      </span>
                      <div className="text-sm font-bold text-blue-900">
                        {formatCurrency(modalCalculations.rabPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-200 px-6 py-4 bg-zinc-50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
                >
                  {editingAhsp ? "Simpan Perubahan AHSP" : "Simpan Master AHSP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Custom Modal: Muat Template Standar 2026 */}
      {showSeedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !isSeeding && setShowSeedModal(false)}
          />

          {/* Dialog Card */}
          <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => !isSeeding && setShowSeedModal(false)}
              className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>

              <div className="space-y-1 pr-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                  Panduan Harga 2026
                </div>
                <h3 className="text-base font-bold text-zinc-950">
                  Muat Template Standar AHSP
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Impor otomatis 25+ resep baku Analisis Harga Satuan Pekerjaan (AHSP) standar Time Travel Design beserta koefisien material toko & upah tukang.
                </p>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-2.5 text-xs">
              <span className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wider block">
                Item Pekerjaan Siap Pakai:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Dinding Hebel 10cm & 7.5cm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Plesteran & Acian Halus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Plafon Gypsum 9mm Hollow</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Keramik 40x40 KW2 / Grade A-C</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Cat Dulux Catylac & Pentalite</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Lantai SPC Klik 5mm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Wallpanel & Meja HPL Taco</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Pipa PVC 4 Inch, LED Strip, Steger</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200/60 flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span>Aman: Data yang sudah ada tidak akan ditimpa atau diduplikasi.</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setShowSeedModal(false)}
                disabled={isSeeding}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeSeedStandard}
                disabled={isSeeding}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Mengimpor Template...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Ya, Muat Template Standar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Custom Modal: Konfirmasi Hapus AHSP */}
      <DeleteConfirmDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={executeDelete}
        isDeleting={isDeleting}
        title="Hapus Master AHSP"
        description="Apakah Anda yakin ingin menghapus resep pekerjaan ini dari katalog Master AHSP? Tindakan ini tidak dapat dibatalkan."
        itemName={deletingItem ? `${deletingItem.name} (${deletingItem.code})` : undefined}
        confirmLabel="Hapus Sekarang"
        cancelLabel="Batal"
      />
    </div>
  );
}
