"use client";

import { useState, useEffect } from "react";
import { X, Receipt, Tag, Building2, Calendar, DollarSign, Loader2, Check } from "lucide-react";
import { createExpense, updateExpense } from "@/app/actions/expenseActions";

export interface ExpenseFormData {
  id?: string;
  number: string;
  date: string;
  description: string;
  merchant: string | null;
  category: string;
  total_amount: number;
  status: "POSTED" | "APPROVED" | "SUBMITTED" | "DRAFT" | "REJECTED";
  project_id?: string | null;
  cash_account_id?: string | null;
}

interface ExpenseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (expense: ExpenseFormData) => void;
  expenseToEdit?: ExpenseFormData | null;
  projects: Array<{ id: string; name: string; code: string }>;
  accounts: Array<{ id: string; name: string }>;
}

export function ExpenseEditModal({
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
  projects,
  accounts,
}: ExpenseEditModalProps) {
  const isEditing = Boolean(expenseToEdit && expenseToEdit.id);

  const [formData, setFormData] = useState<ExpenseFormData>({
    number: "",
    date: "",
    description: "",
    merchant: "",
    category: "Project Material",
    total_amount: 0,
    status: "POSTED",
    project_id: "",
    cash_account_id: "",
  });

  const [originalProjectId, setOriginalProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setFormData({
        id: expenseToEdit.id,
        number: expenseToEdit.number || "",
        date: expenseToEdit.date || "",
        description: expenseToEdit.description || "",
        merchant: expenseToEdit.merchant || "",
        category: expenseToEdit.category || "Project Material",
        total_amount: expenseToEdit.total_amount || 0,
        status: expenseToEdit.status || "POSTED",
        project_id: expenseToEdit.project_id || "",
        cash_account_id: expenseToEdit.cash_account_id || "",
      });
      setOriginalProjectId(expenseToEdit.project_id || "");
    } else {
      const year = new Date().getFullYear();
      const randNum = String(Math.floor(Math.random() * 9000) + 1000);
      setFormData({
        number: `EXP-${year}-${randNum}`,
        date: new Date().toISOString().split("T")[0],
        description: "",
        merchant: "",
        category: "Project Material",
        total_amount: 0,
        status: "POSTED",
        project_id: "",
        cash_account_id: "",
      });
      setOriginalProjectId("");
    }
    setErrorMsg(null);
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setErrorMsg("Expense Description & Purpose is required.");
      return;
    }
    if (formData.total_amount <= 0) {
      setErrorMsg("Nominal pengeluaran harus lebih besar dari 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (isEditing && formData.id) {
        await updateExpense(formData.id, {
          date: formData.date,
          description: formData.description,
          merchant: formData.merchant || undefined,
          category: formData.category,
          amount: formData.total_amount,
          cash_account_id: formData.cash_account_id || undefined,
          ...(formData.project_id !== originalProjectId
            ? {
                project_allocations: formData.project_id
                  ? [{
                      project_id: formData.project_id,
                      amount: formData.total_amount,
                      description: formData.description,
                    }]
                  : [],
              }
            : {}),
        });
      } else {
        const createdExpense = await createExpense({
          date: formData.date,
          description: formData.description,
          merchant: formData.merchant || undefined,
          category: formData.category,
          amount: formData.total_amount,
          cash_account_id: formData.cash_account_id || undefined,
          project_allocations: formData.project_id
            ? [{
                project_id: formData.project_id,
                amount: formData.total_amount,
                description: formData.description,
              }]
            : [],
        });
        formData.id = createdExpense.id;
        formData.number = createdExpense.number;
        formData.status = "DRAFT";
      }

      onSuccess(formData);
      onClose();
    } catch (err: any) {
      console.error("Expense update error:", err);
      setErrorMsg(err?.message || "Gagal memperbarui data pengeluaran.");
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
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Expense Voucher" : "Direct Expense Voucher"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Update voucher disbursement lines, vendor payee, and classification"
                : "Create a direct accounting expense record"}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="expense-cash-account" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
            Dibayar dari rekening / kas
          </label>
          <select
            id="expense-cash-account"
            value={formData.cash_account_id || ""}
            onChange={(e) => setFormData({ ...formData, cash_account_id: e.target.value })}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
          >
            <option value="">Belum dibayar / belum ditentukan</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Voucher Ref */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Voucher Reference
              </label>
              <input
                type="text"
                disabled
                value={formData.number}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 font-mono text-xs font-semibold text-zinc-500 cursor-not-allowed"
              />
            </div>

          </div>

          <div>
            <label htmlFor="expense-project" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Proyek
            </label>
            <select
              id="expense-project"
              value={formData.project_id || ""}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            >
              <option value="">Pengeluaran operasional (tanpa proyek)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-zinc-500">
              Pengeluaran yang dialokasikan ke proyek akan masuk ke realisasi biaya proyek.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Description &amp; Purpose *
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="e.g. Carrara marble procurement for Villa Canggu project"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payee / Vendor */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Payee / Vendor Entity
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.merchant || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, merchant: e.target.value })
                  }
                  placeholder="e.g. PT Marmer Indah Sentosa"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Expense Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="Project Material">Project Material</option>
                <option value="Subcontractor">Subcontractor</option>
                <option value="Rent & Utilities">Rent &amp; Utilities</option>
                <option value="Software & CAD">Software &amp; CAD</option>
                <option value="Travel & Survey">Travel &amp; Survey</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Transaction Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Total Amount */}
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
                  min="1"
                  step="50000"
                  required
                  value={formData.total_amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_amount: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="32500000"
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
                  <span>{isEditing ? "Save Changes" : "Save Voucher"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
