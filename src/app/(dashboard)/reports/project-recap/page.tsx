"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
} from "lucide-react";
import {
  getProjectRekapitulasiProjects,
  type ProjectRekapitulasiSummary,
} from "@/app/actions/rekapitulasiActions";
import { StatCard } from "@/components/ui/StatCard";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatProjectDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getProjectStatus(status: string) {
  switch (status) {
    case "COMPLETED":
      return { label: "Selesai", className: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: CheckCircle2 };
    case "ON_HOLD":
      return { label: "Ditunda", className: "border-amber-200 bg-amber-50 text-amber-700", Icon: Clock3 };
    case "CANCELLED":
      return { label: "Dibatalkan", className: "border-rose-200 bg-rose-50 text-rose-700", Icon: Clock3 };
    case "ACTIVE":
      return { label: "Berjalan", className: "border-blue-200 bg-blue-50 text-blue-700", Icon: Clock3 };
    default:
      return { label: "Perencanaan", className: "border-zinc-200 bg-zinc-100 text-zinc-600", Icon: Clock3 };
  }
}

export default function ProjectRecapListPage() {
  const [year, setYear] = useState(2026);
  const [projects, setProjects] = useState<ProjectRekapitulasiSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setProjects(await getProjectRekapitulasiProjects(year));
    } catch (loadError) {
      console.error("Gagal memuat rekapitulasi per proyek:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat rekapitulasi per proyek.");
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const totalRevenue = projects.reduce((total, project) => total + project.totalRevenue, 0);
  const totalExpense = projects.reduce(
    (total, project) => total + project.totalHpp + project.totalOpex + project.totalCapex,
    0
  );
  const totalNetIncome = projects.reduce((total, project) => total + project.netIncome, 0);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Laporan Keuangan per Proyek
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            Rekapitulasi Proyek
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Pilih proyek untuk melihat pendapatan, HPP, biaya operasional, dan laba proyek.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold shadow-sm">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <span>Tahun Buku</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="bg-transparent font-bold text-zinc-900 focus:outline-none"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button type="button" onClick={() => void fetchProjects()} className="inline-flex items-center gap-1 font-semibold">
            <RefreshCw className="h-3.5 w-3.5" />Coba lagi
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Pendapatan" value={isLoading ? "..." : formatCurrency(totalRevenue)} subtitle={`${projects.length} proyek`} icon={ArrowDownRight} iconBgColor="bg-emerald-500/10" iconColor="text-emerald-700" />
        <StatCard title="Total Biaya" value={isLoading ? "..." : formatCurrency(totalExpense)} subtitle="HPP, operasional, dan capex" icon={ArrowUpRight} iconBgColor="bg-rose-500/10" iconColor="text-rose-700" />
        <StatCard title="Total Laba Bersih" value={isLoading ? "..." : formatCurrency(totalNetIncome)} subtitle="Pendapatan dikurangi HPP dan OPEX" icon={ArrowDownRight} iconBgColor="bg-blue-500/10" iconColor="text-blue-700" />
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-sm font-bold text-zinc-950">Pilih Proyek</h2>
          <p className="mt-1 text-xs text-zinc-500">Ringkasan transaksi tahun buku {year}. Pilih kartu untuk membuka rekap proyek.</p>
        </div>
        {isLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400 shadow-sm">
            Memuat daftar rekapitulasi proyek...
          </div>
        ) : !projects.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            Belum ada proyek untuk ditampilkan.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {projects.map((project) => {
              const status = getProjectStatus(project.status);
              const StatusIcon = status.Icon;

              return (
                <Link
                  key={project.projectId}
                  href={`/reports/project-recap/${encodeURIComponent(project.projectId)}?year=${year}`}
                  className="group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg sm:p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold tracking-wide text-zinc-400">
                      {project.projectCode}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold leading-snug text-zinc-950 transition-colors group-hover:text-blue-700">
                    {project.projectName}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.buildingFunction && (
                      <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
                        Fungsi: {project.buildingFunction}
                      </span>
                    )}
                    {project.workCategory && (
                      <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">
                        Pekerjaan: {project.workCategory}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-zinc-500">
                    <p className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                      {project.clientName}
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-zinc-400" />
                      {project.deadline ? `Target ${formatProjectDate(project.deadline)}` : "Target belum diatur"}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm">
                    <span className="font-semibold text-zinc-800">Rekap Proyek</span>
                    <span className={`font-mono font-bold tabular-nums ${project.netIncome < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {formatCurrency(project.netIncome)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
