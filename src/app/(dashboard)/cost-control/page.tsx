"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  HardHat,
  Boxes,
  Tags,
  Hammer,
  GitCompare,
  Calculator,
  LineChart,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  FolderKanban,
  FileSpreadsheet,
} from "lucide-react";
import { getCostControlDashboard, CostControlDashboardData } from "@/app/actions/cost-control/varianceActions";
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

export default function CostControlOverviewPage() {
  const [data, setData] = useState<CostControlDashboardData | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [dash, projList] = await Promise.all([
        getCostControlDashboard(selectedProjectId),
        getProjects(),
      ]);
      setData(dash);
      setProjects((projList || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
    } catch (err: any) {
      console.error("Gagal memuat overview cost control:", err);
      setError(err?.message || "Gagal memuat ringkasan cost control.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const quickLinks = [
    { title: "Rekapitulasi Upah", desc: "Pantau volume klaim tukang vs verifikasi pengawas", href: "/cost-control/labor-recap", icon: HardHat, badge: "Tenaga Kerja" },
    { title: "Rekapitulasi Material", desc: "Kontrol beli, terima, pakai, sisa & waste material", href: "/cost-control/material-recap", icon: Boxes, badge: "Persediaan" },
    { title: "Analisis Selisih Proyek", desc: "Deteksi overclaim upah & waste melebihi toleransi", href: "/cost-control/variance-analysis", icon: GitCompare, badge: "Cost Variance" },
    { title: "Database Harga Material", desc: "Histori toko termurah, rata-rata & tren harga", href: "/cost-control/material-prices", icon: Tags, badge: "Katalog" },
    { title: "Database Harga Upah", desc: "Standar tarif borongan & upah keteng", href: "/cost-control/labor-rates", icon: Hammer, badge: "Master Tarif" },
    { title: "RAB & Analisis HPP", desc: "Penyusunan penawaran klien & margin Owner", href: "/cost-control/rab", icon: Calculator, badge: "Budgeting" },
    { title: "RAP & Budget Pelaksanaan", desc: "Target anggaran internal & schedule pengadaan", href: "/cost-control/rap", icon: FileSpreadsheet, badge: "Operational" },
    { title: "Kurva S & Bobot", desc: "Visualisasi kumulatif progres rencana vs realisasi", href: "/cost-control/s-curve", icon: LineChart, badge: "Progress" },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <Activity className="h-3.5 w-3.5" />
            Project Financial & Cost Control System
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            Overview Cost Control
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Monitoring terpadu biaya material, upah borongan, efisiensi anggaran, dan analisis deviasi proyek.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs shadow-sm">
            <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Filter Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-semibold text-zinc-900 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Proyek Aktif</option>
              {projects.map((p) => (
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
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Anggaran Biaya (HPP)"
          value={formatCurrency(data?.totalBudget || 0)}
          subtitle={selectedProjectId === "ALL" ? "Akumulasi seluruh proyek" : "Anggaran RAP/RAB"}
          icon={Calculator}
        />
        <StatCard
          title="Realisasi Biaya Aktual"
          value={formatCurrency(data?.totalActualCost || 0)}
          subtitle={`${data?.budgetConsumptionPercent || 0}% terserap dari anggaran`}
          icon={Activity}
        />
        <StatCard
          title="Biaya Material Proyek"
          value={formatCurrency(data?.totalMaterialCost || 0)}
          subtitle="Total pembelian material tercatat"
          icon={Boxes}
        />
        <StatCard
          title="Biaya Upah & Borongan"
          value={formatCurrency(data?.totalLaborCost || 0)}
          subtitle="Klaim upah tukang disetujui / dibayar"
          icon={HardHat}
        />
      </div>

      {/* Variance & Health Snapshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Budget Health Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">Kesehatan Anggaran (Budget Variance)</h2>
            <Badge variant={(data?.budgetVariance || 0) >= 0 ? "success" : "error"}>
              {(data?.budgetVariance || 0) >= 0 ? "On Budget" : "Over Budget"}
            </Badge>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-zinc-950">
              {formatCurrency(Math.abs(data?.budgetVariance || 0))}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {(data?.budgetVariance || 0) >= 0
                ? "Sisa cadangan anggaran belum terpakai (Surplus)"
                : "Pengeluaran riil telah melampaui alokasi target (Defisit)"}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Penyerapan Anggaran</span>
              <span className="font-semibold text-zinc-900">{data?.budgetConsumptionPercent || 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full transition-all duration-500 ${
                  (data?.budgetConsumptionPercent || 0) > 100
                    ? "bg-red-500"
                    : (data?.budgetConsumptionPercent || 0) > 85
                    ? "bg-amber-500"
                    : "bg-emerald-600"
                }`}
                style={{ width: `${Math.min(100, data?.budgetConsumptionPercent || 0)}%` }}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-4 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Anomali Terdeteksi:</span>
            <span className="font-semibold text-zinc-900">{data?.anomaliesCount || 0} item</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Perlu Investigasi Segera:</span>
            <span className={`font-semibold ${(data?.investigationItemsCount || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {data?.investigationItemsCount || 0} item
            </span>
          </div>
        </div>

        {/* Cost Breakdown Summary */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900">Proporsi Pengeluaran Proyek</h2>
          <p className="mt-1 text-xs text-zinc-500">Distribusi realisasi pengeluaran berdasarkan komponen biaya</p>

          <div className="mt-5 space-y-3">
            <div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Material Bangunan
                </span>
                <span className="font-semibold text-zinc-900">{formatCurrency(data?.totalMaterialCost || 0)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{
                    width: `${data?.totalActualCost ? Math.round(((data.totalMaterialCost || 0) / data.totalActualCost) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Upah Tukang & Borongan
                </span>
                <span className="font-semibold text-zinc-900">{formatCurrency(data?.totalLaborCost || 0)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${data?.totalActualCost ? Math.round(((data.totalLaborCost || 0) / data.totalActualCost) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Biaya Operasional Lapangan
                </span>
                <span className="font-semibold text-zinc-900">{formatCurrency(data?.totalOtherCost || 0)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{
                    width: `${data?.totalActualCost ? Math.round(((data.totalOtherCost || 0) / data.totalActualCost) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-4">
            <Link
              href="/cost-control/variance-analysis"
              className="inline-flex items-center text-xs font-semibold text-zinc-900 hover:text-black gap-1"
            >
              Lihat Analisis Selisih Detail <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Action Panel */}
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-950 p-6 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-zinc-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              SOP Pengendalian Konstruksi
            </div>
            <h2 className="mt-3 text-base font-bold text-white">Alur Kontrol Biaya</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              1. Tetapkan standar harga material & upah tukang.<br />
              2. Buat RAB penawaran klien & turunkan ke RAP internal.<br />
              3. Catat penerimaan, pemakaian, dan waste material.<br />
              4. Verifikasi volume tukang sebelum approval klaim.<br />
              5. Bandingkan bobot Kurva S rencana vs progres fisik riil.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Status Sistem:</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Terintegrasi
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Grid to all Sub-Modules */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-zinc-950">Modul Borongan, RAB & Cost Control</h2>
          <p className="text-xs text-zinc-500">Pilih modul spesifik untuk pengelolaan detail konstruksi</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 transition hover:border-zinc-400 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 transition group-hover:bg-zinc-950 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                      {link.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-zinc-950 group-hover:text-black">
                    {link.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                    {link.desc}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-zinc-900 group-hover:text-black">
                  <span>Buka Modul</span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
