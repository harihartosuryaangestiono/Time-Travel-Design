"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  deleteSubcontractor,
  getSubcontractors,
  saveSubcontractor,
} from "@/app/actions/subcontractorActions";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";

type SubcontractorData = Awaited<ReturnType<typeof getSubcontractors>>;
type Subcontractor = SubcontractorData["subcontractors"][number];

export default function SubcontractorsPage() {
  const [data, setData] = useState<SubcontractorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subcontractor | null>(null);
  const [deleting, setDeleting] = useState<Subcontractor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setData(await getSubcontractors());
    } catch (err) {
      console.error("Gagal memuat data subkontraktor:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat data subkontraktor.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openForm = (subcontractor?: Subcontractor) => {
    setEditing(subcontractor || null);
    setName(subcontractor?.name || "");
    setEmail(subcontractor?.email || "");
    setPhone(subcontractor?.phone || "");
    setAddress(subcontractor?.address || "");
    setError(null);
    setFormOpen(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      await saveSubcontractor({
        id: editing?.id,
        name,
        email,
        phone,
        address,
      });
      setFormOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Gagal menyimpan data subkontraktor:", err);
      setError(err instanceof Error ? err.message : "Gagal menyimpan data subkontraktor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      setIsDeleting(true);
      setError(null);
      await deleteSubcontractor(deleting.id);
      setDeleting(null);
      await fetchData();
    } catch (err) {
      console.error("Gagal menghapus data subkontraktor:", err);
      setDeleting(null);
      setError(err instanceof Error ? err.message : "Gagal menghapus data subkontraktor.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">Data Subkontraktor</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Kelola daftar subkontraktor khusus. Data ini terpisah dari Vendors &amp; Partners.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/subcontractor-recap" className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
            Lihat Rekap Borongan
          </Link>
          {data?.canManage && (
            <button type="button" onClick={() => openForm()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black">
              <Plus className="h-4 w-4" />
              Tambah Subkontraktor
            </button>
          )}
        </div>
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

      {formOpen && (
        <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-950">{editing ? "Edit Subkontraktor" : "Subkontraktor Baru"}</h3>
            <button type="button" onClick={() => setFormOpen(false)} aria-label="Tutup form" className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-600">
              Nama subkontraktor *
              <input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama orang atau badan usaha" className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-normal text-zinc-900" />
            </label>
            <label className="text-xs font-semibold text-zinc-600">
              Telepon / WhatsApp
              <input maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-normal text-zinc-900" />
            </label>
            <label className="text-xs font-semibold text-zinc-600">
              Email (opsional)
              <input type="text" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com (boleh dikosongkan)" className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-normal text-zinc-900" />
            </label>
            <label className="text-xs font-semibold text-zinc-600">
              Alamat (opsional)
              <input maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Alamat subkontraktor" className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-normal text-zinc-900" />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button type="button" onClick={() => setFormOpen(false)} disabled={isSaving} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">Batal</button>
            <button type="submit" disabled={isSaving} className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50">
              {isSaving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan Subkontraktor"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Daftar Subkontraktor</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">Pilihan di sini akan digunakan pada pencatatan borongan.</p>
          </div>
          <span className="text-xs text-zinc-400">{data?.subcontractors.length || 0} data</span>
        </div>
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <th className="pb-3 pl-2">Nama</th>
              <th className="pb-3">Telepon</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Alamat</th>
              {data?.canManage && <th className="pb-3 pr-2 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr><td colSpan={data?.canManage ? 5 : 4} className="py-10 text-center text-zinc-400">Memuat data...</td></tr>
            ) : !data?.subcontractors.length ? (
              <tr>
                <td colSpan={data?.canManage ? 5 : 4} className="py-10 text-center text-zinc-500">
                  <Building2 className="mx-auto mb-2 h-5 w-5 text-zinc-300" />
                  Belum ada data subkontraktor.
                </td>
              </tr>
            ) : data.subcontractors.map((subcontractor) => (
              <tr key={subcontractor.id} className="hover:bg-zinc-50">
                <td className="py-3 pl-2 font-semibold text-zinc-900">{subcontractor.name}</td>
                <td className="py-3 text-zinc-600">{subcontractor.phone || "—"}</td>
                <td className="py-3 text-zinc-600">{subcontractor.email || "—"}</td>
                <td className="py-3 text-zinc-600">{subcontractor.address || "—"}</td>
                {data.canManage && (
                  <td className="py-3 pr-2 text-right">
                    <button type="button" onClick={() => openForm(subcontractor)} aria-label={`Edit ${subcontractor.name}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeleting(subcontractor)} aria-label={`Hapus ${subcontractor.name}`} className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-50 hover:text-rose-700">
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
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Hapus data subkontraktor?"
        description="Data yang sudah digunakan pada kontrak borongan tidak dapat dihapus."
        itemName={deleting?.name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
