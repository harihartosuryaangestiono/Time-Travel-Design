"use client";

import { useState, useEffect } from "react";
import { X, Coins, User, Calendar, DollarSign, Loader2, Check } from "lucide-react";

export interface CashAdvanceFormData {
  id?: string;
  number: string;
  date: string;
  purpose: string;
  employee: string;
  amount: number;
  disbursed_amount: number;
  settled_amount: number;
  returned_amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "DISBURSED" | "PARTIALLY_SETTLED" | "SETTLED";
}

interface CashAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (advance: CashAdvanceFormData) => void;
  advanceToEdit?: CashAdvanceFormData | null;
}

export function CashAdvanceModal({
  isOpen,
  onClose,
  onSuccess,
  advanceToEdit,
}: CashAdvanceModalProps) {
  const isEditing = Boolean(advanceToEdit && advanceToEdit.id);

  const [formData, setFormData] = useState<CashAdvanceFormData>({
    number: "",
    date: "",
    purpose: "",
    employee: "",
    amount: 0,
    disbursed_amount: 0,
    settled_amount: 0,
    returned_amount: 0,
    status: "DISBURSED",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (advanceToEdit) {
      setFormData({
        id: advanceToEdit.id,
        number: advanceToEdit.number || "",
        date: advanceToEdit.date || "",
        purpose: advanceToEdit.purpose || "",
        employee: advanceToEdit.employee || "",
        amount: advanceToEdit.amount || 0,
        disbursed_amount: advanceToEdit.disbursed_amount || 0,
        settled_amount: advanceToEdit.settled_amount || 0,
        returned_amount: advanceToEdit.returned_amount || 0,
        status: advanceToEdit.status || "DISBURSED",
      });
    } else {
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 9000) + 1000);
      setFormData({
        number: `CA-${year}-${randNum}`,
        date: new Date().toISOString().split("T")[0],
        purpose: "",
        employee: "Rian Pratama (Lead Architect)",
        amount: 5000000,
        disbursed_amount: 5000000,
        settled_amount: 0,
        returned_amount: 0,
        status: "DISBURSED",
      });
    }
    setErrorMsg(null);
  }, [advanceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.purpose.trim() || !formData.employee.trim()) {
      setErrorMsg("Recipient employee and operational purpose are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      onSuccess(formData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save cash advance.");
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
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Cash Advance" : "Disburse Cash Advance"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Update advance voucher lines, settlement tracking, and recipient"
                : "Record an operational site disbursement or project advance"}
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
            {/* Advance Ref */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Advance Reference
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
                Disbursement Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="DISBURSED">DISBURSED (Funds Released)</option>
                <option value="PARTIALLY_SETTLED">PARTIALLY_SETTLED (Receipts Pending)</option>
                <option value="SETTLED">SETTLED (Reconciled 100%)</option>
                <option value="SUBMITTED">SUBMITTED (Pending Payout)</option>
              </select>
            </div>
          </div>

          {/* Operational Purpose */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Operational Purpose &amp; Scope *
            </label>
            <input
              type="text"
              required
              value={formData.purpose}
              onChange={(e) =>
                setFormData({ ...formData, purpose: e.target.value })
              }
              placeholder="e.g. Site inspection & contractor liaison for Bali Luxury Villa project"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Recipient */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Recipient Employee *
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
                Disbursement Date
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Disbursed Amount */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Disbursed Amount (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={formData.disbursed_amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      disbursed_amount: Number(e.target.value) || 0,
                      amount: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="5000000"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Settled Amount */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Receipts Settled (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={formData.settled_amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      settled_amount: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Returned Cash */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Unspent Cash Returned (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={formData.returned_amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      returned_amount: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
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
                  <span>{isEditing ? "Save Changes" : "Disburse Advance"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
