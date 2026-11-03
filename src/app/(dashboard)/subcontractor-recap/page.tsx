"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ChevronRight,
  FolderKanban,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { getSubcontractorRecap } from "@/app/actions/subcontractorActions";
import { StatCard } from "@/components/ui/StatCard";

type RecapData = Awaited<ReturnType<typeof getSubcontractorRecap>>;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function SubcontractorRecapPage() {
  const [data, setData] = useState<RecapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setData(await getSubcontractorRecap());
    } catch (err) {
      console.error("Gagal memuat rekap subkontraktor:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat rekap subkontraktor.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const contractTotal = useMemo(
    () => (data?.contracts || []).reduce((sum, contract) => sum + contract.contractAmount, 0),
    [data]
  );
  const paidTotal = useMemo(
    () => (data?.contracts || []).reduce((sum, contract) => sum + contract.paidAmount, 0),
    [data]
  );
  const remainingTotal = useMemo(
    () => (data?.contracts || []).reduce((sum, contract) => sum + contract.remainingAmount, 0),
    [data]
  );
  const projectGroups = useMemo(
    () =>
      (data?.projects || []).map((project) => {
        const contracts = (data?.contracts || []).filter((contract) => contract.projectId === project.id);
        return {
          ...project,
          contracts,
          contractTotal: contracts.reduce((sum, contract) => sum + contract.contractAmount, 0),
          paidTotal: contracts.reduce((sum, contract) => sum + contract.paidAmount, 0),
          remainingTotal: contracts.reduce((sum, contract) => sum + contract.remainingAmount, 0),
        };
      }),
    [data]
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">Rekapitulasi Subkontraktor</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Catat nilai borongan dan pantau pembayaran serta sisa per proyek dan subkontraktor.
          </p>
        </div>
        <Link
          href="/subcontractors"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Data Subkontraktor
        </Link>
        <Link
          href="/cash-book"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black"
        >
          <Wallet className="h-4 w-4" />
          Catat Pembayaran di Buku Kas
        </Link>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void fetchData()} className="inline-flex items-center gap-1 font-semibold">
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Borongan" value={isLoading ? "..." : formatCurrency(contractTotal)} subtitle="Nilai semua kontrak subkontraktor" icon={Wallet} iconBgColor="bg-blue-500/10" iconColor="text-blue-700" />
        <StatCard title="Sudah Dibayar" value={isLoading ? "..." : formatCurrency(paidTotal)} subtitle="Pembayaran cocok otomatis atau ditautkan dari Buku Kas" icon={ArrowDownToLine} iconBgColor="bg-emerald-500/10" iconColor="text-emerald-700" />
        <StatCard title="Sisa Borongan" value={isLoading ? "..." : formatCurrency(remainingTotal)} subtitle="Belum dibayarkan ke subkontraktor" icon={Wallet} iconBgColor="bg-amber-500/10" iconColor="text-amber-700" />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Portofolio Proyek</h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              Pilih proyek untuk melihat borongan dan pembayaran ke setiap subkontraktor.
            </p>
          </div>
          <span className="shrink-0 text-xs text-zinc-400">{projectGroups.length} proyek</span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400 shadow-sm">
            Memuat daftar proyek...
          </div>
        ) : !projectGroups.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            Belum ada proyek untuk ditampilkan. Tambahkan proyek terlebih dahulu.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {projectGroups.map((project) => (
                <Link
                  key={project.id}
                  href={`/subcontractor-recap/${encodeURIComponent(project.id)}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <FolderKanban className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {project.code}
                        </span>
                        <h4 className="mt-1 text-base font-bold leading-snug text-zinc-950 transition-colors group-hover:text-blue-700">{project.name}</h4>
                      </div>
                    </div>
                    <span className="mt-1 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-zinc-700">
                      <ChevronRight className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Borongan</p>
                      <p className="mt-1 font-mono text-xs font-bold text-zinc-900">{formatCurrency(project.contractTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Dibayar</p>
                      <p className="mt-1 font-mono text-xs font-bold text-emerald-700">{formatCurrency(project.paidTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Sisa</p>
                      <p className="mt-1 font-mono text-xs font-bold text-amber-700">{formatCurrency(project.remainingTotal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Jumlah borongan</p>
                      <p className="mt-1 text-xs font-semibold text-zinc-700">{project.contracts.length} borongan</p>
                    </div>
                  </div>
                  <p className="mt-5 border-t border-zinc-100 pt-4 text-xs font-semibold text-blue-700">
                    Lihat detail borongan <span aria-hidden="true">→</span>
                  </p>
                </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
