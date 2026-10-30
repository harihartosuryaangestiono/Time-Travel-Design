"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { deleteCashBookTransaction, updateCashBookTransaction } from "@/app/actions/cashBookActions";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import type { CashBookEntry } from "@/lib/validation/cashBook";
import {
  GENERAL_EXPENSE_CATEGORIES,
  PROJECT_EXPENSE_CATEGORIES,
} from "@/lib/accounting/expenseCategories";

interface CashBookEntryEditorProps {
  entry: CashBookEntry;
  projects: Array<{ id: string; name: string; code: string }>;
  startWithDelete?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}

const INCOME_CATEGORIES = ["Setoran Modal", "Bunga Bank", "Pemasukan Lainnya"];

export function CashBookEntryEditor({
  entry,
  projects,
  startWithDelete = false,
  onClose,
  onSaved,
  onDeleted,
}: CashBookEntryEditorProps) {
  const isExpense = entry.source_type === "CASH_BOOK_EXPENSE";
  const isProjectRevenue = entry.source_type === "PROJECT_REVENUE";
  const isSalesCommissionExpense =
    isExpense && entry.category === "Marketing & Sales" && Boolean(entry.sales_person_id);
  const [date, setDate] = useState(entry.date);
  const [description, setDescription] = useState(entry.description);
  const [category, setCategory] = useState(
    isProjectRevenue ? "Pendapatan Proyek" : entry.category
  );
  const [amount, setAmount] = useState(String(isExpense ? entry.kredit : entry.debit));
  const [projectId, setProjectId] = useState(entry.project_id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(startWithDelete);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<"first" | "final">("first");
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = isExpense
    ? category === "Marketing & Sales"
      ? GENERAL_EXPENSE_CATEGORIES
      : projectId
        ? PROJECT_EXPENSE_CATEGORIES
        : GENERAL_EXPENSE_CATEGORIES
    : INCOME_CATEGORIES;

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await updateCashBookTransaction({
        id: entry.id,
        source_type: entry.source_type as "CASH_BOOK_EXPENSE" | "PROJECT_REVENUE" | "CASH_RECEIPT",
        date,
        description,
        category: isProjectRevenue ? "Pendapatan Proyek" : category,
        amount: Number(amount),
        project_id: isExpense || isProjectRevenue ? projectId || null : null,
      });
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan perubahan transaksi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmationStep === "first") {
      setDeleteConfirmationStep("final");
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteCashBookTransaction(
        entry.source_type as "CASH_BOOK_EXPENSE" | "PROJECT_REVENUE" | "CASH_RECEIPT",
        entry.id
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      await onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus transaksi.");
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
      setDeleteConfirmationStep("first");
    }
  };

  const closeDeleteConfirmation = () => {
    if (isDeleting) return;
    setIsDeleteConfirmOpen(false);
    setDeleteConfirmationStep("first");
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <form
          onSubmit={handleSave}
          className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl sm:p-6"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isDeleting}
            aria-label="Tutup form edit transaksi"
            className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mb-5 pr-10">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
              <Pencil className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-zinc-950">Edit Transaksi Buku Kas</h2>
            <p className="mt-1 text-xs text-zinc-500">{entry.description}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Tanggal
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
              Nominal (Rp)
              <input
                type="number"
                min="1"
                step="1"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm tabular-nums"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-zinc-700 sm:col-span-2">
              Keterangan Transaksi
              <input
                type="text"
                required
                maxLength={200}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            {!isProjectRevenue && (
              <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
                Kategori
                <select
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                >
                  <option value="">Pilih kategori</option>
                  {category && !(categoryOptions as readonly string[]).includes(category) && (
                    <option value={category}>{category}</option>
                  )}
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            )}
            {(isExpense || isProjectRevenue) && (
              isSalesCommissionExpense ? (
                <div className="space-y-1.5 text-xs font-semibold text-zinc-700">
                  Proyek &amp; Sales Person
                  <div className="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                    {projects.find((project) => project.id === projectId)?.name || "Proyek tidak ditemukan"}
                    {entry.sales_person_name ? ` — ${entry.sales_person_name}` : ""}
                  </div>
                </div>
              ) : (
                <label className="space-y-1.5 text-xs font-semibold text-zinc-700">
                  Proyek
                  <select
                    required={isProjectRevenue}
                    value={projectId}
                    onChange={(event) => {
                      setProjectId(event.target.value);
                      if (isExpense) setCategory("");
                    }}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                  >
                    {!isProjectRevenue && <option value="">Pengeluaran Umum</option>}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.code} — {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              )
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmationStep("first");
                setIsDeleteConfirmOpen(true);
              }}
              disabled={isSaving || isDeleting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus transaksi
            </button>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="h-10 rounded-lg border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isSaving ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <DeleteConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDelete}
        title={deleteConfirmationStep === "first" ? "Apakah Anda yakin ingin menghapus transaksi ini?" : "Konfirmasi terakhir"}
        description={
          deleteConfirmationStep === "first"
            ? "Periksa kembali transaksi yang dipilih. Tekan lanjutkan untuk masuk ke verifikasi kedua."
            : "Transaksi ini akan dihapus permanen dari Buku Kas. Dampak jurnal akan dibalik agar laporan keuangan tetap konsisten. Apakah Anda benar-benar ingin melanjutkan?"
        }
        itemName={entry.description}
        isDeleting={isDeleting}
        confirmLabel={deleteConfirmationStep === "first" ? "Ya, lanjutkan" : "Ya, hapus transaksi"}
        deletingLabel="Menghapus..."
        cancelLabel="Batal"
      />
    </>
  );
}
