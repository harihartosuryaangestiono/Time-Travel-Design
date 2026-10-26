"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Plus, RefreshCw, Wallet } from "lucide-react";
import { createSubcontractorContract, getSubcontractorRecap } from "@/app/actions/subcontractorActions";
import { StatCard } from "@/components/ui/StatCard";

type RecapData = Awaited<ReturnType<typeof getSubcontractorRecap>>;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SubcontractorRecapPage() {
  const [data, setData] = useState<RecapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [description, setDescription] = useState("");
  const [contractAmount, setContractAmount] = useState<number | "">("");

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

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      await createSubcontractorContract({
        projectId,
        vendorId,
        description,
        contractAmount: Number(contractAmount),
      });
      setDescription("");
      setContractAmount("");
      await fetchData();
    } catch (err) {
      console.error("Gagal menyimpan borongan subkontraktor:", err);
      setError(err instanceof Error ? err.message : "Gagal menyimpan borongan.");
    } finally {
      setIsSaving(false);
    }
  };

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

      {data?.canManage && (
        <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Proyek *</label>
            <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs">
              <option value="">Pilih proyek</option>
              {data.projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Subkontraktor *</label>
            <select required value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs">
              <option value="">Pilih subkontraktor</option>
              {data.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Pekerjaan borongan *</label>
            <input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Borongan pemasangan kaca" className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Nilai borongan (Rp) *</label>
            <input required type="number" min="1" step="1" value={contractAmount} onChange={(event) => setContractAmount(Number(event.target.value) || "")} placeholder="17000000" className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-right font-mono text-xs" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={isSaving || !data.projects.length || !data.vendors.length} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-black disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : "Simpan Borongan"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Sisa Borongan per Proyek</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Pembayaran lama dicocokkan otomatis dari proyek, kategori subkontraktor, dan nama vendor. Untuk pembayaran baru, pilih borongan di Buku Kas.
            </p>
          </div>
          <span className="text-xs text-zinc-400">{data?.contracts.length || 0} kontrak</span>
        </div>
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <th className="pb-3 pl-2">Proyek</th>
              <th className="pb-3">Subkontraktor</th>
              <th className="pb-3">Pekerjaan</th>
              <th className="pb-3 text-right">Nilai Borongan</th>
              <th className="pb-3 text-right">Sudah Dibayar</th>
              <th className="pb-3 pr-2 text-right">Sisa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr><td colSpan={6} className="py-10 text-center text-zinc-400">Memuat rekapitulasi...</td></tr>
            ) : !data?.contracts.length ? (
              <tr><td colSpan={6} className="py-10 text-center text-zinc-400">Belum ada nilai borongan. Tambahkan proyek dan vendor terlebih dahulu.</td></tr>
            ) : data.contracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-zinc-50">
                <td className="py-3 pl-2"><span className="font-semibold text-zinc-900">{contract.projectName}</span><span className="ml-1 text-zinc-400">({contract.projectCode})</span></td>
                <td className="py-3 font-semibold text-zinc-800">{contract.vendorName}</td>
                <td className="py-3 text-zinc-600">{contract.description}</td>
                <td className="py-3 text-right font-mono">{formatCurrency(contract.contractAmount)}</td>
                <td className="py-3 text-right font-mono text-emerald-700">{formatCurrency(contract.paidAmount)}</td>
                <td className="py-3 pr-2 text-right font-mono font-bold text-amber-700">{formatCurrency(contract.remainingAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
