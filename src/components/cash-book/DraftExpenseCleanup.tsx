"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import {
  deleteOrganizationDraftExpenses,
  getDraftExpenseCleanupPreview,
} from "@/app/actions/draftExpenseCleanupActions";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DraftExpenseCleanup() {
  const [preview, setPreview] = useState<{ count: number; totalAmount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshPreview = useCallback(async () => {
    try {
      setError(null);
      setPreview(await getDraftExpenseCleanupPreview());
    } catch (err) {
      console.error("Gagal memuat pratinjau voucher Draft:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat pratinjau voucher Draft.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const handleDelete = async () => {
    if (!preview?.count) return;

    try {
      setIsDeleting(true);
      setError(null);
      const result = await deleteOrganizationDraftExpenses();
      setShowConfirmation(false);
      setMessage(`${result.deletedCount} voucher Draft berhasil dihapus.`);
      await refreshPreview();
    } catch (err) {
      console.error("Gagal menghapus voucher Draft:", err);
      setError(err instanceof Error ? err.message : "Gagal menghapus voucher Draft.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || (!preview && !error) || (!preview?.count && !error && !message)) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <p className="text-xs font-bold text-amber-950">Voucher Draft lama</p>
          {preview?.count ? (
            <p className="mt-0.5 text-[11px] text-amber-800">
              {preview.count} voucher, total {formatCurrency(preview.totalAmount)}. Draft tidak masuk ke Buku Kas.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-amber-800">{message || "Tidak ada voucher Draft tersisa."}</p>
          )}
          {error && <p className="mt-1 text-[11px] font-medium text-red-700">{error}</p>}
        </div>
      </div>
      {preview?.count ? (
        <button
          type="button"
          onClick={() => setShowConfirmation(true)}
          disabled={isDeleting}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Hapus Semua Draft
        </button>
      ) : error ? (
        <button type="button" onClick={() => void refreshPreview()} className="text-xs font-semibold text-red-800 underline">
          Coba lagi
        </button>
      ) : null}
      {showConfirmation && preview?.count ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm"
          onClick={() => !isDeleting && setShowConfirmation(false)}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="draft-cleanup-title"
            aria-describedby="draft-cleanup-description"
            className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Tutup konfirmasi"
              onClick={() => setShowConfirmation(false)}
              disabled={isDeleting}
              className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-4 pr-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 id="draft-cleanup-title" className="text-base font-bold text-zinc-950">
                  Hapus semua voucher Draft?
                </h3>
                <p id="draft-cleanup-description" className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Penghapusan ini permanen dan tidak bisa dibatalkan. Transaksi yang sudah dibayar tidak akan terpengaruh.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Jumlah voucher</p>
                <p className="mt-1 text-lg font-bold text-zinc-950">{preview.count}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Total nominal</p>
                <p className="mt-1 text-sm font-bold text-rose-800">{formatCurrency(preview.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                disabled={isDeleting}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus permanen
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
