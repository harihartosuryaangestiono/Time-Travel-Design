"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  FolderKanban,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calculator,
  Search,
  Sliders,
  DollarSign,
  TrendingDown,
  X,
  Loader2,
} from "lucide-react";
import {
  getRapProjects,
  createRapFromRab,
  RapProjectItem,
} from "@/app/actions/cost-control/rapActions";
import { getRabProjects, RabProjectItem } from "@/app/actions/cost-control/rabActions";
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

export default function RapListPage() {
  const [rapList, setRapList] = useState<RapProjectItem[]>([]);
  const [approvedRabs, setApprovedRabs] = useState<RabProjectItem[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isDeriving, setIsDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Derive Modal
  const [showDeriveModal, setShowDeriveModal] = useState(false);
  const [deriveForm, setDeriveForm] = useState({
    rab_id: "",
    targetSavingsPercent: 5,
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [raps, rabs, projList] = await Promise.all([
        getRapProjects(selectedProjectId === "ALL" ? undefined : selectedProjectId),
        getRabProjects(selectedProjectId === "ALL" ? undefined : selectedProjectId),
        getProjects(),
      ]);
      setRapList(raps);
      const validRabs = rabs.filter((r) => r.status === "APPROVED" || r.status === "SUBMITTED" || r.status === "DRAFT");
      setApprovedRabs(validRabs);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));

      if (validRabs.length > 0) {
        setDeriveForm((prev) => prev.rab_id ? prev : ({ ...prev, rab_id: validRabs[0].id }));
      }
    } catch (err: any) {
      console.error("Gagal memuat daftar RAP:", err);
      setError(err?.message || "Gagal memuat data RAP.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRaps = useMemo(() => {
    return rapList.filter((r) => {
      const matchSearch =
        !searchQuery.trim() ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.rap_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.project?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [rapList, searchQuery]);

  const totalPlannedBudget = useMemo(() => rapList.reduce((sum, r) => sum + r.total_planned_budget, 0), [rapList]);
  const totalTargetSavings = useMemo(() => rapList.reduce((sum, r) => sum + r.target_savings, 0), [rapList]);

  const handleDeriveRap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeriving) return;
    try {
      setIsDeriving(true);
      if (!deriveForm.rab_id) throw new Error("Pilih RAB acuan.");
      await createRapFromRab(deriveForm.rab_id, {
        targetSavingsPercent: Number(deriveForm.targetSavingsPercent),
      });
      setSuccessMsg("RAP pelaksanaan berhasil diturunkan dari RAB.");
      setShowDeriveModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal menurunkan RAP.");
    } finally {
      setIsDeriving(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Rencana Anggaran Pelaksanaan (RAP)
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            RAP (Anggaran Internal Pelaksanaan)
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Anggaran operasional internal yang diturunkan dari RAB untuk pengendalian biaya material, upah, dan jadwal pengadaan.
          </p>
        </div>

        <button
          onClick={() => setShowDeriveModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Turunkan RAP dari RAB
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
          title="Total Target Budget Internal"
          value={formatCurrency(totalPlannedBudget)}
          subtitle={`${rapList.length} paket pelaksanaan`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Target Efisiensi / Penghematan"
          value={formatCurrency(totalTargetSavings)}
          subtitle="Target selisih positif vs RAB"
          icon={TrendingDown}
        />
        <StatCard
          title="RAP Berjalan (Active)"
          value={`${rapList.filter((r) => r.status === "ACTIVE" || r.status === "DRAFT").length} Dokumen`}
          subtitle="Sedang dalam proses operasional"
          icon={Clock}
        />
        <StatCard
          title="Standar Target Efisiensi"
          value="5.0% - 10.0%"
          subtitle="Parameter pengendalian biaya"
          icon={Sliders}
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
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nomor atau judul RAP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {/* Main RAP Table */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nomor & Versi</th>
                <th className="px-4 py-3.5">Judul RAP & Proyek</th>
                <th className="px-4 py-3.5">RAB Rujukan</th>
                <th className="px-4 py-3.5 text-right">Nilai RAB Klien</th>
                <th className="px-4 py-3.5 text-right font-bold text-zinc-950">Target Budget Internal</th>
                <th className="px-4 py-3.5 text-right text-emerald-800 font-bold">Target Penghematan</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRaps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    Belum ada RAP yang dibuat. Klik &quot;Turunkan RAP dari RAB&quot; untuk membuat anggaran pelaksanaan.
                  </td>
                </tr>
              ) : (
                filteredRaps.map((rap) => (
                  <tr key={rap.id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-4 py-3 font-semibold text-zinc-950">
                      <div>{rap.rap_number}</div>
                      <div className="text-[10px] text-zinc-400">Versi {rap.version}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <div>{rap.title}</div>
                      <div className="text-[10px] text-zinc-500">
                        {rap.project?.code} • {rap.project?.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {rap.rab?.rab_number || "RAB Manual"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-800">
                      {formatCurrency(rap.rab?.grand_total || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-950">
                      {formatCurrency(rap.total_planned_budget)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-800">
                      +{formatCurrency(rap.target_savings)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="neutral">{rap.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/cost-control/rap/${rap.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black transition shadow-xs"
                      >
                        Detail RAP & Realisasi <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TURUNKAN RAP DARI RAB */}
      {showDeriveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Turunkan RAP dari Dokumen RAB</h3>
              <button onClick={() => setShowDeriveModal(false)} disabled={isDeriving} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDeriveRap} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Pilih Dokumen RAB Acuan</label>
                <select
                  value={deriveForm.rab_id}
                  onChange={(e) => setDeriveForm({ ...deriveForm, rab_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {approvedRabs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rab_number} • {r.title} ({formatCurrency(r.grand_total)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Target Efisiensi Internal (%)</label>
                <input
                  type="number"
                  step="any"
                  value={deriveForm.targetSavingsPercent}
                  onChange={(e) => setDeriveForm({ ...deriveForm, targetSavingsPercent: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                  required
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Target penghematan biaya pembelian material dan negosiasi upah borongan dari RAB dasar.
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 leading-relaxed">
                Seluruh divisi, item, volume, dan target biaya akan dipecah otomatis ke lembar kerja RAP.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowDeriveModal(false)}
                  disabled={isDeriving}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isDeriving}
                  aria-busy={isDeriving}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeriving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isDeriving ? "Membuat RAP..." : "Buat Lembar RAP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
