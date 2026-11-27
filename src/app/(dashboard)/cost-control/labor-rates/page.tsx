"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Hammer,
  Plus,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  HardHat,
  X,
  Building2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Edit2,
  Trash2,
  Users,
  Info,
  Check,
  Loader2,
} from "lucide-react";
import {
  getLaborRates,
  createLaborRate,
  updateLaborRate,
  deleteLaborRate,
  addMandorToLaborRate,
  deleteMandorFromLaborRate,
  LaborRateItem,
  MandorRateItem,
} from "@/app/actions/cost-control/laborActions";
import { getSubcontractors } from "@/app/actions/subcontractorActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function LaborRatesPage() {
  const [rates, setRates] = useState<LaborRateItem[]>([]);
  const [subcontractors, setSubcontractors] = useState<Array<{ id: string; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [paymentSystemFilter, setPaymentSystemFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "LABOR_RATE" | "MANDOR";
    id: string;
    secondaryId?: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMandor, setIsSavingMandor] = useState(false);

  // Quick Add Mandor Modal
  const [showQuickAddMandorModal, setShowQuickAddMandorModal] = useState(false);
  const [quickTargetRate, setQuickTargetRate] = useState<LaborRateItem | null>(null);
  const [quickMandorForm, setQuickMandorForm] = useState({
    mandor_name: "",
    rate: 0,
    notes: "",
  });

  // Main Form
  const [form, setForm] = useState({
    job_code: "",
    job_name: "",
    category: "Pekerjaan Lantai & Dinding",
    description: "",
    specifications: "",
    unit: "m²",
    payment_system: "BORONGAN" as "BORONGAN" | "UPAH_KETENG" | "HARIAN",
    source: "Referensi Mandor",
    effective_date: new Date().toISOString().slice(0, 10),
    mandors: [
      { mandor_name: "", rate: 0, notes: "" },
    ] as Array<{ id?: string; mandor_name: string; rate: number; notes?: string }>,
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [rateList, subconRes] = await Promise.all([
        getLaborRates(),
        getSubcontractors().catch(() => ({ subcontractors: [] })),
      ]);
      setRates(rateList);
      setSubcontractors(subconRes?.subcontractors || []);
    } catch (err: any) {
      console.error("Gagal memuat database harga upah:", err);
      setError(err?.message || "Gagal memuat standar tarif upah.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rates.forEach((r) => set.add(r.category));
    return Array.from(set);
  }, [rates]);

  const totalMandorReferences = useMemo(() => {
    return rates.reduce((acc, curr) => acc + (curr.mandor_rates?.length || 0), 0);
  }, [rates]);

  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      const matchCat = categoryFilter === "ALL" || r.category === categoryFilter;
      const matchSys = paymentSystemFilter === "ALL" || r.payment_system === paymentSystemFilter;
      const matchSearch =
        !searchQuery.trim() ||
        r.job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.job_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.specifications || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.mandor_rates?.some((m) => m.mandor_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSys && matchSearch;
    });
  }, [rates, categoryFilter, paymentSystemFilter, searchQuery]);

  // Live calculation inside Add/Edit modal
  const liveStats = useMemo(() => {
    const valid = form.mandors.filter(
      (m) => m.mandor_name.trim() && Number.isFinite(m.rate) && m.rate > 0
    );
    if (valid.length === 0) {
      return { minRate: 0, maxRate: 0, avgRate: 0, minMandor: "-", maxMandor: "-", count: 0 };
    }
    const sorted = [...valid].sort((a, b) => a.rate - b.rate);
    const minRate = sorted[0].rate;
    const maxRate = sorted[sorted.length - 1].rate;
    const avgRate = Math.round(sorted.reduce((acc, curr) => acc + curr.rate, 0) / sorted.length);
    return {
      minRate,
      maxRate,
      avgRate,
      minMandor: sorted[0].mandor_name,
      maxMandor: sorted[sorted.length - 1].mandor_name,
      count: valid.length,
    };
  }, [form.mandors]);

  // Handlers for Add/Edit Form
  const handleOpenAdd = () => {
    setEditingRate(null);
    setForm({
      job_code: `UPH-${Math.floor(100 + Math.random() * 900)}`,
      job_name: "",
      category: "Pekerjaan Lantai & Dinding",
      description: "",
      specifications: "",
      unit: "m²",
      payment_system: "BORONGAN",
      source: "Referensi Mandor",
      effective_date: new Date().toISOString().slice(0, 10),
      mandors: [
        { mandor_name: "", rate: 0, notes: "" },
      ],
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (rate: LaborRateItem) => {
    setEditingRate(rate);
    const existingMandors =
      rate.mandor_rates && rate.mandor_rates.length > 0
        ? rate.mandor_rates.map((m) => ({
            id: m.id,
            mandor_name: m.mandor_name,
            rate: m.rate,
            notes: m.notes || "",
          }))
        : [{ mandor_name: rate.source || "Mandor Utama", rate: rate.standard_rate, notes: "" }];

    setForm({
      job_code: rate.job_code,
      job_name: rate.job_name,
      category: rate.category,
      description: rate.description || "",
      specifications: rate.specifications || "",
      unit: rate.unit,
      payment_system: rate.payment_system,
      source: rate.source || "Referensi Mandor",
      effective_date: rate.effective_date ? rate.effective_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      mandors: existingMandors,
    });
    setShowAddModal(true);
  };

  const handleAddMandorRow = () => {
    setForm({
      ...form,
      mandors: [...form.mandors, { mandor_name: "", rate: 0, notes: "" }],
    });
  };

  const handleRemoveMandorRow = (index: number) => {
    if (form.mandors.length <= 1) return;
    const next = [...form.mandors];
    next.splice(index, 1);
    setForm({ ...form, mandors: next });
  };

  const handleMandorRowChange = (index: number, field: string, value: any) => {
    const next = [...form.mandors];
    next[index] = { ...next[index], [field]: value };
    setForm({ ...form, mandors: next });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    try {
      setIsSaving(true);
      if (!form.job_code.trim()) throw new Error("Kode pekerjaan wajib diisi.");
      if (!form.job_name.trim()) throw new Error("Nama pekerjaan wajib diisi.");

      const validMandors = form.mandors.filter(
        (m) => m.mandor_name.trim() && Number.isFinite(m.rate) && m.rate > 0
      );

      if (validMandors.length === 0) {
        throw new Error("Wajib mengisi minimal 1 nama mandor beserta tarif upahnya.");
      }

      if (editingRate) {
        await updateLaborRate(editingRate.id, {
          job_code: form.job_code,
          job_name: form.job_name,
          category: form.category,
          description: form.description,
          specifications: form.specifications,
          unit: form.unit,
          payment_system: form.payment_system,
          source: form.source,
          effective_date: form.effective_date,
          mandors: validMandors,
        });
        setSuccessMsg("Item upah dan referensi tarif mandor berhasil diperbarui.");
      } else {
        await createLaborRate({
          job_code: form.job_code,
          job_name: form.job_name,
          category: form.category,
          description: form.description,
          specifications: form.specifications,
          unit: form.unit,
          payment_system: form.payment_system,
          source: form.source,
          effective_date: form.effective_date,
          mandors: validMandors,
        });
        setSuccessMsg("Item upah baru dan tarif mandor berhasil ditambahkan.");
      }
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan item upah.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ type: "LABOR_RATE", id, name });
  };

  // Quick Add Mandor Handlers
  const handleOpenQuickAddMandor = (rate: LaborRateItem) => {
    setQuickTargetRate(rate);
    setQuickMandorForm({
      mandor_name: "",
      rate: rate.standard_rate || 0,
      notes: "",
    });
    setShowQuickAddMandorModal(true);
  };

  const handleQuickAddMandorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTargetRate || isSavingMandor) return;
    try {
      setIsSavingMandor(true);
      if (!quickMandorForm.mandor_name.trim()) throw new Error("Nama mandor wajib diisi.");
      if (!quickMandorForm.rate || quickMandorForm.rate <= 0) throw new Error("Tarif upah harus lebih dari 0.");

      await addMandorToLaborRate({
        labor_rate_id: quickTargetRate.id,
        mandor_name: quickMandorForm.mandor_name,
        rate: quickMandorForm.rate,
        notes: quickMandorForm.notes,
      });

      setSuccessMsg(`Tarif mandor ${quickMandorForm.mandor_name} berhasil ditambahkan ke ${quickTargetRate.job_name}.`);
      setShowQuickAddMandorModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menambah tarif mandor.");
    } finally {
      setIsSavingMandor(false);
    }
  };

  const handleDeleteMandor = (mandorRateId: string, laborRateId: string, mandorName: string) => {
    setDeleteTarget({ type: "MANDOR", id: mandorRateId, secondaryId: laborRateId, name: mandorName });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            <Hammer className="h-3.5 w-3.5" />
            Standar Harga Tenaga Kerja
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Database Harga Upah Tukang
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Katalog referensi tarif pekerjaan konstruksi dengan rentang harga dinamis yang dihitung otomatis dari penawaran mandor.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Tambah Item Upah Baru
        </button>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Item Pekerjaan"
          value={`${rates.length} Jenis`}
          subtitle="Item pekerjaan aktif perusahaan"
          icon={Layers}
        />
        <StatCard
          title="Referensi Tarif Mandor"
          value={`${totalMandorReferences} Penawaran`}
          subtitle="Total catatan tarif dari para mandor"
          icon={Users}
        />
        <StatCard
          title="Borongan Penuh"
          value={`${rates.filter((r) => r.payment_system === "BORONGAN").length} Item`}
          subtitle="Sistem pembayaran borongan hasil"
          icon={Hammer}
        />
        <StatCard
          title="Borongan Upah Keteng"
          value={`${rates.filter((r) => r.payment_system === "UPAH_KETENG").length} Item`}
          subtitle="Upah terbagi per satuan unit kecil"
          icon={DollarSign}
        />
      </div>

      {/* Filter Bar */}
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

        <div className="flex items-center gap-2">
          <select
            value={paymentSystemFilter}
            onChange={(e) => setPaymentSystemFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none cursor-pointer"
          >
            <option value="ALL">Semua Sistem Pembayaran</option>
            <option value="BORONGAN">Borongan</option>
            <option value="UPAH_KETENG">Borongan Upah Keteng</option>
            <option value="HARIAN">Harian</option>
          </select>

          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari pekerjaan atau mandor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Main Rates Table */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Kode & Pekerjaan</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th className="px-4 py-3.5">Sistem</th>
                <th className="px-4 py-3.5">Satuan</th>
                <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Ringkasan Rentang (Otomatis)</th>
                <th className="px-4 py-3.5">Daftar Penawaran Mandor</th>
                <th className="px-4 py-3.5">Spesifikasi</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    Tidak ada data tarif pekerjaan yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredRates.map((item) => {
                  const hasMandors = item.mandor_rates && item.mandor_rates.length > 0;
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        <div>{item.job_name}</div>
                        <div className="text-[10px] font-mono text-zinc-400">{item.job_code}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{item.category}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{item.payment_system}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{item.unit}</td>

                      {/* Rentang Otomatis */}
                      <td className="px-4 py-3 text-right">
                        {item.min_rate === item.max_rate ? (
                          <div className="font-bold text-zinc-950">
                            {formatCurrency(item.standard_rate)}
                            <span className="text-[10px] text-zinc-500 font-normal"> /{item.unit}</span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-zinc-950">
                              {formatCurrency(item.min_rate)} s.d {formatCurrency(item.max_rate)}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Rata-rata: {formatCurrency(item.standard_rate)} /{item.unit}
                            </div>
                          </div>
                        )}
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-blue-700 font-medium">
                          <Users className="h-2.5 w-2.5" />
                          {hasMandors ? `${item.mandor_rates.length} Mandor` : "1 Standar"}
                        </div>
                      </td>

                      {/* Rincian Mandor */}
                      <td className="px-4 py-3 max-w-sm">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {hasMandors ? (
                            item.mandor_rates.map((mr) => (
                              <span
                                key={mr.id}
                                className="group relative inline-flex items-center gap-1 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-800 transition"
                              >
                                <HardHat className="h-3 w-3 text-zinc-500" />
                                <span className="font-semibold text-zinc-950">{mr.mandor_name}</span>:
                                <span className="text-zinc-700 font-mono font-bold">
                                  {formatCurrency(mr.rate)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMandor(mr.id, item.id, mr.mandor_name)}
                                  title={`Hapus ${mr.mandor_name}`}
                                  className="ml-0.5 text-zinc-400 hover:text-red-600 transition"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">Belum ada rincian mandor</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenQuickAddMandor(item)}
                            title="Tambah penawaran mandor baru untuk pekerjaan ini"
                            className="inline-flex items-center gap-0.5 rounded-lg border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:border-blue-500 hover:bg-blue-50/50 transition"
                          >
                            <Plus className="h-2.5 w-2.5" /> Mandor
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 max-w-xs truncate text-zinc-500">
                        {item.specifications || "-"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenQuickAddMandor(item)}
                            title="Tambah Mandor"
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Item Upah"
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.job_name)}
                            title="Hapus Item"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: TAMBAH / EDIT ITEM PEKERJAAN DENGAN MULTI-MANDOR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  {editingRate ? "Edit Standar Tarif Upah & Mandor" : "Tambah Standar Tarif Upah Baru"}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Masukkan data pekerjaan dan tarif dari masing-masing mandor. Rentang harga akan dihitung otomatis.
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} disabled={isSaving} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              {/* Row 1: Kode & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kode Pekerjaan</label>
                  <input
                    type="text"
                    value={form.job_code}
                    onChange={(e) => setForm({ ...form, job_code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 uppercase font-mono outline-none focus:border-zinc-400"
                    placeholder="Contoh: UPH-102"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kategori Pekerjaan</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    placeholder="Contoh: Pekerjaan Lantai & Dinding"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Nama Pekerjaan */}
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Pekerjaan</label>
                <input
                  type="text"
                  placeholder="Contoh: Bongkar Keramik, Pasang Keramik 60x60, Pengecatan Dinding"
                  value={form.job_name}
                  onChange={(e) => setForm({ ...form, job_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 font-medium"
                  required
                />
              </div>

              {/* Row 3: Sistem Pembayaran & Satuan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Sistem Pembayaran</label>
                  <select
                    value={form.payment_system}
                    onChange={(e: any) => setForm({ ...form, payment_system: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  >
                    <option value="BORONGAN">Borongan Penuh</option>
                    <option value="UPAH_KETENG">Borongan Upah Keteng</option>
                    <option value="HARIAN">Harian</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Satuan Pekerjaan</label>
                  <input
                    type="text"
                    placeholder="m², titik, m¹, ls, dll."
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              {/* BAGIAN PENENTU HARGA: DAFTAR MANDOR */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-950">
                      <Users className="h-4 w-4 text-blue-600" />
                      Penawaran Tarif per Mandor (Penentu Rentang Harga)
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Masukkan nama mandor dan tarifnya. Range harga dan rata-rata akan dihitung otomatis oleh sistem.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMandorRow}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Mandor
                  </button>
                </div>

                {/* Datalist for subcontractor suggestions */}
                <datalist id="subcontractor-list">
                  {subcontractors.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>

                {/* Mandor Rows */}
                <div className="space-y-2 mt-2">
                  {form.mandors.map((row, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-zinc-200/80 shadow-xs">
                      <div className="w-48 shrink-0">
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase">Nama Mandor</label>
                        <input
                          type="text"
                          list="subcontractor-list"
                          placeholder="Misal: Rian, Edi, Rosidin"
                          value={row.mandor_name}
                          onChange={(e) => handleMandorRowChange(index, "mandor_name", e.target.value)}
                          className="w-full mt-0.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 font-semibold"
                          required
                        />
                      </div>

                      <div className="w-44 shrink-0">
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase">
                          Tarif Upah (Rp / {form.unit || "unit"})
                        </label>
                        <input
                          type="number"
                          placeholder="25000"
                          value={row.rate || ""}
                          onChange={(e) => handleMandorRowChange(index, "rate", Number(e.target.value))}
                          className="w-full mt-0.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 font-bold"
                          required
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase">Catatan / Keterangan (Opsional)</label>
                        <input
                          type="text"
                          placeholder="Contoh: Termasuk buang puing"
                          value={row.notes || ""}
                          onChange={(e) => handleMandorRowChange(index, "notes", e.target.value)}
                          className="w-full mt-0.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400"
                        />
                      </div>

                      {form.mandors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMandorRow(index)}
                          title="Hapus baris mandor"
                          className="mt-3.5 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* LIVE AUTOMATIC CALCULATION SUMMARY */}
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                    <Check className="h-4 w-4 text-blue-600" />
                    Ringkasan Otomatis Rentang Harga Upah:
                  </div>

                  {liveStats.count > 0 ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                        <span className="text-[10px] text-zinc-500 font-medium">Rentang Harga (Min - Max):</span>
                        <div className="font-bold text-blue-900 text-sm">
                          {liveStats.minRate === liveStats.maxRate
                            ? `${formatCurrency(liveStats.minRate)} / ${form.unit || "unit"}`
                            : `${formatCurrency(liveStats.minRate)} s.d ${formatCurrency(liveStats.maxRate)}`}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {liveStats.count} Mandor Terdaftar
                        </div>
                      </div>

                      <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                        <span className="text-[10px] text-zinc-500 font-medium">Rata-rata Acuan Standar:</span>
                        <div className="font-bold text-emerald-800 text-sm">
                          {formatCurrency(liveStats.avgRate)} / {form.unit || "unit"}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Dasar perhitungan acuan HPP
                        </div>
                      </div>

                      <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                        <span className="text-[10px] text-zinc-500 font-medium">Perbandingan Mandor:</span>
                        <div className="text-[11px] font-semibold text-zinc-800 truncate">
                          Termurah: <span className="text-emerald-700">{liveStats.minMandor}</span> ({formatCurrency(liveStats.minRate)})
                        </div>
                        <div className="text-[11px] font-semibold text-zinc-800 truncate">
                          Termahal: <span className="text-red-700">{liveStats.maxMandor}</span> ({formatCurrency(liveStats.maxRate)})
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-blue-700/80 italic">
                      Masukkan nama mandor dan tarif upah di atas untuk melihat kalkulasi rentang harga otomatis.
                    </p>
                  )}
                </div>
              </div>

              {/* Spesifikasi Tambahan */}
              <div>
                <label className="text-xs font-semibold text-zinc-700">Spesifikasi Teknis / Keterangan Pekerjaan</label>
                <input
                  type="text"
                  placeholder="Contoh: Nat semen warna rapi, permukaan rata level air"
                  value={form.specifications}
                  onChange={(e) => setForm({ ...form, specifications: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  aria-busy={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSaving ? "Menyimpan Tarif..." : editingRate ? "Simpan Perubahan Tarif" : "Simpan Standar Tarif"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK ADD MANDOR KE ITEM PEKERJAAN EXISTNG */}
      {showQuickAddMandorModal && quickTargetRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  Tambah Penawaran Mandor
                </h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  {quickTargetRate.job_name} ({quickTargetRate.unit})
                </p>
              </div>
              <button
                onClick={() => setShowQuickAddMandorModal(false)}
                disabled={isSavingMandor}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddMandorSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Mandor / Tukang</label>
                <input
                  type="text"
                  list="subcontractor-list"
                  placeholder="Contoh: Rian, Edi, Rosidin"
                  value={quickMandorForm.mandor_name}
                  onChange={(e) =>
                    setQuickMandorForm({ ...quickMandorForm, mandor_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">
                  Tarif Upah (Rp / {quickTargetRate.unit})
                </label>
                <input
                  type="number"
                  placeholder="25000"
                  value={quickMandorForm.rate || ""}
                  onChange={(e) =>
                    setQuickMandorForm({ ...quickMandorForm, rate: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan / Spesifikasi Khusus Mandor</label>
                <input
                  type="text"
                  placeholder="Contoh: Ongkos alat sudah termasuk"
                  value={quickMandorForm.notes}
                  onChange={(e) =>
                    setQuickMandorForm({ ...quickMandorForm, notes: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              {/* Informative Preview */}
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600">
                <span className="font-semibold text-zinc-900">Efek Rentang Harga:</span>
                <div className="mt-1 text-[11px]">
                  Saat ini: {formatCurrency(quickTargetRate.min_rate)} s.d {formatCurrency(quickTargetRate.max_rate)} (
                  {quickTargetRate.mandor_rates?.length || 1} Mandor).
                </div>
                {quickMandorForm.rate > 0 && (
                  <div className="mt-1 text-[11px] font-semibold text-blue-800">
                    Setelah ditambah: {formatCurrency(Math.min(quickTargetRate.min_rate, quickMandorForm.rate))} s.d{" "}
                    {formatCurrency(Math.max(quickTargetRate.max_rate, quickMandorForm.rate))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuickAddMandorModal(false)}
                  disabled={isSavingMandor}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingMandor}
                  aria-busy={isSavingMandor}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingMandor && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSavingMandor ? "Menyimpan Tarif..." : "Simpan Tarif Mandor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Dialog Konfirmasi Hapus Branded Modern */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === "LABOR_RATE" ? "Hapus Master Tarif Upah" : "Hapus Referensi Mandor"}
        description={
          deleteTarget?.type === "LABOR_RATE"
            ? `Apakah Anda yakin ingin menonaktifkan master tarif pekerjaan ini?`
            : `Apakah Anda yakin ingin menghapus referensi tarif mandor ini dari pekerjaan?`
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
            if (deleteTarget.type === "LABOR_RATE") {
              await deleteLaborRate(deleteTarget.id);
              setSuccessMsg(`Item tarif "${deleteTarget.name}" berhasil dinonaktifkan.`);
            } else if (deleteTarget.secondaryId) {
              await deleteMandorFromLaborRate(deleteTarget.id, deleteTarget.secondaryId);
              setSuccessMsg(`Tarif mandor ${deleteTarget.name} berhasil dihapus.`);
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
