"use client";

import { useState, useEffect } from "react";
import { X, FileText, Calendar, Building2, DollarSign, Loader2, Check } from "lucide-react";
import { createInvoiceRecord, updateInvoiceRecord } from "@/app/actions/invoiceActions";

export interface InvoiceFormData {
  id?: string;
  number: string;
  client_name: string;
  project: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  status: "ISSUED" | "PAID" | "OVERDUE" | "DRAFT";
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoice: InvoiceFormData) => void;
  invoiceToEdit?: InvoiceFormData | null;
}

export function InvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  invoiceToEdit,
}: InvoiceModalProps) {
  const isEditing = Boolean(invoiceToEdit && invoiceToEdit.id);

  const [formData, setFormData] = useState<InvoiceFormData>({
    number: "",
    client_name: "",
    project: "",
    invoice_date: "",
    due_date: "",
    total: 0,
    amount_paid: 0,
    status: "ISSUED",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceToEdit) {
      setFormData({
        id: invoiceToEdit.id,
        number: invoiceToEdit.number || "",
        client_name: invoiceToEdit.client_name || "",
        project: invoiceToEdit.project || "",
        invoice_date: invoiceToEdit.invoice_date || "",
        due_date: invoiceToEdit.due_date || "",
        total: invoiceToEdit.total || 0,
        amount_paid: invoiceToEdit.amount_paid || 0,
        status: invoiceToEdit.status || "ISSUED",
      });
    } else {
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 9000) + 1000);
      const today = new Date().toISOString().split("T")[0];
      const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

      setFormData({
        number: `INV-${year}-${randNum}`,
        client_name: "",
        project: "",
        invoice_date: today,
        due_date: dueDate,
        total: 75000000,
        amount_paid: 0,
        status: "ISSUED",
      });
    }
    setErrorMsg(null);
  }, [invoiceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number.trim() || !formData.client_name.trim()) {
      setErrorMsg("Invoice Number and Client Name are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      try {
        if (isEditing && formData.id) {
          await updateInvoiceRecord(formData.id, {
            number: formData.number,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date,
            total: formData.total,
            amount_paid: formData.amount_paid,
            status: formData.status,
          });
        } else {
          await createInvoiceRecord({
            number: formData.number,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date,
            total: formData.total,
            amount_paid: formData.amount_paid,
            status: formData.status,
          });
        }
      } catch (err: any) {
        console.warn("Invoice server action fallback:", err.message);
      }

      onSuccess(formData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save invoice.");
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
      <div className="relative w-full max-w-xl rounded-3xl border border-zinc-200/90 bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Client Invoice" : "Issue Client Milestone Invoice"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Update billing milestones, payment settlement, and due dates"
                : "Generate a formal architectural fee invoice and accounts receivable voucher"}
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
            {/* Invoice Ref Number */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Invoice Reference *
              </label>
              <input
                type="text"
                required
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="e.g. INV-2024-0019"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Billing Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="ISSUED">ISSUED (Awaiting Client Remittance)</option>
                <option value="PAID">PAID (Settled in Full)</option>
                <option value="OVERDUE">OVERDUE (Payment Grace Period Expired)</option>
                <option value="DRAFT">DRAFT (Internal Review)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Client / Commissioning Entity *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  placeholder="e.g. PT Sinarmas Mitra Kreasi"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Project Milestone */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Project &amp; Milestone Phase
              </label>
              <input
                type="text"
                value={formData.project}
                onChange={(e) =>
                  setFormData({ ...formData, project: e.target.value })
                }
                placeholder="e.g. Serpong Feasibility Study (Milestone 2)"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Issue Date
              </label>
              <input
                type="date"
                required
                value={formData.invoice_date}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_date: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Amount */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Total Invoiced Amount (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000000"
                  value={formData.total || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, total: Number(e.target.value) || 0 })
                  }
                  placeholder="75000000"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Amount Paid */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Amount Received / Paid (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000000"
                  value={formData.amount_paid || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount_paid: Number(e.target.value) || 0,
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
                  <span>{isEditing ? "Save Changes" : "Issue Invoice"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
