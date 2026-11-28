"use client";

import { useEffect, useState, useCallback, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Plus,
  RefreshCw,
  FolderKanban,
  FileSpreadsheet,
  Lock,
  ChevronRight,
  X,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Loader2,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  getRabProjects,
  createRabProject,
  getRabManagementPermissions,
  updateRabProject,
  deleteRabProject,
  RabProjectItem,
} from "@/app/actions/cost-control/rabActions";
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

function formatDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function RabProjectsListPage() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [rabList, setRabList] = useState<RabProjectItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string; location?: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [openingRabId, setOpeningRabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [canEditRabs, setCanEditRabs] = useState(false);
  const [canDeleteRabs, setCanDeleteRabs] = useState(false);
  const [editingRab, setEditingRab] = useState<RabProjectItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingRabId, setDeletingRabId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    client_name: "",
    project_location: "",
    date: "",
    notes: "",
  });

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    project_id: "",
    title: "",
    client_name: "",
    project_location: "",
    profit_type: "MARKUP" as "MARKUP" | "GROSS_MARGIN",
    profit_percentage: 20,
    overhead_percentage: 5,
    contingency_percentage: 0,
    tax_percentage: 0,
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [rabs, projList, permissions] = await Promise.all([
        getRabProjects(selectedProjectId === "ALL" ? undefined : selectedProjectId),
        getProjects(),
        getRabManagementPermissions(),
      ]);
      setRabList(rabs);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code, location: p.location })));
      setCanEditRabs(permissions.canEdit);
      setCanDeleteRabs(permissions.canDelete);
      if (projList && projList.length > 0) {
        setCreateForm((prev) => prev.project_id ? prev : ({
          ...prev,
          project_id: projList[0].id,
          title: `RAB Penawaran - ${projList[0].name}`,
          project_location: projList[0].location || "Jakarta",
        }));
      }
    } catch (err: any) {
      console.error("Gagal memuat daftar RAB:", err);
      setError(err?.message || "Gagal memuat data RAB.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRabs = useMemo(() => {
    return rabList.filter((r) => {
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      const matchSearch =
        !searchQuery.trim() ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.rab_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.project?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [rabList, statusFilter, searchQuery]);

  const totalGrandTotal = useMemo(() => rabList.reduce((sum, r) => sum + r.grand_total, 0), [rabList]);
  const approvedRabsCount = useMemo(() => rabList.filter((r) => r.status === "APPROVED").length, [rabList]);
  const isCreatePending = isCreating || isNavigating;

  const handleCreateRab = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!createForm.project_id) throw new Error("Pilih proyek terlebih dahulu.");
      if (!createForm.title.trim()) throw new Error("Judul RAB wajib diisi.");

      setIsCreating(true);
      setError(null);
      const result = await createRabProject(createForm);
      if (!result.success) {
        setError(`${result.message} (Kode: ${result.diagnostic})`);
        return;
      }
      if (!result.rab?.id) throw new Error("RAB berhasil diproses tetapi ID dokumen tidak ditemukan.");
      startNavigation(() => router.push(`/cost-control/rab/${result.rab.id}`));
    } catch (err: any) {
      setError(err?.message || "Gagal membuat RAB.");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (rab: RabProjectItem) => {
    setEditingRab(rab);
    setEditForm({
      title: rab.title,
      client_name: rab.client_name || "",
      project_location: rab.project_location || "",
      date: formatDateInput(rab.date),
      notes: rab.notes || "",
    });
  };

  const handleUpdateRab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRab) return;
    try {
      if (!editForm.title.trim()) throw new Error("Judul RAB wajib diisi.");
      if (!editForm.date) throw new Error("Tanggal RAB wajib diisi.");
      setIsSavingEdit(true);
      setError(null);
      await updateRabProject({
        rab_id: editingRab.id,
        ...editForm,
        date: new Date(`${editForm.date}T00:00:00+07:00`).toISOString(),
      });
      setEditingRab(null);
      setSuccessMsg("Informasi RAB berhasil diperbarui.");
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal memperbarui RAB.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteRab = async (rab: RabProjectItem) => {
    const linkedRapWarning = rab.status === "APPROVED" || rab.is_locked
      ? " RAP yang menggunakan RAB ini akan tetap ada, tetapi tautan ke RAB dan item sumbernya akan terputus."
      : "";
    if (!confirm(`Hapus RAB "${rab.title}"? Semua item dan rincian AHSP di dalam dokumen ini juga akan dihapus.${linkedRapWarning} Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      setDeletingRabId(rab.id);
      setError(null);
      await deleteRabProject(rab.id);
      setSuccessMsg(`RAB "${rab.title}" berhasil dihapus.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus RAB.");
    } finally {
      setDeletingRabId(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <Calculator className="h-3.5 w-3.5" />
            Rencana Anggaran Biaya & Estimasi Penawaran Klien
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            RAB (Rencana Anggaran Biaya)
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Penyusunan anggaran biaya konstruksi berbasis AHSP, penetapan margin Owner, dan manajemen versi penawaran.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Buat RAB Baru
        </button>
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
          title="Total Nilai Penawaran RAB"
          value={formatCurrency(totalGrandTotal)}
          subtitle={`${rabList.length} dokumen RAB aktif`}
          icon={Calculator}
        />
        <StatCard
          title="RAB Disetujui (Approved)"
          value={`${approvedRabsCount} Dokumen`}
          subtitle="Terkunci & menjadi acuan RAP"
          icon={Lock}
        />
        <StatCard
          title="Draft / Dalam Pembahasan"
          value={`${rabList.filter((r) => r.status === "DRAFT").length} Dokumen`}
          subtitle="Tahap simulasi margin & koefisien"
          icon={Clock}
        />
        <StatCard
          title="Rata-Rata Margin Keuntungan"
          value="20.0%"
          subtitle="Konfigurasi standar Owner"
          icon={TrendingUp}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs">
            <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            {["ALL", "DRAFT", "APPROVED", "REVISED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === st
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {st === "ALL" ? "Semua Status" : st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nomor atau judul RAB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* RAB Table List */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nomor & Versi</th>
                <th className="px-4 py-3.5">Judul RAB & Proyek</th>
                <th className="px-4 py-3.5">Tanggal</th>
                <th className="px-4 py-3.5 text-right font-medium text-zinc-700">Total HPP Modal</th>
                <th className="px-4 py-3.5 text-right">Margin Owner</th>
                <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Harga Penawaran</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat daftar RAB...
                    </span>
                  </td>
                </tr>
              ) : filteredRabs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    Belum ada dokumen RAB yang dibuat. Klik &quot;Buat RAB Baru&quot; untuk memulai.
                  </td>
                </tr>
              ) : (
                filteredRabs.map((rab) => (
                  <tr key={rab.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-4 py-3 font-semibold text-zinc-950">
                      <div className="flex items-center gap-1.5">
                        {rab.is_locked && <Lock className="h-3 w-3 text-zinc-400" />}
                        <span>{rab.rab_number}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">Versi {rab.version}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{rab.title}</div>
                      <div className="text-[10px] text-zinc-500">
                        {rab.project?.code} • {rab.project?.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(rab.date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-800">
                      {formatCurrency(rab.total_hpp)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-800">
                        {rab.profit_type === "MARKUP" ? "Markup" : "Margin"} {rab.profit_percentage}%
                      </span>
                      <div className="text-[10px] text-zinc-400">+{formatCurrency(rab.profit_amount)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-950">
                      {formatCurrency(rab.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          rab.status === "APPROVED"
                            ? "success"
                            : rab.status === "SUBMITTED"
                            ? "info"
                            : rab.status === "REVISED"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {rab.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEditRabs && rab.status !== "APPROVED" && !rab.is_locked && (
                          <button
                            type="button"
                            onClick={() => openEditModal(rab)}
                            title="Edit informasi RAB"
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>
                        )}
                        {canDeleteRabs && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRab(rab)}
                            disabled={deletingRabId !== null}
                            title="Hapus RAB"
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingRabId === rab.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Hapus
                          </button>
                        )}
                        <Link
                          href={`/cost-control/rab/${rab.id}`}
                          onClick={() => setOpeningRabId(rab.id)}
                          aria-busy={openingRabId === rab.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black transition shadow-xs"
                        >
                          {openingRabId === rab.id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Membuka...
                            </>
                          ) : (
                            <>
                              Buka Worksheet <ArrowRight className="h-3 w-3" />
                            </>
                          )}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: BUAT RAB BARU */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Buat RAB Proyek Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreatePending}
                className="text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRab} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Proyek Terkait</label>
                <select
                  value={createForm.project_id}
                  onChange={(e) => {
                    const p = projects.find((proj) => proj.id === e.target.value);
                    setCreateForm({
                      ...createForm,
                      project_id: e.target.value,
                      title: p ? `RAB Penawaran - ${p.name}` : createForm.title,
                      project_location: p?.location || "",
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} • {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Judul Dokumen RAB</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Contoh: RAB Penawaran Pekerjaan Interior & Sipil"
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Nama Klien / Pemilik</label>
                  <input
                    type="text"
                    value={createForm.client_name}
                    onChange={(e) => setCreateForm({ ...createForm, client_name: e.target.value })}
                    placeholder="Contoh: PT Sumber Makmur"
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Lokasi Proyek</label>
                  <input
                    type="text"
                    value={createForm.project_location}
                    onChange={(e) => setCreateForm({ ...createForm, project_location: e.target.value })}
                    placeholder="Contoh: BSD City, Tangerang"
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200/90 bg-zinc-50 p-4 space-y-3">
                <span className="text-xs font-bold text-zinc-950">Konfigurasi Margin & Keuntungan Owner</span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600">Metode Keuntungan</label>
                    <select
                      value={createForm.profit_type}
                      onChange={(e: any) => setCreateForm({ ...createForm, profit_type: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none cursor-pointer font-semibold"
                    >
                      <option value="MARKUP">Markup terhadap Modal (HPP)</option>
                      <option value="GROSS_MARGIN">Gross Margin terhadap Jual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600">Persentase Profit (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={createForm.profit_percentage}
                      onChange={(e) => setCreateForm({ ...createForm, profit_percentage: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600">Overhead (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={createForm.overhead_percentage}
                      onChange={(e) => setCreateForm({ ...createForm, overhead_percentage: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600">Pajak PPN (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={createForm.tax_percentage}
                      onChange={(e) => setCreateForm({ ...createForm, tax_percentage: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatePending}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatePending}
                  aria-busy={isCreatePending}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreatePending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membuat RAB...
                    </>
                  ) : "Buka Lembar Kerja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingRab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Edit Informasi RAB</h3>
                <p className="mt-1 text-[11px] text-zinc-500">{editingRab.rab_number} • Versi {editingRab.version}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRab(null)}
                disabled={isSavingEdit}
                className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRab} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Judul RAB</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Nama Klien</label>
                  <input
                    type="text"
                    value={editForm.client_name}
                    onChange={(event) => setEditForm({ ...editForm, client_name: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tanggal RAB</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(event) => setEditForm({ ...editForm, date: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Lokasi Proyek</label>
                <input
                  type="text"
                  value={editForm.project_location}
                  onChange={(event) => setEditForm({ ...editForm, project_location: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingRab(null)}
                  disabled={isSavingEdit}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  aria-busy={isSavingEdit}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
