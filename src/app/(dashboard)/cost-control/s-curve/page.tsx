"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  LineChart as LineChartIcon,
  Plus,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
  Sliders,
  DollarSign,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  getSCurveReport,
  recordProjectProgress,
  SCurveReport,
} from "@/app/actions/cost-control/scheduleActions";
import { getProjects } from "@/app/actions/projectActions";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function SCurvePage() {
  const [report, setReport] = useState<SCurveReport | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRecordingProgress, setIsRecordingProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Record Progress Modal
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressForm, setProgressForm] = useState({
    schedule_id: "",
    period_week: 1,
    actual_progress_percent: 50,
    notes: "",
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
        const data = await getSCurveReport(activeId);
        setReport(data);

        if (data.tasks.length > 0) {
          setProgressForm((prev) => data.tasks.some((task) => task.id === prev.schedule_id) ? prev : ({
            ...prev,
            schedule_id: data.tasks[0].id,
            period_week: data.currentWeek,
          }));
        }
      }
    } catch (err: any) {
      console.error("Gagal memuat Kurva S:", err);
      setError(err?.message || "Gagal memuat data Kurva S.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecordProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecordingProgress) return;
    try {
      setIsRecordingProgress(true);
      if (!selectedProjectId) throw new Error("Pilih proyek terlebih dahulu.");
      if (!progressForm.schedule_id) throw new Error("Pilih aktivitas pekerjaan.");

      await recordProjectProgress({
        project_id: selectedProjectId,
        schedule_id: progressForm.schedule_id,
        period_week: Number(progressForm.period_week),
        actual_progress_percent: Number(progressForm.actual_progress_percent),
        notes: progressForm.notes,
      });

      setSuccessMsg("Progres mingguan berhasil dicatat ke Kurva S.");
      setShowProgressModal(false);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Gagal mencatat progres.");
    } finally {
      setIsRecordingProgress(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <LineChartIcon className="h-3.5 w-3.5" />
            Project Progress & S-Curve Monitoring
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Kurva S Proyek
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Visualisasi kumulatif progres rencana (planned) terhadap realisasi fisik riil mingguan dan deviasi keterlambatan/percepatan.
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
            onClick={() => setShowProgressModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Input Progres Mingguan
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
          title="Target Rencana (Planned)"
          value={`${report?.currentPlannedCumulative || 0}%`}
          subtitle={`Target kumulatif Minggu ke-${report?.currentWeek || 1}`}
          icon={Clock}
        />
        <StatCard
          title="Realisasi Fisik Riil (Actual)"
          value={`${report?.currentActualCumulative || 0}%`}
          subtitle="Progres fisik terverifikasi di lapangan"
          icon={CheckCircle2}
        />
        <StatCard
          title="Deviasi Jadwal (Variance)"
          value={`${(report?.scheduleVariancePercent || 0) >= 0 ? "+" : ""}${report?.scheduleVariancePercent || 0}%`}
          subtitle={
            (report?.scheduleVariancePercent || 0) >= 0
              ? "Proyek berjalan lebih cepat dari rencana"
              : "Proyek mengalami deviasi keterlambatan"
          }
          icon={(report?.scheduleVariancePercent || 0) >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          title="Status Kinerja Waktu"
          value={
            report?.scheduleStatus === "AHEAD_OF_SCHEDULE"
              ? "Ahead Schedule"
              : report?.scheduleStatus === "DELAYED"
              ? "Delayed"
              : "On Schedule"
          }
          subtitle={`Durasi rencana: ${report?.totalDurationWeeks || 0} minggu`}
          icon={Sliders}
        />
      </div>

      {/* S-CURVE VISUALIZER */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 gap-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-950">Grafik Kurva S (Progres Rencana vs Realisasi)</h2>
            <p className="text-xs text-zinc-500">
              Garis biru putus-putus menunjukkan kurva rencana kumulatif; garis hijau solid menunjukkan progres riil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
              <span className="h-2 w-4 bg-blue-600 rounded-sm" /> Rencana (Planned %)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <span className="h-2 w-4 bg-emerald-600 rounded-sm" /> Realisasi (Actual %)
            </span>
          </div>
        </div>

        {report && report.curveData && report.curveData.length > 0 ? (
          <div className="mt-6 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.curveData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${val}%`,
                    name === "plannedCumulative" ? "Kumulatif Rencana" : "Kumulatif Realisasi",
                  ]}
                  labelFormatter={(lbl) => `Periode: ${lbl}`}
                />
                <Line
                  type="monotone"
                  dataKey="plannedCumulative"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: "#2563EB" }}
                />
                <Line
                  type="monotone"
                  dataKey="actualCumulative"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#10B981" }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-400">
            Belum ada data jadwal untuk membentuk Kurva S. Atur jadwal pekerjaan di menu Bobot Pekerjaan.
          </div>
        )}
      </div>

      {/* WEEKLY TABLE SUMMARY */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
        <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-950 uppercase">Tabel Tabulasi Mingguan Kurva S</h2>
          <span className="text-[11px] text-zinc-500">Total Periode: {report?.totalDurationWeeks || 0} Minggu</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="border-b border-zinc-100 bg-white text-[11px] font-bold text-zinc-400 uppercase">
              <tr>
                <th className="px-4 py-2.5">Minggu</th>
                <th className="px-4 py-2.5">Tanggal Awal</th>
                <th className="px-4 py-2.5 text-right">Rencana Pekan Ini (%)</th>
                <th className="px-4 py-2.5 text-right font-semibold text-blue-900">Kumulatif Rencana (%)</th>
                <th className="px-4 py-2.5 text-right">Realisasi Pekan Ini (%)</th>
                <th className="px-4 py-2.5 text-right font-bold text-emerald-800">Kumulatif Realisasi (%)</th>
                <th className="px-4 py-2.5 text-right font-bold">Deviasi (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(report?.curveData || []).map((pt) => (
                <tr key={pt.week} className="hover:bg-zinc-50/60 transition">
                  <td className="px-4 py-2.5 font-bold text-zinc-900">Minggu {pt.week}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{pt.date}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{pt.plannedProgress}%</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-blue-900 bg-blue-50/30">
                    {pt.plannedCumulative}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-zinc-700">
                    {pt.actualProgress !== undefined ? `${pt.actualProgress}%` : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-800 bg-emerald-50/20">
                    {pt.actualCumulative !== undefined ? `${pt.actualCumulative}%` : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold">
                    {pt.variance !== undefined ? (
                      <span className={pt.variance >= 0 ? "text-emerald-700" : "text-red-600"}>
                        {pt.variance >= 0 ? `+${pt.variance}%` : `${pt.variance}%`}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: INPUT PROGRES PEKERJAAN MINGGUAN */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h3 className="text-base font-bold text-zinc-950">Catat Realisasi Progres Mingguan</h3>
              <button onClick={() => setShowProgressModal(false)} disabled={isRecordingProgress} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordProgress} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Aktivitas / Tahap Pekerjaan</label>
                <select
                  value={progressForm.schedule_id}
                  onChange={(e) => setProgressForm({ ...progressForm, schedule_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 cursor-pointer"
                  required
                >
                  {(report?.tasks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.task_name} (Bobot: {t.weight_percentage.toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Minggu Ke-</label>
                  <input
                    type="number"
                    min={1}
                    max={report?.totalDurationWeeks || 52}
                    value={progressForm.period_week}
                    onChange={(e) => setProgressForm({ ...progressForm, period_week: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700">Progres Fisik Tahap Ini (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={progressForm.actual_progress_percent}
                    onChange={(e) => setProgressForm({ ...progressForm, actual_progress_percent: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 font-bold outline-none focus:border-zinc-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Catatan Kondisi Lapangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Pengecoran selesai, cuaca cerah kondusif"
                  value={progressForm.notes}
                  onChange={(e) => setProgressForm({ ...progressForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  disabled={isRecordingProgress}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRecordingProgress}
                  aria-busy={isRecordingProgress}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRecordingProgress && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isRecordingProgress ? "Mencatat Progres..." : "Simpan Progres"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
