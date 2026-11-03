"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  createSubcontractorContract,
  deleteSubcontractorContract,
  getSubcontractorRecap,
  updateSubcontractorContract,
} from "@/app/actions/subcontractorActions";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { StatCard } from "@/components/ui/StatCard";

type RecapData = Awaited<ReturnType<typeof getSubcontractorRecap>>;
type Contract = RecapData["contracts"][number];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function SubcontractorProjectRecapPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [data, setData] = useState<RecapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null);
  const [subcontractorId, setSubcontractorId] = useState("");
  const [description, setDescription] = useState("");
  const [contractAmount, setContractAmount] = useState<number | "">("");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setData(await getSubcontractorRecap());
    } catch (loadError) {
      console.error("Gagal memuat detail borongan proyek:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat detail borongan proyek.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const project = data?.projects.find((item) => item.id === projectId);
  const contracts = useMemo(
    () => (data?.contracts || []).filter((contract) => contract.projectId === projectId),
    [data, projectId]
  );
  const contractTotal = contracts.reduce((sum, contract) => sum + contract.contractAmount, 0);
  const paidTotal = contracts.reduce((sum, contract) => sum + contract.paidAmount, 0);
  const remainingTotal = contracts.reduce((sum, contract) => sum + contract.remainingAmount, 0);
  const paymentProgress = contractTotal > 0 ? Math.min((paidTotal / contractTotal) * 100, 100) : 0;

  const resetForm = () => {
    setEditingContract(null);
    setSubcontractorId("");
    setDescription("");
    setContractAmount("");
    setIsFormOpen(false);
  };

  const startEditing = (contract: Contract) => {
    setEditingContract(contract);
    setSubcontractorId(contract.subcontractorId);
    setDescription(contract.description);
    setContractAmount(contract.contractAmount);
    setIsFormOpen(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
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
      resetForm();
      await fetchData();
    } catch (saveError) {
      console.error("Gagal menyimpan borongan subkontraktor:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan borongan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingContract) return;
    try {
      setIsDeleting(true);
      setError(null);
      await deleteSubcontractorContract(deletingContract.id);
      setDeletingContract(null);
      await fetchData();
    } catch (deleteError) {
      console.error("Gagal menghapus borongan subkontraktor:", deleteError);
      setDeletingContract(null);
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus borongan subkontraktor.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-7 pb-16">
      <div>
        <Link
          href="/subcontractor-recap"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke portofolio proyek
        </Link>

        <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Building2 className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">
                {project?.code || (isLoading ? "Memuat proyek..." : "Proyek")}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
                {project?.name || (isLoading ? "Memuat detail borongan" : "Proyek tidak ditemukan")}
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Rincian borongan, penerima, dan progres pembayaran proyek.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link
              href="/cash-book"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Wallet className="h-4 w-4" />
              Buku Kas
            </Link>
            {data?.canManage && project && (
              <button
                type="button"
                onClick={() => {
                  if (isFormOpen && !editingContract) {
                    resetForm();
                    return;
                  }
                  setEditingContract(null);
                  setSubcontractorId("");
                  setDescription("");
                  setContractAmount("");
                  setIsFormOpen(true);
                  setError(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                <Plus className="h-4 w-4" />
                Tambah borongan
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => void fetchData()} className="inline-flex shrink-0 items-center gap-1.5 font-semibold">
            <RefreshCw className="h-3.5 w-3.5" />
            Coba lagi
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Nilai Borongan"
          value={isLoading ? "..." : formatCurrency(contractTotal)}
          subtitle={`${contracts.length} pekerjaan terdaftar`}
          icon={CircleDollarSign}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-700"
        />
        <StatCard
          title="Sudah Dibayar"
          value={isLoading ? "..." : formatCurrency(paidTotal)}
          subtitle={`${paymentProgress.toFixed(0)}% dari total borongan`}
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Sisa Pembayaran"
          value={isLoading ? "..." : formatCurrency(remainingTotal)}
          subtitle="Belum dibayarkan ke subkontraktor"
          icon={ArrowDownToLine}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
      </div>

      {contractTotal > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Progres pembayaran</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {formatCurrency(paidTotal)} dari {formatCurrency(contractTotal)} telah dibayarkan
              </p>
            </div>
            <span className="font-mono text-lg font-bold tabular-nums text-emerald-700">{paymentProgress.toFixed(1)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progres pembayaran borongan"
            aria-valuenow={Math.round(paymentProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100"
          >
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paymentProgress}%` }} />
          </div>
        </section>
      )}

      {isFormOpen && data?.canManage && project && (
        <form onSubmit={handleSave} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-zinc-950">
              {editingContract ? "Edit borongan" : "Tambah borongan"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Borongan akan dicatat untuk proyek {project.name}.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">Subkontraktor *</label>
              <select
                required
                value={subcontractorId}
                onChange={(event) => setSubcontractorId(event.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Pilih subkontraktor</option>
                {data.subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.name}</option>
                ))}
              </select>
              {!data.subcontractors.length && (
                <Link href="/subcontractors" className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline">
                  Tambahkan data subkontraktor
                </Link>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">Pekerjaan borongan *</label>
              <input
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Contoh: Pemasangan kaca"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600">Nilai borongan (Rp) *</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={contractAmount}
                onChange={(event) => setContractAmount(Number(event.target.value) || "")}
                placeholder="17000000"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-right font-mono text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isSaving || !data.subcontractors.length}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {editingContract ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {isSaving ? "Menyimpan..." : editingContract ? "Simpan perubahan" : "Simpan borongan"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="h-11 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Batal
              </button>
            </div>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-zinc-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">Daftar borongan</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Rincian pekerjaan dan pembayaran untuk setiap subkontraktor.
            </p>
          </div>
          <span className="self-start rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 sm:self-auto">
            {contracts.length} borongan
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Memuat daftar borongan...</div>
        ) : !project ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-zinc-700">Proyek tidak ditemukan.</p>
            <Link href="/subcontractor-recap" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">
              Kembali ke portofolio proyek
            </Link>
          </div>
        ) : !contracts.length ? (
          <div className="p-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
              <Wallet className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-zinc-800">Belum ada borongan untuk proyek ini.</p>
            <p className="mt-1 text-sm text-zinc-500">Tambahkan borongan agar pembayaran bisa dipantau di sini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-7 py-4">Subkontraktor</th>
                  <th className="px-5 py-4">Pekerjaan</th>
                  <th className="px-5 py-4 text-right">Nilai borongan</th>
                  <th className="px-5 py-4 text-right">Sudah dibayar</th>
                  <th className="px-5 py-4 text-right">Sisa</th>
                  {data?.canManage && <th className="px-7 py-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contracts.map((contract) => {
                  const isPaid = contract.remainingAmount === 0;
                  return (
                    <tr key={contract.id} className="transition-colors hover:bg-zinc-50/80">
                      <td className="px-7 py-5">
                        <p className="font-semibold text-zinc-900">{contract.subcontractorName}</p>
                        <p className="mt-1 text-xs text-zinc-400">{project.code}</p>
                      </td>
                      <td className="px-5 py-5 text-zinc-600">{contract.description}</td>
                      <td className="whitespace-nowrap px-5 py-5 text-right font-mono font-medium tabular-nums text-zinc-800">
                        {formatCurrency(contract.contractAmount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-5 text-right font-mono font-medium tabular-nums text-emerald-700">
                        {formatCurrency(contract.paidAmount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <span className={`font-mono font-bold tabular-nums ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>
                          {formatCurrency(contract.remainingAmount)}
                        </span>
                        <span className={`mt-1 block text-[10px] font-semibold ${isPaid ? "text-emerald-600" : "text-amber-600"}`}>
                          {isPaid ? "Lunas" : "Belum lunas"}
                        </span>
                      </td>
                      {data?.canManage && (
                        <td className="whitespace-nowrap px-7 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => startEditing(contract)}
                            aria-label={`Edit borongan ${contract.description}`}
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingContract(contract)}
                            aria-label={`Hapus borongan ${contract.description}`}
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50 text-sm font-bold">
                  <td colSpan={2} className="px-7 py-4 text-zinc-800">Total proyek</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-mono tabular-nums">{formatCurrency(contractTotal)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-mono tabular-nums text-emerald-700">{formatCurrency(paidTotal)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-mono tabular-nums text-amber-700">{formatCurrency(remainingTotal)}</td>
                  {data?.canManage && <td className="px-7 py-4" />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500 sm:px-7">
          Pembayaran lama dicocokkan otomatis. Untuk pembayaran baru, tautkan borongan terkait saat mencatat transaksi di Buku Kas.
        </div>
      </section>

      <DeleteConfirmDialog
        isOpen={Boolean(deletingContract)}
        onClose={() => setDeletingContract(null)}
        onConfirm={handleDelete}
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
