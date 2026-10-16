"use client";

import { useState, useEffect } from "react";
import { X, FileCheck, User, Calendar, DollarSign, Loader2, Check } from "lucide-react";

export interface ReimbursementFormData {
  id?: string;
  number: string;
  date: string;
  description: string;
  employee: string;
  amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED";
  paid_date: string | null;
}

interface ReimbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (claim: ReimbursementFormData) => void;
  claimToEdit?: ReimbursementFormData | null;
}

export function ReimbursementModal({
  isOpen,
  onClose,
  onSuccess,
  claimToEdit,
}: ReimbursementModalProps) {
  const isEditing = Boolean(claimToEdit && claimToEdit.id);

  const [formData, setFormData] = useState<ReimbursementFormData>({
    number: "",
    date: "",
    description: "",
    employee: "",
    amount: 0,
    status: "SUBMITTED",
    paid_date: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (claimToEdit) {
      setFormData({
        id: claimToEdit.id,
        number: claimToEdit.number || "",
        date: claimToEdit.date || "",
        description: claimToEdit.description || "",
        employee: claimToEdit.employee || "",
        amount: claimToEdit.amount || 0,
        status: claimToEdit.status || "SUBMITTED",
        paid_date: claimToEdit.paid_date || null,
      });
    } else {
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 9000) + 1000);
      setFormData({
        number: `RMB-${year}-${randNum}`,
        date: new Date().toISOString().split("T")[0],
        description: "",
        employee: "Amelia Putri (Interior Designer)",
        amount: 1500000,
        status: "SUBMITTED",
        paid_date: null,
      });
    }
    setErrorMsg(null);
  }, [claimToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.employee.trim()) {
      setErrorMsg("Claimant name and purpose are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      onSuccess(formData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save claim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200/90 bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Reimbursement Claim" : "File Expense Claim"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Update claimant information, expenditure amount, and settlement status"
                : "Submit an operational out-of-pocket claim for authorization"}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Claim Ref */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Claim Reference
              </label>
              <input
                type="text"
                disabled
                value={formData.number}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 font-mono text-xs font-semibold text-zinc-500 cursor-not-allowed"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Claim Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="SUBMITTED">SUBMITTED (Pending Review)</option>
                <option value="APPROVED">APPROVED (Authorized for Payout)</option>
                <option value="PAID">PAID (Settled to Staff)</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Purpose &amp; Description *
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="e.g. Fuel and highway toll for BSD Tangerang site inspection"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Claimant */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Employee / Claimant *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                required
                value={formData.employee}
                onChange={(e) =>
                  setFormData({ ...formData, employee: e.target.value })
                }
                placeholder="e.g. Rian Pratama (Lead Architect)"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Claim Date
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Disbursement Amount (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={formData.amount || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: Number(e.target.value) || 0 })
                  }
                  placeholder="650000"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? "Save Changes" : "Submit Claim"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
