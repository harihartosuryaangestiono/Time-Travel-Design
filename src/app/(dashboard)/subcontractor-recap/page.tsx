"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Pencil, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import {
  createSubcontractorContract,
  deleteSubcontractorContract,
  getSubcontractorRecap,
  updateSubcontractorContract,
} from "@/app/actions/subcontractorActions";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [description, setDescription] = useState("");
  const [contractAmount, setContractAmount] = useState<number | "">("");
  const [editingContract, setEditingContract] = useState<RecapData["contracts"][number] | null>(null);
  const [deletingContract, setDeletingContract] = useState<RecapData["contracts"][number] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const input = {
        projectId,
        subcontractorId,
        description,
        contractAmount: Number(contractAmount),
      };
      if (editingContract) {
        await updateSubcontractorContract({ id: editingContract.id, ...input });
      } else {
        await createSubcontractorContract(input);
      }
      resetContractForm();
      await fetchData();
    } catch (err) {
      console.error("Gagal menyimpan borongan subkontraktor:", err);
      setError(err instanceof Error ? err.message : "Gagal menyimpan borongan.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetContractForm = () => {
    setEditingContract(null);
    setProjectId("");
    setSubcontractorId("");
    setDescription("");
    setContractAmount("");
  };

  const startEditingContract = (contract: RecapData["contracts"][number]) => {
    setEditingContract(contract);
    setProjectId(contract.projectId);
    setSubcontractorId(contract.subcontractorId);
    setDescription(contract.description);
    setContractAmount(contract.contractAmount);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteContract = async () => {
    if (!deletingContract) return;
    try {
      setIsDeleting(true);
      setError(null);
      await deleteSubcontractorContract(deletingContract.id);
      setDeletingContract(null);
      await fetchData();
    } catch (err) {
      console.error("Gagal menghapus borongan subkontraktor:", err);
      setDeletingContract(null);
      setError(err instanceof Error ? err.message : "Gagal menghapus borongan subkontraktor.");
    } finally {
      setIsDeleting(false);
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

      {data?.canManage && (
        <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-5">
            <h3 className="text-sm font-bold text-zinc-950">
              {editingContract ? "Edit Borongan Subkontraktor" : "Tambah Borongan Subkontraktor"}
            </h3>
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Proyek *</label>
            <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs">
              <option value="">Pilih proyek</option>
              {data.projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Subkontraktor *</label>
            <select required value={subcontractorId} onChange={(event) => setSubcontractorId(event.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs">
              <option value="">Pilih subkontraktor</option>
              {data.subcontractors.map((subcontractor) => <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.name}</option>)}
            </select>
            {!data.subcontractors.length && (
              <Link href="/subcontractors" className="mt-1 inline-block text-[10px] font-semibold text-blue-700 hover:underline">
                Tambahkan data subkontraktor
              </Link>
            )}
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
            <div className="flex w-full gap-2">
              {editingContract && (
                <button type="button" onClick={resetContractForm} disabled={isSaving} className="h-10 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                  Batal
                </button>
              )}
              <button type="submit" disabled={isSaving || !data.projects.length || !data.subcontractors.length} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-black disabled:opacity-50">
                {editingContract ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {isSaving ? "Menyimpan..." : editingContract ? "Simpan Perubahan" : "Simpan Borongan"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Sisa Borongan per Proyek</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Pembayaran lama dicocokkan otomatis dari proyek, kategori subkontraktor, dan nama subkontraktor. Untuk pembayaran baru, pilih borongan di Buku Kas.
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
              {data?.canManage && <th className="pb-3 pr-2 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr><td colSpan={data?.canManage ? 7 : 6} className="py-10 text-center text-zinc-400">Memuat rekapitulasi...</td></tr>
            ) : !data?.contracts.length ? (
              <tr><td colSpan={data?.canManage ? 7 : 6} className="py-10 text-center text-zinc-400">Belum ada nilai borongan. Tambahkan proyek dan data subkontraktor terlebih dahulu.</td></tr>
            ) : data.contracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-zinc-50">
                <td className="py-3 pl-2"><span className="font-semibold text-zinc-900">{contract.projectName}</span><span className="ml-1 text-zinc-400">({contract.projectCode})</span></td>
                <td className="py-3 font-semibold text-zinc-800">{contract.subcontractorName}</td>
                <td className="py-3 text-zinc-600">{contract.description}</td>
                <td className="py-3 text-right font-mono">{formatCurrency(contract.contractAmount)}</td>
                <td className="py-3 text-right font-mono text-emerald-700">{formatCurrency(contract.paidAmount)}</td>
                <td className="py-3 pr-2 text-right font-mono font-bold text-amber-700">{formatCurrency(contract.remainingAmount)}</td>
                {data.canManage && (
                  <td className="py-3 pr-2 text-right">
                    <button type="button" onClick={() => startEditingContract(contract)} aria-label={`Edit borongan ${contract.description}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeletingContract(contract)} aria-label={`Hapus borongan ${contract.description}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DeleteConfirmDialog
        isOpen={Boolean(deletingContract)}
        onClose={() => setDeletingContract(null)}
        onConfirm={handleDeleteContract}
        title="Hapus borongan subkontraktor?"
        description="Borongan yang sudah memiliki pembayaran tidak dapat dihapus."
        itemName={deletingContract?.description}
        isDeleting={isDeleting}
        confirmLabel="Hapus Borongan"
        deletingLabel="Menghapus..."
        cancelLabel="Batal"
      />
    </div>
  );
}
