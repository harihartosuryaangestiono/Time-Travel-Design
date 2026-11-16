"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
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
} from "lucide-react";
import {
  getLaborRates,
  createLaborRate,
  updateLaborRate,
  deleteLaborRate,
  LaborRateItem,
} from "@/app/actions/cost-control/laborActions";
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

export default function LaborRatesPage() {
  const [rates, setRates] = useState<LaborRateItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [paymentSystemFilter, setPaymentSystemFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRateItem | null>(null);

  const [form, setForm] = useState({
    job_code: "",
    job_name: "",
    category: "Pekerjaan Lantai & Dinding",
    description: "",
    specifications: "",
    unit: "m²",
    payment_system: "BORONGAN" as "BORONGAN" | "UPAH_KETENG" | "HARIAN",
    standard_rate: 75000,
    min_rate: 70000,
    max_rate: 85000,
    source: "Standar Perusahaan",
    effective_date: new Date().toISOString().slice(0, 10),
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [rateList, projList] = await Promise.all([
        getLaborRates(),
        getProjects(),
      ]);
      setRates(rateList);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
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

  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      const matchCat = categoryFilter === "ALL" || r.category === categoryFilter;
      const matchSys = paymentSystemFilter === "ALL" || r.payment_system === paymentSystemFilter;
      const matchSearch =
        !searchQuery.trim() ||
        r.job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.job_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.specifications || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSys && matchSearch;
    });
  }, [rates, categoryFilter, paymentSystemFilter, searchQuery]);

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
      standard_rate: 75000,
      min_rate: 70000,
      max_rate: 85000,
      source: "Standar Perusahaan",
      effective_date: new Date().toISOString().slice(0, 10),
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (rate: LaborRateItem) => {
    setEditingRate(rate);
    setForm({
      job_code: rate.job_code,
      job_name: rate.job_name,
      category: rate.category,
      description: rate.description || "",
      specifications: rate.specifications || "",
      unit: rate.unit,
      payment_system: rate.payment_system,
      standard_rate: rate.standard_rate,
      min_rate: rate.min_rate,
      max_rate: rate.max_rate,
      source: rate.source || "Standar Perusahaan",
      effective_date: rate.effective_date ? rate.effective_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!form.job_code.trim()) throw new Error("Kode pekerjaan wajib diisi.");
      if (!form.job_name.trim()) throw new Error("Nama pekerjaan wajib diisi.");

      if (editingRate) {
        await updateLaborRate(editingRate.id, form);
        setSuccessMsg("Item upah berhasil diperbarui.");
      } else {
        await createLaborRate(form);
        setSuccessMsg("Item upah baru berhasil ditambahkan.");
      }
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan item upah.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus tarif standar untuk pekerjaan "${name}"?`)) return;
    try {
      await deleteLaborRate(id);
      setSuccessMsg("Item tarif berhasil dihapus.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus tarif.");
    }
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
            Katalog referensi tarif borongan, borongan keteng, dan rentang harga pekerjaan konstruksi.
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
          subtitle="Standar harga aktif perusahaan"
          icon={Layers}
        />
        <StatCard
          title="Pekerjaan Borongan Penuh"
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
        <StatCard
          title="Kategori Pekerjaan"
          value={`${categories.length} Divisi`}
          subtitle="Lantai, dinding, plafon, MEP, dll."
          icon={Building2}
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

          <div className="relative w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari kode/pekerjaan..."
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
                <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Harga Standar</th>
                <th className="px-4 py-3.5 text-right">Rentang (Min - Max)</th>
                <th className="px-4 py-3.5">Spesifikasi / Sumber</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    Tidak ada data tarif pekerjaan yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredRates.map((item) => (
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
                    <td className="px-4 py-3 text-right font-bold text-zinc-950">
                      {formatCurrency(item.standard_rate)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {formatCurrency(item.min_rate)} - {formatCurrency(item.max_rate)}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-zinc-500">
                      {item.specifications || item.source || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktif
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Tarif"
                          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.job_name)}
                          title="Hapus Tarif"
                          className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* MODAL: TAMBAH / EDIT TARIF UPAH */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">
                {editingRate ? "Edit Tarif Upah Standar" : "Tambah Standar Tarif Upah Baru"}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Kode Pekerjaan</label>
                  <input
                    type="text"
                    value={form.job_code}
                    onChange={(e) => setForm({ ...form, job_code: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 uppercase font-mono outline-none focus:border-zinc-400"
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
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Pekerjaan</label>
                <input
                  type="text"
                  placeholder="Contoh: Pasang Keramik 60x60 Homogeneous"
                  value={form.job_name}
                  onChange={(e) => setForm({ ...form, job_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

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
                    placeholder="m², titik, m¹, dll."
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Harga Standar (Rp)</label>
                  <input
                    type="number"
                    value={form.standard_rate}
                    onChange={(e) => setForm({ ...form, standard_rate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-semibold outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Harga Min (Rp)</label>
                  <input
                    type="number"
                    value={form.min_rate}
                    onChange={(e) => setForm({ ...form, min_rate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Harga Max (Rp)</label>
                  <input
                    type="number"
                    value={form.max_rate}
                    onChange={(e) => setForm({ ...form, max_rate: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Spesifikasi Teknis / Keterangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Nat semen warna rapi, permukaan rata level air"
                  value={form.specifications}
                  onChange={(e) => setForm({ ...form, specifications: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  {editingRate ? "Perbarui Tarif" : "Simpan Standar Tarif"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
