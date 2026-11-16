"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Tags,
  Plus,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Store,
  Calendar,
  X,
  CreditCard,
  Building2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import {
  getMasterMaterials,
  getMaterialPriceHistory,
  getMaterialPriceAnalytics,
  createMasterMaterial,
  recordMaterialPurchase,
  MasterMaterialItem,
  MaterialPriceHistoryItem,
} from "@/app/actions/cost-control/materialActions";
import { getProjects } from "@/app/actions/projectActions";
import { getVendors } from "@/app/actions/vendorActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function MaterialPricesPage() {
  const [materials, setMaterials] = useState<MasterMaterialItem[]>([]);
  const [history, setHistory] = useState<MaterialPriceHistoryItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [cashAccounts, setCashAccounts] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("ALL");
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getMaterialPriceAnalytics>> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showRecordPurchaseModal, setShowRecordPurchaseModal] = useState(false);

  const [newMaterialForm, setNewMaterialForm] = useState({
    code: "",
    name: "",
    category: "Semen & Mortar",
    brand: "",
    specification: "",
    purchase_unit: "sak",
    usage_unit: "kg",
    conversion_factor: 50,
    standard_price: 65000,
    min_price: 60000,
    max_price: 70000,
    waste_tolerance_percent: 5,
    notes: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    material_id: "",
    vendor_id: "",
    vendor_name: "",
    project_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    document_number: "",
    quantity: 10,
    unit: "sak",
    unit_price: 65000,
    tax_amount: 0,
    notes: "",
    create_expense: false,
    cash_account_id: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [matList, histList, projList, vendList, accounts, stats] = await Promise.all([
        getMasterMaterials(),
        getMaterialPriceHistory({
          materialId: selectedMaterialId === "ALL" ? undefined : selectedMaterialId,
          vendorId: selectedVendorFilter === "ALL" ? undefined : selectedVendorFilter,
        }),
        getProjects(),
        getVendors(),
        getCashAccountsWithBalances(),
        getMaterialPriceAnalytics(selectedMaterialId === "ALL" ? undefined : selectedMaterialId),
      ]);
      setMaterials(matList);
      setHistory(histList);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      setVendors((vendList || []).map((v: any) => ({ id: v.id, name: v.name })));
      setCashAccounts((accounts || []).map((a: any) => ({ id: a.id, name: a.name })));
      setAnalytics(stats);

      if (matList.length > 0) {
        setPurchaseForm((prev) => prev.material_id ? prev : ({
          ...prev,
          material_id: matList[0].id,
          unit: matList[0].purchase_unit,
          unit_price: matList[0].standard_price,
        }));
      }
      if (accounts && accounts.length > 0) {
        setPurchaseForm((prev) => prev.cash_account_id ? prev : ({ ...prev, cash_account_id: accounts[0].id }));
      }
    } catch (err: any) {
      console.error("Gagal memuat database harga material:", err);
      setError(err?.message || "Gagal memuat database harga material.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMaterialId, selectedVendorFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => set.add(m.category));
    return Array.from(set);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCat = categoryFilter === "ALL" || m.category === categoryFilter;
      const matchSearch =
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.brand || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [materials, categoryFilter, searchQuery]);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newMaterialForm.code.trim()) throw new Error("Kode material wajib diisi.");
      if (!newMaterialForm.name.trim()) throw new Error("Nama material wajib diisi.");

      await createMasterMaterial(newMaterialForm);
      setSuccessMsg("Material baru berhasil ditambahkan ke katalog master.");
      setShowAddMaterialModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal membuat master material.");
    }
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!purchaseForm.material_id) throw new Error("Pilih material terlebih dahulu.");
      if (!purchaseForm.vendor_name.trim()) throw new Error("Nama toko / supplier wajib diisi.");

      await recordMaterialPurchase({
        material_id: purchaseForm.material_id,
        vendor_id: purchaseForm.vendor_id || undefined,
        vendor_name: purchaseForm.vendor_name,
        project_id: purchaseForm.project_id || undefined,
        purchase_date: purchaseForm.purchase_date,
        document_number: purchaseForm.document_number,
        quantity: Number(purchaseForm.quantity),
        unit: purchaseForm.unit,
        unit_price: Number(purchaseForm.unit_price),
        tax_amount: Number(purchaseForm.tax_amount || 0),
        notes: purchaseForm.notes,
        create_expense: purchaseForm.create_expense,
        cash_account_id: purchaseForm.cash_account_id || undefined,
      });

      setSuccessMsg("Pembelian material berhasil dicatat dan histori harga diperbarui.");
      setShowRecordPurchaseModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal mencatat transaksi pembelian.");
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <Tags className="h-3.5 w-3.5" />
            Database & Intelligence Harga Material
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Database Harga Material
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Perbandingan histori pembelian dari toko bangunan & supplier: termurah, termahal, rata-rata, dan tren riil.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowAddMaterialModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Master Material
          </button>
          <button
            onClick={() => setShowRecordPurchaseModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
          >
            <DollarSign className="h-4 w-4" />
            Catat Pembelian Toko
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
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

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Harga Termurah Pernah Dibeli"
          value={formatCurrency(analytics?.cheapestPrice || 0)}
          subtitle={`Toko: ${analytics?.cheapestVendor || "-"}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Harga Termahal Tercatat"
          value={formatCurrency(analytics?.highestPrice || 0)}
          subtitle={`Toko: ${analytics?.highestVendor || "-"}`}
          icon={Tags}
        />
        <StatCard
          title="Harga Rata-Rata Pembelian"
          value={formatCurrency(analytics?.averagePrice || 0)}
          subtitle={`Berdasarkan ${analytics?.totalTransactions || 0} transaksi`}
          icon={BarChart3}
        />
        <StatCard
          title="Harga Pembelian Terakhir"
          value={formatCurrency(analytics?.lastPrice || 0)}
          subtitle={`Toko: ${analytics?.lastVendor || "-"}`}
          icon={Store}
        />
      </div>

      {/* Trend Chart (if data points exist) */}
      {analytics && analytics.priceTrend && analytics.priceTrend.length > 1 && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Tren Perubahan Harga Pembelian</h2>
              <p className="text-xs text-zinc-500">Histori harga transaksi material dari waktu ke waktu</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              Riwayat Terkini
            </span>
          </div>
          <div className="mt-6 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.priceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  tickFormatter={(val) => `Rp${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(val), "Harga Satuan"]}
                  labelFormatter={(lbl) => `Tanggal: ${lbl}`}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10B981" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Catalog & Filter Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Master Material Catalog */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-950">Katalog Material Master ({filteredMaterials.length})</h2>
            <button
              onClick={() => setSelectedMaterialId("ALL")}
              className={`text-xs ${selectedMaterialId === "ALL" ? "font-bold text-emerald-700" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              Semua
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredMaterials.map((mat) => {
              const isSelected = selectedMaterialId === mat.id;
              return (
                <div
                  key={mat.id}
                  onClick={() => setSelectedMaterialId(mat.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold"
                      : "border-zinc-200/70 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-zinc-900">{mat.name}</span>
                    <Badge variant="neutral">{mat.purchase_unit}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{mat.code} • {mat.brand || mat.category}</span>
                    <span className="font-bold text-zinc-900">{formatCurrency(mat.standard_price)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Historical Purchase Transactions Table */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-zinc-50/50">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Histori Pembelian Riil Dari Toko / Supplier</h2>
              <p className="text-xs text-zinc-500">Catatan transaksi faktur, kwitansi, dan harga beli lapangan</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 outline-none"
              >
                <option value="ALL">Semua Toko / Supplier</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Toko / Supplier</th>
                  <th className="px-4 py-3">Proyek</th>
                  <th className="px-4 py-3 text-right">Kuantitas</th>
                  <th className="px-4 py-3 text-right">Harga Satuan</th>
                  <th className="px-4 py-3 text-right">Total Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400">
                      Belum ada histori pembelian untuk filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  history.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {new Date(row.purchase_date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        {row.material?.name || "Material"}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.vendor_name}</td>
                      <td className="px-4 py-3 text-zinc-500">{row.project?.code || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800">
                        {row.quantity} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-800">
                        {formatCurrency(row.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-950">
                        {formatCurrency(row.total_price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: TAMBAH MASTER MATERIAL */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Tambah Master Material Baru</h3>
              <button onClick={() => setShowAddMaterialModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kode Material</label>
                  <input
                    type="text"
                    placeholder="Contoh: MAT-SMN-03"
                    value={newMaterialForm.code}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 uppercase font-mono outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kategori</label>
                  <input
                    type="text"
                    placeholder="Contoh: Semen & Mortar"
                    value={newMaterialForm.category}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Material</label>
                <input
                  type="text"
                  placeholder="Contoh: Semen Gresik Portland Pozzolan 50kg"
                  value={newMaterialForm.name}
                  onChange={(e) => setNewMaterialForm({ ...newMaterialForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Merek / Pabrikan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Gresik / Semen Indonesia"
                    value={newMaterialForm.brand}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, brand: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Spesifikasi / Dimensi</label>
                  <input
                    type="text"
                    placeholder="Contoh: 50kg / sak"
                    value={newMaterialForm.specification}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, specification: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan Pembelian</label>
                  <input
                    type="text"
                    placeholder="sak / dus"
                    value={newMaterialForm.purchase_unit}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, purchase_unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan Pemakaian</label>
                  <input
                    type="text"
                    placeholder="kg / m²"
                    value={newMaterialForm.usage_unit}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, usage_unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Faktor Konversi</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="50"
                    value={newMaterialForm.conversion_factor}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, conversion_factor: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Harga Standar Perusahaan</label>
                  <input
                    type="number"
                    value={newMaterialForm.standard_price}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, standard_price: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Toleransi Waste (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={newMaterialForm.waste_tolerance_percent}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, waste_tolerance_percent: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Simpan Master Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CATAT PEMBELIAN MATERIAL DARI TOKO */}
      {showRecordPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Catat Pembelian Material ke Toko</h3>
              <button onClick={() => setShowRecordPurchaseModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPurchase} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Material</label>
                <select
                  value={purchaseForm.material_id}
                  onChange={(e) => {
                    const m = materials.find((mat) => mat.id === e.target.value);
                    setPurchaseForm({
                      ...purchaseForm,
                      material_id: e.target.value,
                      unit: m?.purchase_unit || "unit",
                      unit_price: m?.standard_price || 0,
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} • {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Toko Bangunan / Supplier</label>
                  <input
                    type="text"
                    placeholder="Contoh: Toko TB Sinar Terang"
                    value={purchaseForm.vendor_name}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, vendor_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Alokasi Proyek (Opsional)</label>
                  <select
                    value={purchaseForm.project_id}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, project_id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  >
                    <option value="">-- Umum / Tanpa Proyek --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} • {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kuantitas</label>
                  <input
                    type="number"
                    step="any"
                    value={purchaseForm.quantity}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan</label>
                  <input
                    type="text"
                    value={purchaseForm.unit}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    value={purchaseForm.unit_price}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_price: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tanggal Pembelian</label>
                  <input
                    type="date"
                    value={purchaseForm.purchase_date}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">No. Nota / Faktur</label>
                  <input
                    type="text"
                    placeholder="Contoh: FAK-09928"
                    value={purchaseForm.document_number}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, document_number: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3 bg-zinc-50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-900">
                  <input
                    type="checkbox"
                    checked={purchaseForm.create_expense}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, create_expense: e.target.checked })}
                    className="rounded border-zinc-300 text-zinc-900"
                  />
                  Catat sebagai Pengeluaran Kas Sekarang
                </label>
                {purchaseForm.create_expense && (
                  <div className="pt-2">
                    <label className="text-xs text-zinc-600">Pilih Rekening Kas / Bank</label>
                    <select
                      value={purchaseForm.cash_account_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, cash_account_id: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none cursor-pointer"
                    >
                      {cashAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-zinc-900 p-3 text-xs text-white flex justify-between items-center">
                <span>Total Pembelian:</span>
                <span className="font-bold text-sm">
                  {formatCurrency(purchaseForm.quantity * purchaseForm.unit_price)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowRecordPurchaseModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
