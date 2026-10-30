"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Calendar, RefreshCw } from "lucide-react";
import {
  getProjectRekapitulasiData,
  type ProjectRekapitulasiData,
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

function CategoryTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: ProjectRekapitulasiData["hppCategories"];
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-bold text-zinc-950">{title}</h2>
        <span className="text-xs font-bold tabular-nums text-zinc-700">{formatCurrency(total)}</span>
      </div>
      <div className="divide-y divide-zinc-100">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-4 px-5 py-3 text-xs">
            <span className="text-zinc-600">{row.name}</span>
            <span className="font-semibold tabular-nums text-zinc-900">{formatCurrency(row.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-zinc-50 px-5 py-3 text-xs font-bold">
          <span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
    </section>
  );
}

export default function ProjectRecapDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(Number(searchParams.get("year")) || 2026);
  const [data, setData] = useState<ProjectRekapitulasiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setData(await getProjectRekapitulasiData(decodeURIComponent(params.id), year));
    } catch (loadError) {
      console.error("Gagal memuat rekapitulasi proyek:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat rekapitulasi proyek.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id, year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/reports/project-recap?year=${year}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="h-3.5 w-3.5" />Kembali ke daftar proyek
          </Link>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Rekapitulasi Laporan Keuangan Proyek
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            {data ? data.project.name : isLoading ? "Memuat proyek..." : "Rekapitulasi Proyek"}
          </h1>
          {data && (
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-mono">{data.project.code}</span> · {data.project.clientName}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold shadow-sm">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <span>Tahun Buku</span>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="bg-transparent font-bold text-zinc-900 focus:outline-none">
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button type="button" onClick={() => void fetchData()} className="inline-flex items-center gap-1 font-semibold">
            <RefreshCw className="h-3.5 w-3.5" />Coba lagi
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Nilai Kontrak" value={formatCurrency(data.project.contractValue)} subtitle="Nilai kontrak proyek" icon={Calendar} iconBgColor="bg-blue-500/10" iconColor="text-blue-700" />
            <StatCard title="Pendapatan Diterima" value={formatCurrency(data.totalRevenue)} subtitle="Pendapatan proyek tahun ini" icon={Calendar} iconBgColor="bg-emerald-500/10" iconColor="text-emerald-700" />
            <StatCard title="Laba Kotor" value={formatCurrency(data.grossProfit)} subtitle={`Total HPP ${formatCurrency(data.totalHpp)}`} icon={Calendar} iconBgColor="bg-amber-500/10" iconColor="text-amber-700" />
            <StatCard title="Laba Bersih" value={formatCurrency(data.netIncome)} subtitle={`Total OPEX ${formatCurrency(data.totalOpex)}`} icon={Calendar} iconBgColor="bg-violet-500/10" iconColor="text-violet-700" />
          </div>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-bold text-zinc-950">Pendapatan Proyek</h2>
              <p className="mt-1 text-xs text-zinc-500">Total diterima: {formatCurrency(data.totalRevenue)}</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {!data.revenues.length ? (
                <p className="px-5 py-6 text-center text-xs text-zinc-500">Belum ada pendapatan yang tercatat pada tahun ini.</p>
              ) : data.revenues.map((revenue, index) => (
                <div key={`${revenue.date}-${index}`} className="grid gap-1 px-5 py-3 text-xs sm:grid-cols-[140px_1fr_auto] sm:items-center">
                  <span className="text-zinc-500">{revenue.date}</span>
                  <span className="text-zinc-700">{revenue.description}</span>
                  <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(revenue.amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <CategoryTable title="Harga Pokok Penjualan (HPP)" rows={data.hppCategories} total={data.totalHpp} />
            <CategoryTable title="Biaya Operasional (OPEX)" rows={data.opexCategories} total={data.totalOpex} />
            <CategoryTable title="Biaya Aset dan Investasi (CAPEX)" rows={data.capexCategories} total={data.totalCapex} />
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-sm font-bold text-zinc-950">Transaksi Belum Berkategori</h2>
                <p className="mt-1 text-xs text-zinc-500">Total: {formatCurrency(data.totalUncategorized)}</p>
              </div>
              {!data.uncategorizedExpenses.length ? (
                <p className="px-5 py-6 text-center text-xs text-zinc-500">Tidak ada transaksi tanpa kategori.</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {data.uncategorizedExpenses.map((expense) => (
                    <div key={expense.id} className="grid gap-1 px-5 py-3 text-xs sm:grid-cols-[100px_1fr_auto] sm:items-center">
                      <span className="text-zinc-500">{expense.date}</span>
                      <span className="text-zinc-700">{expense.description}</span>
                      <span className="font-semibold tabular-nums text-amber-700">{formatCurrency(expense.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
