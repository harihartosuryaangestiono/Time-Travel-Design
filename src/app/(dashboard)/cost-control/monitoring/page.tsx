"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Eye,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Boxes,
  HardHat,
  LineChart,
  Sliders,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import {
  getProjectMonitoringOverview,
  ProjectMonitoringSummary,
} from "@/app/actions/cost-control/monitoringActions";
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

export default function ProjectMonitoringPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getProjectMonitoringOverview>> | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getProjectMonitoringOverview(selectedProjectId || undefined);
      setData(res);
      if (res.selectedProjectId && !selectedProjectId) {
        setSelectedProjectId(res.selectedProjectId);
      }
    } catch (err: any) {
      console.error("Gagal memuat monitoring proyek:", err);
      setError(err?.message || "Gagal memuat ringkasan monitoring proyek.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = data?.summary;

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            <Eye className="h-3.5 w-3.5" />
            Executive Construction Cockpit
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Monitoring Proyek
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Pemantauan holistik kesehatan proyek: perbandingan kurva fisik, serapan anggaran, profitabilitas riil, dan peringatan dini anomali.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs shadow-sm">
            <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 outline-none cursor-pointer"
            >
              {(data?.projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-zinc-400" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Project Health Banner */}
      {summary && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-950">{summary.projectCode} • {summary.projectName}</span>
              <Badge
                variant={
                  summary.healthStatus === "HEALTHY"
                    ? "success"
                    : summary.healthStatus === "WATCHLIST"
                    ? "warning"
                    : "error"
                }
              >
                {summary.healthStatus === "HEALTHY"
                  ? "Kondisi Sehat"
                  : summary.healthStatus === "WATCHLIST"
                  ? "Dalam Pengawasan"
                  : "Risiko Tinggi"}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Nilai Kontrak Klien: <strong>{formatCurrency(summary.contractValue)}</strong> • Plafon Anggaran (HPP): <strong>{formatCurrency(summary.totalBudget)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-zinc-400">Progres Fisik Riil:</span>
              <div className="text-base font-bold text-emerald-800">{summary.actualProgressPercent}%</div>
            </div>
            <div>
              <span className="text-zinc-400">Target Rencana:</span>
              <div className="text-base font-bold text-blue-900">{summary.plannedProgressPercent}%</div>
            </div>
            <div>
              <span className="text-zinc-400">Deviasi Jadwal:</span>
              <div className={`text-base font-bold ${summary.progressVariancePercent >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {summary.progressVariancePercent >= 0 ? `+${summary.progressVariancePercent}%` : `${summary.progressVariancePercent}%`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Realisasi Biaya Terpakai"
          value={formatCurrency(summary?.totalActualCost || 0)}
          subtitle={`${summary?.budgetConsumptionPercent || 0}% dari anggaran`}
          icon={Activity}
        />
        <StatCard
          title="Perkiraan Biaya Akhir (Forecast)"
          value={summary?.forecastFinalCost == null ? "Belum tersedia" : formatCurrency(summary.forecastFinalCost)}
          subtitle="Memerlukan pengeluaran aktual dan progres terverifikasi"
          icon={TrendingDown}
        />
        <StatCard
          title="Estimasi Keuntungan Bersih"
          value={summary?.projectedProfit == null ? "Belum tersedia" : formatCurrency(summary.projectedProfit)}
          subtitle={summary?.projectedMarginPercent == null
            ? "Memerlukan forecast biaya yang didukung data"
            : `Margin keuntungan proyek: ~${summary.projectedMarginPercent}%`}
          icon={TrendingUp}
        />
        <StatCard
          title="Peringatan Anomali Aktif"
          value={`${summary?.anomaliesCount || 0} Item`}
          subtitle="Material waste / selisih volume klaim"
          icon={ShieldAlert}
        />
      </div>

      {/* Deep-Dive Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cost Breakdown Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-sm font-bold text-zinc-950">Struktur Biaya Aktual</h2>
            <Link href="/cost-control/variance-analysis" className="text-xs font-semibold text-zinc-900 hover:underline">
              Detail Selisih
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-zinc-50">
              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                <Boxes className="h-3.5 w-3.5 text-emerald-600" />
                Material Bangunan:
              </span>
              <span className="font-bold text-zinc-950">{formatCurrency(summary?.materialCost || 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zinc-50">
              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                <HardHat className="h-3.5 w-3.5 text-blue-600" />
                Upah Tukang & Borongan:
              </span>
              <span className="font-bold text-zinc-950">{formatCurrency(summary?.laborCost || 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zinc-50">
              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                <Activity className="h-3.5 w-3.5 text-amber-600" />
                Operasional / Peralatan:
              </span>
              <span className="font-bold text-zinc-950">{formatCurrency(summary?.otherCost || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-zinc-200 font-bold text-zinc-950">
              <span>TOTAL TERBAYAR:</span>
              <span>{formatCurrency(summary?.totalActualCost || 0)}</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/cost-control/labor-recap"
              className="w-full flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-700 hover:bg-zinc-100 transition"
            >
              <span>Buka Rekapitulasi Upah Tukang</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
          </div>
        </div>

        {/* Schedule & S-Curve Health */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-sm font-bold text-zinc-950">Kinerja Waktu & Kurva S</h2>
            <Link href="/cost-control/s-curve" className="text-xs font-semibold text-zinc-900 hover:underline">
              Buka Kurva S
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-zinc-50">
              <span className="text-zinc-600">Status Waktu:</span>
              <Badge
                variant={
                  summary?.scheduleStatus === "AHEAD_OF_SCHEDULE"
                    ? "success"
                    : summary?.scheduleStatus === "DELAYED"
                    ? "error"
                    : "info"
                }
              >
                {summary?.scheduleStatus === "AHEAD_OF_SCHEDULE"
                  ? "Lebih Cepat"
                  : summary?.scheduleStatus === "DELAYED"
                  ? "Terlambat"
                  : "Tepat Waktu"}
              </Badge>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zinc-50">
              <span className="text-zinc-600">Deviasi Jadwal:</span>
              <span className="font-bold text-zinc-900">{summary?.progressVariancePercent || 0}%</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zinc-50">
              <span className="text-zinc-600">Total Periode Kerja:</span>
              <span className="font-semibold text-zinc-900">{data?.sCurve?.totalDurationWeeks || 0} Minggu</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/cost-control/work-weights"
              className="w-full flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-700 hover:bg-zinc-100 transition"
            >
              <span>Buka Pembobotan & Tahap Pekerjaan</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
          </div>
        </div>

        {/* Profitability & Forecast Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-950 p-6 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-zinc-300">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Proyeksi Profitabilitas Akhir
            </div>
            <h2 className="mt-3 text-base font-bold text-white">Forecasting Hasil Proyek</h2>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-300">
                <span>Nilai Kontrak Klien:</span>
                <span className="font-bold text-white">{formatCurrency(summary?.contractValue || 0)}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Forecast Biaya Selesai:</span>
                <span className="font-bold text-white">
                  {summary?.forecastFinalCost == null ? "Belum tersedia" : formatCurrency(summary.forecastFinalCost)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t border-white/15 text-sm font-bold text-emerald-400">
                <span>Estimasi Keuntungan:</span>
                <span>{summary?.projectedProfit == null ? "Belum tersedia" : formatCurrency(summary.projectedProfit)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <Link
              href={`/cost-control/rap/${data?.budgetVsActual?.projectId || ""}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              Buka Analisis Budget vs Actual <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
