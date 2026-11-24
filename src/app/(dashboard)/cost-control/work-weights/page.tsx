"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Percent,
  Plus,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  Calendar,
  User,
  Sliders,
  DollarSign,
  AlertTriangle,
  Clock,
  ArrowRight,
  LineChart,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import {
  getProjectSchedules,
  createProjectSchedule,
  updateProjectSchedule,
  deleteProjectSchedule,
  recalculateProjectWeights,
  ProjectScheduleItem,
} from "@/app/actions/cost-control/scheduleActions";
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

export default function WorkWeightsPage() {
  const [schedules, setSchedules] = useState<ProjectScheduleItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectScheduleItem | null>(null);

  const [form, setForm] = useState({
    task_name: "",
    division: "Pekerjaan Struktural",
    budget_amount: 50000000,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    pic_name: "Site Coordinator",
    sort_order: 10,
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
        const data = await getProjectSchedules(activeId);
        setSchedules(data);
      }
    } catch (err: any) {
      console.error("Gagal memuat bobot pekerjaan:", err);
      setError(err?.message || "Gagal memuat jadwal dan bobot pekerjaan.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Total weight check
  const totalWeight = useMemo(() => {
    const sum = schedules.reduce((acc, s) => acc + s.weight_percentage, 0);
    return Math.round(sum * 100) / 100;
  }, [schedules]);

  const totalBudget = useMemo(() => {
    return schedules.reduce((acc, s) => acc + s.budget_amount, 0);
  }, [schedules]);

  const overallProgress = useMemo(() => {
    const sum = schedules.reduce((acc, s) => acc + ((s.current_actual_progress || 0) / 100) * s.weight_percentage, 0);
    return Math.round(sum * 10) / 10;
  }, [schedules]);

  // Group by division
  const divisionGroups = useMemo(() => {
    const map = new Map<string, ProjectScheduleItem[]>();
    schedules.forEach((s) => {
      const list = map.get(s.division) || [];
      list.push(s);
      map.set(s.division, list);
    });
    return Array.from(map.entries()).map(([division, items]) => {
      const divWeight = items.reduce((acc, it) => acc + it.weight_percentage, 0);
      const divBudget = items.reduce((acc, it) => acc + it.budget_amount, 0);
      const divProgress = items.reduce((acc, it) => acc + ((it.current_actual_progress || 0) / 100) * it.weight_percentage, 0);
      return { division, items, divWeight, divBudget, divProgress };
    });
  }, [schedules]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      task_name: "",
      division: "Pekerjaan Struktural",
      budget_amount: 50000000,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      pic_name: "Site Coordinator",
      sort_order: (schedules.length + 1) * 10,
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: ProjectScheduleItem) => {
    setEditingItem(item);
    setForm({
      task_name: item.task_name,
      division: item.division,
      budget_amount: item.budget_amount,
      start_date: item.start_date.slice(0, 10),
      end_date: item.end_date.slice(0, 10),
      pic_name: item.pic_name || "",
      sort_order: item.sort_order,
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedProjectId) throw new Error("Pilih proyek terlebih dahulu.");
      if (!form.task_name.trim()) throw new Error("Nama pekerjaan wajib diisi.");

      if (editingItem) {
        await updateProjectSchedule(editingItem.id, selectedProjectId, form);
        setSuccessMsg("Jadwal pekerjaan berhasil diperbarui.");
      } else {
        await createProjectSchedule({
          project_id: selectedProjectId,
          ...form,
        });
        setSuccessMsg("Jadwal pekerjaan baru berhasil ditambahkan.");
      }
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan jadwal pekerjaan.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus jadwal pekerjaan ini? Bobot proyek akan dihitung ulang secara otomatis.")) return;
    try {
      await deleteProjectSchedule(id, selectedProjectId);
      setSuccessMsg("Pekerjaan berhasil dihapus dan bobot telah dihitung ulang.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus.");
    }
  };

  const handleRecalculate = async () => {
    try {
      await recalculateProjectWeights(selectedProjectId);
      setSuccessMsg("Bobot seluruh pekerjaan berhasil dinormalisasi menjadi tepat 100%.");
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menghitung bobot.");
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <Percent className="h-3.5 w-3.5" />
            Distribusi Bobot & Milestone Pekerjaan
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Bobot Pekerjaan Proyek
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Perhitungan bobot proporsional berbasis anggaran RAP untuk pengendalian jadwal dan kurva progres.
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
            onClick={handleRecalculate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
            Normalisasi 100%
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Tambah Tahap Pekerjaan
          </button>
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
          title="Total Akumulasi Bobot"
          value={`${totalWeight.toFixed(2)}%`}
          subtitle={totalWeight === 100 ? "Valid (Tepat 100.00%)" : "Perlu dinormalisasi"}
          icon={Percent}
        />
        <StatCard
          title="Total Anggaran Terdistribusi"
          value={formatCurrency(totalBudget)}
          subtitle={`${schedules.length} aktivitas pekerjaan`}
          icon={DollarSign}
        />
        <StatCard
          title="Realisasi Progres Fisik Riil"
          value={`${overallProgress}%`}
          subtitle="Progres tertimbang terverifikasi"
          icon={CheckCircle2}
        />
        <StatCard
          title="Akses Kurva S"
          value="Lihat Grafik"
          subtitle="Visualisasi kurva rencana vs aktual"
          icon={LineChart}
        />
      </div>

      {/* Division Cards and Work Breakdown */}
      <div className="space-y-6">
        {divisionGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-400">
            Belum ada aktivitas jadwal atau bobot pekerjaan yang diinput.
          </div>
        ) : (
          divisionGroups.map((group) => (
            <div key={group.division} className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
              <div className="bg-zinc-50/80 px-4 py-3 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="font-bold text-xs text-zinc-950 uppercase">{group.division}</span>
                  <span className="ml-2 rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                    Bobot Divisi: {group.divWeight.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-zinc-500">
                    Alokasi Budget: <strong className="text-zinc-900">{formatCurrency(group.divBudget)}</strong>
                  </span>
                  <span className="text-zinc-500">
                    Kontribusi Fisik: <strong className="text-emerald-800">{group.divProgress.toFixed(1)}%</strong>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="border-b border-zinc-100 bg-white text-[11px] font-bold text-zinc-400 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Aktivitas Pekerjaan</th>
                      <th className="px-4 py-2.5 text-right font-medium text-zinc-700">Anggaran Item</th>
                      <th className="px-4 py-2.5 text-right font-bold text-zinc-950">Bobot (%)</th>
                      <th className="px-4 py-2.5">Jadwal Pelaksanaan</th>
                      <th className="px-4 py-2.5 text-right">Durasi</th>
                      <th className="px-4 py-2.5">Penanggung Jawab</th>
                      <th className="px-4 py-2.5 text-right font-bold text-emerald-800">Progres Capai</th>
                      <th className="px-4 py-2.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {group.items.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                        <td className="px-4 py-3 font-semibold text-zinc-950">{item.task_name}</td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-800">
                          {formatCurrency(item.budget_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-950 bg-zinc-50/50">
                          {item.weight_percentage.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-[11px]">
                          {new Date(item.start_date).toLocaleDateString("id-ID")} s/d {new Date(item.end_date).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-500 font-mono">
                          {item.duration_days} hari
                        </td>
                        <td className="px-4 py-3 text-zinc-800 font-medium">
                          {item.pic_name || "Site Staff"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          {item.current_actual_progress || 0}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg p-1 text-zinc-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick link to S-Curve */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-950">Visualisasikan Distribusi Bobot ke Kurva S</h2>
          <p className="text-xs text-zinc-500">
            Pantau pergerakan kurva rencana mingguan terhadap akumulasi fisik di lapangan secara berkala.
          </p>
        </div>
        <Link
          href="/cost-control/s-curve"
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
        >
          Buka Visualisasi Kurva S <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* MODAL: INPUT / EDIT JADWAL & BOBOT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">
                {editingItem ? "Edit Tahap Pekerjaan" : "Tambah Tahap Pekerjaan & Alokasi Anggaran"}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Divisi Pekerjaan</label>
                <input
                  type="text"
                  value={form.division}
                  onChange={(e) => setForm({ ...form, division: e.target.value })}
                  placeholder="Contoh: Pekerjaan Struktur Atas"
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Nama Aktivitas / Tahap</label>
                <input
                  type="text"
                  value={form.task_name}
                  onChange={(e) => setForm({ ...form, task_name: e.target.value })}
                  placeholder="Contoh: Pengecoran Plat Lantai 2"
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Alokasi Anggaran Biaya (Rp)</label>
                <input
                  type="number"
                  value={form.budget_amount}
                  onChange={(e) => setForm({ ...form, budget_amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                  required
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Bobot (%) dihitung proporsional terhadap total anggaran proyek secara otomatis.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Penanggung Jawab (PIC)</label>
                <input
                  type="text"
                  value={form.pic_name}
                  onChange={(e) => setForm({ ...form, pic_name: e.target.value })}
                  placeholder="Nama pengawas / koordinator lapangan"
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
                  Simpan Tahap Pekerjaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
