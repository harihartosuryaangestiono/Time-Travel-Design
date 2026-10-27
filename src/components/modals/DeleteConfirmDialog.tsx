"use client";

import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  itemName?: string;
  isDeleting?: boolean;
  confirmLabel?: string;
  deletingLabel?: string;
  cancelLabel?: string;
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  isDeleting = false,
  confirmLabel = "Confirm Deletion",
  deletingLabel = "Deleting...",
  cancelLabel = "Cancel",
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="space-y-1 pr-4">
            <h3 className="text-base font-bold text-zinc-950">{title}</h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              {description}
            </p>
            {itemName && (
              <div className="mt-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs font-semibold text-zinc-800">
                {itemName}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{deletingLabel}</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
