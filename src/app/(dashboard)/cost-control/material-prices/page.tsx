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
  Edit2,
  Trash2,
  ShoppingBag,
  ArrowUpDown,
  Check,
  Loader2,
} from "lucide-react";
import {
  getMasterMaterials,
  getMaterialPriceHistory,
  getMaterialPriceAnalytics,
  createMasterMaterial,
  updateMasterMaterial,
  deleteMasterMaterial,
  deleteMaterialPriceHistory,
  recordMaterialPurchase,
  recordStoreMaterialPrice,
  MasterMaterialItem,
  MaterialPriceHistoryItem,
} from "@/app/actions/cost-control/materialActions";
import { getProjects } from "@/app/actions/projectActions";
import { getVendors } from "@/app/actions/vendorActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { summarizeMaterialPrices } from "@/lib/cost-control/materialPrices";
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
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getMaterialPriceAnalytics>> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"material" | "store-price" | "purchase" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MasterMaterialItem | null>(null);
  const [showRecordPurchaseModal, setShowRecordPurchaseModal] = useState(false);
  const [showAddStorePriceModal, setShowAddStorePriceModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "MATERIAL" | "HISTORY";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form: Tambah / Edit Master Material
  const [newMaterialForm, setNewMaterialForm] = useState({
    code: "",
    name: "",
    brand: "",
    specification: "",
    purchase_unit: "lembar",
    usage_unit: "lembar",
    conversion_factor: 1,
    standard_price: 0,
    min_price: 0,
    max_price: 0,
    waste_tolerance_percent: 5,
    notes: "",
    initial_vendor_name: "",
    initial_price: 0,
  });

  // Form: Catat Pembelian Proyek Riil
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

  // Form: Catat Harga Toko Baru (Survei / Referensi Toko)
  const [storePriceForm, setStorePriceForm] = useState({
    material_id: "",
    vendor_name: "",
    unit_price: 0,
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
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
        setPurchaseForm((prev) =>
          prev.material_id
            ? prev
            : {
                ...prev,
                material_id: matList[0].id,
                unit: matList[0].purchase_unit,
                unit_price: matList[0].standard_price || 0,
              }
        );
      }
      if (accounts && accounts.length > 0) {
        setPurchaseForm((prev) => (prev.cash_account_id ? prev : { ...prev, cash_account_id: accounts[0].id }));
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

  // Aggregate store prices per material for quick comparison & range display
  const materialStoreStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        cheapestVendor: string;
        highestVendor: string;
        lastPrice: number;
        lastVendor: string;
        stores: Array<{
          id: string;
          vendor: string;
          price: number;
          date: string;
          notes?: string;
        }>;
      }
    > = {};

    history.forEach((h) => {
      if (!map[h.material_id]) {
        map[h.material_id] = {
          minPrice: h.unit_price,
          maxPrice: h.unit_price,
          avgPrice: h.unit_price,
          cheapestVendor: h.vendor_name,
          highestVendor: h.vendor_name,
          lastPrice: h.unit_price,
          lastVendor: h.vendor_name,
          stores: [],
        };
      }

      map[h.material_id].stores.push({
        id: h.id,
        vendor: h.vendor_name,
        price: h.unit_price,
        date: h.purchase_date,
        notes: h.notes || undefined,
      });
    });

    Object.keys(map).forEach((id) => {
      const item = map[id];
      const prices = item.stores.map((s) => s.price);
      const summary = summarizeMaterialPrices(prices);
      item.minPrice = summary.minPrice;
      item.maxPrice = summary.maxPrice;
      item.avgPrice = summary.averagePrice;
      const cheapest = item.stores.find((s) => s.price === item.minPrice);
      const highest = item.stores.find((s) => s.price === item.maxPrice);
      if (cheapest) item.cheapestVendor = cheapest.vendor;
      if (highest) item.highestVendor = highest.vendor;
    });

    return map;
  }, [history]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch =
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.brand || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [materials, searchQuery]);

  // Material currently active
  const activeMaterial = useMemo(() => {
    if (selectedMaterialId === "ALL") return null;
    return materials.find((m) => m.id === selectedMaterialId) || null;
  }, [materials, selectedMaterialId]);

  const activeMaterialStoreStats = useMemo(() => {
    if (!activeMaterial) return null;
    return materialStoreStatsMap[activeMaterial.id] || null;
  }, [activeMaterial, materialStoreStatsMap]);

  const groupedHistory = useMemo(() => {
    const groups = new Map<
      string,
      {
        materialId: string;
        materialName: string;
        materialCode: string;
        rows: MaterialPriceHistoryItem[];
      }
    >();

    history.forEach((row) => {
      let group = groups.get(row.material_id);
      if (!group) {
        group = {
          materialId: row.material_id,
          materialName: row.material?.name || "Material",
          materialCode: row.material?.code || "",
          rows: [],
        };
        groups.set(row.material_id, group);
      }
      group.rows.push(row);
    });

    return Array.from(groups.values());
  }, [history]);

  const handleOpenAddMaterial = () => {
    setEditingMaterial(null);
    setNewMaterialForm({
      code: `MAT-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      brand: "",
      specification: "",
      purchase_unit: "lembar",
      usage_unit: "lembar",
      conversion_factor: 1,
      standard_price: 0,
      min_price: 0,
      max_price: 0,
      waste_tolerance_percent: 5,
      notes: "",
      initial_vendor_name: "",
      initial_price: 0,
    });
    setShowAddMaterialModal(true);
  };

  const handleOpenEditMaterial = (mat: MasterMaterialItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingMaterial(mat);
    setNewMaterialForm({
      code: mat.code,
      name: mat.name,
      brand: mat.brand || "",
      specification: mat.specification || "",
      purchase_unit: mat.purchase_unit,
      usage_unit: mat.usage_unit,
      conversion_factor: mat.conversion_factor || 1,
      standard_price: mat.standard_price || 0,
      min_price: mat.min_price || 0,
      max_price: mat.max_price || 0,
      waste_tolerance_percent: mat.waste_tolerance_percent || 5,
      notes: mat.notes || "",
      initial_vendor_name: "",
      initial_price: 0,
    });
    setShowAddMaterialModal(true);
  };

  const handleDeleteMaterial = (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTarget({ type: "MATERIAL", id, name });
  };

  const handleDeleteHistory = (historyId: string, vendorName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTarget({ type: "HISTORY", id: historyId, name: vendorName });
  };

  const handleCreateOrUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    try {
      setPendingAction("material");
      if (!newMaterialForm.name.trim()) throw new Error("Nama material wajib diisi.");
      const finalCode = newMaterialForm.code.trim() || `MAT-${Date.now().toString().slice(-6)}`;
      const stdPrice = Number(newMaterialForm.standard_price) > 0
        ? Number(newMaterialForm.standard_price)
        : (Number(newMaterialForm.initial_price) || 0);

      const payload = {
        ...newMaterialForm,
        code: finalCode,
        category: editingMaterial?.category || "Material",
        standard_price: stdPrice,
        usage_unit: newMaterialForm.usage_unit?.trim() || newMaterialForm.purchase_unit.trim(),
        conversion_factor: newMaterialForm.conversion_factor || 1,
      };

      if (editingMaterial) {
        await updateMasterMaterial(editingMaterial.id, payload);
        setSuccessMsg(`Material "${newMaterialForm.name}" berhasil diperbarui.`);
      } else {
        await createMasterMaterial(payload);
        setSuccessMsg(
          newMaterialForm.initial_vendor_name
            ? `Material baru & harga awal "${newMaterialForm.initial_vendor_name}" berhasil disimpan.`
            : "Material baru berhasil ditambahkan ke katalog."
        );
      }
      setShowAddMaterialModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan master material.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenAddStorePrice = (matId?: string) => {
    const targetId = matId || (selectedMaterialId !== "ALL" ? selectedMaterialId : materials[0]?.id || "");
    setStorePriceForm({
      material_id: targetId,
      vendor_name: "",
      unit_price: 0,
      purchase_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setShowAddStorePriceModal(true);
  };

  const handleSaveStorePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    try {
      setPendingAction("store-price");
      if (!storePriceForm.material_id) throw new Error("Pilih material terlebih dahulu.");
      if (!storePriceForm.vendor_name.trim()) throw new Error("Nama toko / supplier wajib diisi.");
      if (storePriceForm.unit_price <= 0) throw new Error("Harga satuan harus lebih besar dari Rp 0.");

      await recordStoreMaterialPrice({
        material_id: storePriceForm.material_id,
        vendor_name: storePriceForm.vendor_name.trim(),
        unit_price: storePriceForm.unit_price,
        purchase_date: storePriceForm.purchase_date,
        notes: storePriceForm.notes,
      });

      setSuccessMsg(
        `Harga dari "${storePriceForm.vendor_name}" (${formatCurrency(storePriceForm.unit_price)}) berhasil dicatat.`
      );
      setShowAddStorePriceModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal mencatat harga toko.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingAction) return;
    try {
      setPendingAction("purchase");
      if (!purchaseForm.material_id) throw new Error("Pilih material terlebih dahulu.");
      if (!purchaseForm.vendor_name.trim()) throw new Error("Nama toko / vendor wajib diisi.");
      if (purchaseForm.quantity <= 0) throw new Error("Kuantitas harus lebih dari 0.");
      if (purchaseForm.unit_price <= 0) throw new Error("Harga satuan harus lebih dari 0.");

      await recordMaterialPurchase({
        material_id: purchaseForm.material_id,
        vendor_id: purchaseForm.vendor_id || undefined,
        vendor_name: purchaseForm.vendor_name.trim(),
        project_id: purchaseForm.project_id || undefined,
        purchase_date: purchaseForm.purchase_date,
        document_number: purchaseForm.document_number || undefined,
        quantity: purchaseForm.quantity,
        unit: purchaseForm.unit,
        unit_price: purchaseForm.unit_price,
        tax_amount: purchaseForm.tax_amount,
        notes: purchaseForm.notes || undefined,
        create_expense: purchaseForm.create_expense,
        cash_account_id: purchaseForm.create_expense ? purchaseForm.cash_account_id : undefined,
      });

      setSuccessMsg("Transaksi pembelian riil berhasil dicatat dan masuk ke histori harga.");
      setShowRecordPurchaseModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal mencatat transaksi pembelian material.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Messages */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200/60">
              🏷️ Database & Rentang Harga Material
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            Database Harga Material
          </h1>
          <p className="text-xs text-zinc-500">
            Koleksi harga dari berbagai toko material & supplier. Otomatis menampilkan rentang harga, harga termurah, dan titik tengah rentang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenAddStorePrice()}
            className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition shadow-xs"
          >
            <Store className="h-3.5 w-3.5 text-emerald-700" />
            Input Harga Toko Baru
          </button>

          <button
            onClick={handleOpenAddMaterial}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Master Material
          </button>

          <button
            onClick={() => setShowRecordPurchaseModal(true)}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Catat Pembelian Proyek
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Harga Termurah Pernah Dicatat"
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
          title="Titik Tengah Rentang Harga"
          value={formatCurrency(analytics?.averagePrice || 0)}
          subtitle="Antara harga terendah dan tertinggi"
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

      {/* Catalog & Store Price Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Master Material Catalog */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-950">Katalog Material Master ({filteredMaterials.length})</h2>
            <button
              onClick={() => setSelectedMaterialId("ALL")}
              className={`text-xs ${
                selectedMaterialId === "ALL" ? "font-bold text-emerald-700" : "text-zinc-500 hover:text-zinc-800"
              }`}
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

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredMaterials.map((mat) => {
              const isSelected = selectedMaterialId === mat.id;
              const stats = materialStoreStatsMap[mat.id];

              return (
                <div
                  key={mat.id}
                  onClick={() => setSelectedMaterialId(mat.id)}
                  className={`group relative p-3 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs"
                      : "border-zinc-200/70 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50/50"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-bold text-zinc-900 leading-tight block">{mat.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {mat.code} {mat.brand ? `• ${mat.brand}` : ""} {mat.specification ? `• ${mat.specification}` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="neutral">{mat.purchase_unit}</Badge>
                      <div className="flex items-center ml-0.5 opacity-80 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditMaterial(mat, e)}
                          title={`Edit ${mat.name}`}
                          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 transition"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMaterial(mat.id, mat.name, e)}
                          title={`Hapus ${mat.name}`}
                          className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Display: Dynamic Store Range vs Fallback */}
                  {stats && stats.stores.length > 0 ? (
                    <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-zinc-900 text-xs">
                          {stats.minPrice === stats.maxPrice
                            ? formatCurrency(stats.minPrice)
                            : `${formatCurrency(stats.minPrice)} – ${formatCurrency(stats.maxPrice)}`}
                          <span className="text-[10px] font-normal text-zinc-500"> / {mat.purchase_unit}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Titik tengah: <span className="font-semibold text-zinc-700">{formatCurrency(stats.avgPrice)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-block rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          {stats.stores.length} Toko
                        </span>
                        <div className="text-[9px] text-zinc-400 mt-0.5 truncate max-w-[110px]">
                          Min: {stats.cheapestVendor}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Belum ada data toko</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddStorePrice(mat.id);
                        }}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        + Input Toko
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Material Comparison & All Historical Purchases */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Material Comparison Card (Dustin's Exact Feature Request) */}
          {activeMaterial && (
            <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/30 to-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {activeMaterial.code}
                    </span>
                    <h3 className="text-base font-bold text-zinc-950">{activeMaterial.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {activeMaterial.brand ? `Merek: ${activeMaterial.brand}` : ""} • {activeMaterial.specification || activeMaterial.category} • Satuan: {activeMaterial.purchase_unit}
                  </p>
                </div>

                <button
                  onClick={() => handleOpenAddStorePrice(activeMaterial.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-xs self-start sm:self-center"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Toko Lain
                </button>
              </div>

              {/* Range & Average Summary Banner */}
              {activeMaterialStoreStats && activeMaterialStoreStats.stores.length > 0 ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-zinc-200/80 bg-white p-3">
                      <span className="text-[11px] text-zinc-500 font-medium">Rentang Harga Pasar</span>
                      <div className="mt-1 text-sm font-bold text-zinc-900">
                        {activeMaterialStoreStats.minPrice === activeMaterialStoreStats.maxPrice
                          ? formatCurrency(activeMaterialStoreStats.minPrice)
                          : `${formatCurrency(activeMaterialStoreStats.minPrice)} – ${formatCurrency(activeMaterialStoreStats.maxPrice)}`}
                      </div>
                      <span className="text-[10px] text-zinc-400">per {activeMaterial.purchase_unit}</span>
                    </div>

                    <div className="rounded-xl border border-zinc-200/80 bg-white p-3">
                      <span className="text-[11px] text-zinc-500 font-medium">Titik Tengah Harga Toko</span>
                      <div className="mt-1 text-sm font-bold text-zinc-900">
                        {formatCurrency(activeMaterialStoreStats.avgPrice)}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        dari {activeMaterialStoreStats.stores.length} toko yang diinput
                      </span>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <span className="text-[11px] text-emerald-800 font-medium">Toko Termurah (Rekomendasi)</span>
                      <div className="mt-1 text-sm font-bold text-emerald-900">
                        {formatCurrency(activeMaterialStoreStats.minPrice)}
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700">
                        🏪 {activeMaterialStoreStats.cheapestVendor}
                      </span>
                    </div>
                  </div>

                  {/* List of Stores for This Specific Material */}
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-zinc-900 mb-2">Daftar Harga di Tiap Toko:</h4>
                    <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white overflow-hidden">
                      {activeMaterialStoreStats.stores.map((st, sIdx) => {
                        const isCheapest = st.price === activeMaterialStoreStats.minPrice;
                        const isHighest =
                          st.price === activeMaterialStoreStats.maxPrice &&
                          activeMaterialStoreStats.maxPrice > activeMaterialStoreStats.minPrice;
                        const diffPercent = Math.round(
                          ((st.price - activeMaterialStoreStats.minPrice) / activeMaterialStoreStats.minPrice) * 100
                        );

                        return (
                          <div key={sIdx} className="flex items-center justify-between p-3 text-xs hover:bg-zinc-50/60 transition">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                <Store className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="font-bold text-zinc-900">{st.vendor}</span>
                                <div className="text-[10px] text-zinc-400">
                                  {new Date(st.date).toLocaleDateString("id-ID")} {st.notes ? `• ${st.notes}` : ""}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isCheapest && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Termurah
                                </span>
                              )}
                              {isHighest && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                  Termahal (+{diffPercent}%)
                                </span>
                              )}
                              <span className="font-mono font-bold text-zinc-950 text-sm">
                                {formatCurrency(st.price)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteHistory(st.id, st.vendor, e)}
                                title={`Hapus harga toko ${st.vendor}`}
                                className="rounded-md p-1 text-zinc-300 hover:bg-red-50 hover:text-red-600 transition ml-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-500 bg-white">
                  <p>Material ini belum memiliki catatan harga toko.</p>
                  <button
                    onClick={() => handleOpenAddStorePrice(activeMaterial.id)}
                    className="mt-2 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    + Masukkan Harga Toko Sekarang
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Historical Purchase Transactions Table */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-zinc-50/50">
              <div>
                <h2 className="text-sm font-bold text-zinc-950">Histori Pembelian & Survei Harga Toko</h2>
                <p className="text-xs text-zinc-500">Catatan transaksi faktur, kwitansi toko, dan survei lapangan</p>
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
                    <th className="px-4 py-3">Proyek / Catatan</th>
                    <th className="px-4 py-3 text-right">Kuantitas</th>
                    <th className="px-4 py-3 text-right">Harga Satuan</th>
                    <th className="px-4 py-3 text-right">Total Transaksi</th>
                    <th className="px-3 py-3 text-center w-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-400">
                        Belum ada histori pembelian untuk filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    groupedHistory.flatMap((group) =>
                      group.rows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-zinc-50/60 transition">
                          <td className="px-4 py-3 font-medium text-zinc-800">
                            {new Date(row.purchase_date).toLocaleDateString("id-ID")}
                          </td>
                          {index === 0 && (
                            <td rowSpan={group.rows.length} className="px-4 py-3 align-top font-semibold text-zinc-950">
                              <div>{group.materialName}</div>
                              {group.materialCode && (
                                <div className="font-mono text-[10px] font-normal text-zinc-400">
                                  {group.materialCode}
                                </div>
                              )}
                              {materialStoreStatsMap[group.materialId]?.stores.length > 0 && (
                                <div className="mt-1 text-[10px] font-medium text-zinc-500">
                                  Titik tengah: {formatCurrency(materialStoreStatsMap[group.materialId].avgPrice)}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 font-medium text-zinc-900">{row.vendor_name}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {row.project?.code ? `Proyek: ${row.project.code}` : row.notes || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-zinc-800">
                            {row.quantity} {row.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-800">
                            {formatCurrency(row.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-zinc-950">
                            {formatCurrency(row.total_price)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteHistory(row.id, row.vendor_name, e)}
                              title={`Hapus riwayat harga ${row.vendor_name}`}
                              className="rounded-md p-1 text-zinc-300 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: TAMBAH / EDIT MASTER MATERIAL */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  {editingMaterial ? `Edit Material: ${editingMaterial.name}` : "Tambah Master Material Baru"}
                </h3>
                <p className="text-xs text-zinc-500">
                  Daftarkan spesifikasi material baru ke database perusahaan.
                </p>
              </div>
              <button onClick={() => setShowAddMaterialModal(false)} disabled={pendingAction === "material"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateMaterial} className="mt-4 space-y-4">
              <div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kode Material</label>
                  <input
                    type="text"
                    placeholder="Contoh: MAT-GYP-01"
                    value={newMaterialForm.code}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 uppercase font-mono outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Material</label>
                <input
                  type="text"
                  placeholder="Contoh: Gypsum Board 9mm"
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
                    placeholder="Contoh: Aplus / Jayaboard"
                    value={newMaterialForm.brand}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, brand: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Spesifikasi / Dimensi</label>
                  <input
                    type="text"
                    placeholder="Contoh: 1200 x 2400 mm"
                    value={newMaterialForm.specification}
                    onChange={(e) => setNewMaterialForm({ ...newMaterialForm, specification: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan Beli Material (di Toko/Supplier) *</label>
                  <input
                    type="text"
                    placeholder="Contoh: sak, m3, batang, kg, dus, pail, lembar, m', pcs, ls"
                    value={newMaterialForm.purchase_unit}
                    onChange={(e) => {
                      const pUnit = e.target.value;
                      setNewMaterialForm({
                        ...newMaterialForm,
                        purchase_unit: pUnit,
                        usage_unit: pUnit,
                        conversion_factor: 1,
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 font-medium"
                    required
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Cukup masukkan satuan beli dari toko (misal: /sak, /m3, /batang). Angka konversi kebutuhan pekerjaan diatur di Master AHSP.
                  </p>
                </div>

                <details className="text-xs text-zinc-500 pt-1">
                  <summary className="cursor-pointer font-semibold text-zinc-600 hover:text-zinc-900">
                    ⚙️ Opsi Konversi Satuan Pemakaian (Lanjutan)
                  </summary>
                  <div className="grid grid-cols-2 gap-3 mt-2 rounded-xl bg-zinc-50 p-3 border border-zinc-200">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-700">Satuan Pemakaian</label>
                      <input
                        type="text"
                        placeholder="Contoh: kg"
                        value={newMaterialForm.usage_unit}
                        onChange={(e) => setNewMaterialForm({ ...newMaterialForm, usage_unit: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-700">Rasio Konversi (1 Beli = ... Pemakaian)</label>
                      <input
                        type="number"
                        step="any"
                        value={newMaterialForm.conversion_factor}
                        onChange={(e) => setNewMaterialForm({ ...newMaterialForm, conversion_factor: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs outline-none"
                      />
                    </div>
                  </div>
                </details>
              </div>

              {/* Input Toko Pertama (Hanya saat pembuatan baru) */}
              {!editingMaterial && (
                <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">Catat Harga Toko Pertama (Opsional)</span>
                    <span className="text-[10px] text-emerald-700 font-medium">Survei harga riil</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-700">Nama Toko Material</label>
                      <input
                        type="text"
                        placeholder="Contoh: Toko Bangunan A"
                        value={newMaterialForm.initial_vendor_name}
                        onChange={(e) => setNewMaterialForm({ ...newMaterialForm, initial_vendor_name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-700">
                        Harga Satuan ({newMaterialForm.purchase_unit || "unit"})
                      </label>
                      <input
                        type="number"
                        placeholder="Contoh: 60000"
                        value={newMaterialForm.initial_price || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setNewMaterialForm({
                            ...newMaterialForm,
                            initial_price: val,
                            standard_price: val > 0 ? val : newMaterialForm.standard_price,
                          });
                        }}
                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Sistem otomatis menghitung rentang harga pasar (misal Rp 55.000 – Rp 60.000) dan harga rata-rata dari toko-toko yang Anda input.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(false)}
                  disabled={pendingAction === "material"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "material"}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "material" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "material"
                    ? "Menyimpan Material..."
                    : editingMaterial
                      ? "Simpan Perubahan Material"
                      : "Simpan Master Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INPUT HARGA DARI TOKO LAIN (Survei Toko Cepat) */}
      {showAddStorePriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Catat Harga dari Toko Material</h3>
                <p className="text-xs text-zinc-500">Tambahkan toko dan tarif harga untuk perbandingan pasar.</p>
              </div>
              <button onClick={() => setShowAddStorePriceModal(false)} disabled={pendingAction === "store-price"} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStorePrice} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Material</label>
                <select
                  value={storePriceForm.material_id}
                  onChange={(e) => setStorePriceForm({ ...storePriceForm, material_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} • {m.name} ({m.purchase_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Toko Bangunan / Supplier</label>
                <input
                  type="text"
                  placeholder="Contoh: Toko Bangunan B"
                  value={storePriceForm.vendor_name}
                  onChange={(e) => setStorePriceForm({ ...storePriceForm, vendor_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 55000"
                    value={storePriceForm.unit_price || ""}
                    onChange={(e) =>
                      setStorePriceForm({ ...storePriceForm, unit_price: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tanggal Survei / Beli</label>
                  <input
                    type="date"
                    value={storePriceForm.purchase_date}
                    onChange={(e) =>
                      setStorePriceForm({ ...storePriceForm, purchase_date: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Harga cash / belum termasuk ongkir"
                  value={storePriceForm.notes}
                  onChange={(e) => setStorePriceForm({ ...storePriceForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddStorePriceModal(false)}
                  disabled={pendingAction === "store-price"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "store-price"}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "store-price" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "store-price" ? "Menyimpan Harga..." : "Simpan Harga Toko"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CATAT PEMBELIAN MATERIAL KE PROYEK */}
      {showRecordPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Catat Pembelian Material ke Proyek</h3>
              <button onClick={() => setShowRecordPurchaseModal(false)} disabled={pendingAction === "purchase"} className="text-zinc-400 hover:text-zinc-700">
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
                  disabled={pendingAction === "purchase"}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pendingAction !== null}
                  aria-busy={pendingAction === "purchase"}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "purchase" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingAction === "purchase" ? "Mencatat Pembelian..." : "Simpan Transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Dialog Konfirmasi Hapus Branded Modern */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === "MATERIAL" ? "Hapus Master Material" : "Hapus Riwayat Harga Toko"}
        description={
          deleteTarget?.type === "MATERIAL"
            ? "Apakah Anda yakin ingin menghapus material ini dari katalog master? Tindakan ini tidak dapat dibatalkan."
            : "Apakah Anda yakin ingin menghapus catatan harga toko ini dari histori survei?"
        }
        itemName={deleteTarget?.name}
        confirmLabel="Hapus"
        deletingLabel="Menghapus..."
        cancelLabel="Batal"
        isDeleting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            setIsDeleting(true);
            if (deleteTarget.type === "MATERIAL") {
              setMaterials((prev) => prev.filter((m) => m.id !== deleteTarget.id));
              if (selectedMaterialId === deleteTarget.id) setSelectedMaterialId("ALL");
              await deleteMasterMaterial(deleteTarget.id);
              setSuccessMsg(`Material "${deleteTarget.name}" berhasil dihapus.`);
            } else {
              setHistory((prev) => prev.filter((h) => h.id !== deleteTarget.id));
              await deleteMaterialPriceHistory(deleteTarget.id);
              setSuccessMsg(`Catatan harga dari "${deleteTarget.name}" berhasil dihapus.`);
            }
            setDeleteTarget(null);
            fetchData();
          } catch (err: any) {
            setError(err?.message || "Gagal menghapus data.");
            fetchData();
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
}
