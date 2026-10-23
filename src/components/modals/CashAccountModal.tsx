"use client";

import { useState, useEffect } from "react";
import { X, Wallet, Building2, CreditCard, DollarSign, Loader2, Check } from "lucide-react";
import { createCashAccountRecord, updateCashAccountRecord } from "@/app/actions/cashAccountActions";
import { FormField } from "@/components/ui/FormField";

export interface CashAccountFormData {
  id?: string;
  name: string;
  type: string;
  bank_name: string;
  account_number: string;
  opening_balance: number;
}

interface CashAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: CashAccountFormData) => void;
  accountToEdit?: CashAccountFormData | null;
}

export function CashAccountModal({
  isOpen,
  onClose,
  onSuccess,
  accountToEdit,
}: CashAccountModalProps) {
  const isEditing = Boolean(accountToEdit && accountToEdit.id);

  const [formData, setFormData] = useState<CashAccountFormData>({
    name: "",
    type: "BANK",
    bank_name: "Bank Central Asia (BCA)",
    account_number: "",
    opening_balance: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (accountToEdit) {
      setFormData({
        id: accountToEdit.id,
        name: accountToEdit.name || "",
        type: accountToEdit.type || "BANK",
        bank_name: accountToEdit.bank_name || "Bank Central Asia (BCA)",
        account_number: accountToEdit.account_number || "",
        opening_balance: accountToEdit.opening_balance || 0,
      });
      setFormData({
        name: "",
        type: "BANK",
        bank_name: "Bank Central Asia (BCA)",
        account_number: "",
        opening_balance: 0,
      });
    }
    setErrorMsg(null);
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Nama akun kas/bank wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let savedRecord: any = null;
      if (isEditing && formData.id) {
        savedRecord = await updateCashAccountRecord(formData.id, {
          name: formData.name,
          type: formData.type as "BANK" | "CASH",
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          opening_balance: Number(formData.opening_balance) || 0,
        });
      } else {
        savedRecord = await createCashAccountRecord({
          name: formData.name,
          type: formData.type as "BANK" | "CASH",
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          opening_balance: Number(formData.opening_balance) || 0,
        });
      }

      onSuccess(savedRecord || formData);
      onClose();
    } catch (err: any) {
      console.error("Cash Account server action error:", err);
      setErrorMsg(err?.message || "Gagal menyimpan akun kas/bank.");
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
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              {isEditing ? "Edit Treasury Account" : "Register Treasury Account"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Update account identification, vault limit, and ledger details"
                : "Add a commercial bank checking account or petty cash vault"}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Name */}
          <FormField id="cash-account-name" label="Nama akun kas / rekening" required>
            <input
              id="cash-account-name"
              type="text"
              required
              maxLength={100}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: BCA Operasional atau Kas Kecil"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account Type */}
            <FormField id="cash-account-type" label="Jenis akun">
              <select
                id="cash-account-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value,
                    bank_name:
                      e.target.value === "CASH"
                        ? "Studio Cash Vault"
                        : "Bank Central Asia (BCA)",
                  })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="BANK">Rekening bank</option>
                <option value="CASH">Kas tunai</option>
              </select>
            </FormField>

            {/* Institution / Bank */}
            <FormField id="cash-account-bank" label="Nama bank / lembaga keuangan">
              <input
                id="cash-account-bank"
                type="text"
                maxLength={100}
                value={formData.bank_name}
                onChange={(e) =>
                  setFormData({ ...formData, bank_name: e.target.value })
                }
                placeholder="e.g. Bank Central Asia (BCA)"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account / Vault ID */}
            <FormField id="cash-account-number" label="Nomor rekening / referensi">
              <input
                id="cash-account-number"
                type="text"
                maxLength={50}
                value={formData.account_number}
                onChange={(e) =>
                  setFormData({ ...formData, account_number: e.target.value })
                }
                placeholder="Contoh: 8912334401 atau KAS-01"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </FormField>

            {/* Opening Balance */}
            <FormField
              id="cash-account-opening-balance"
              label="Saldo awal (IDR)"
              hint="Saldo pada tanggal mulai pencatatan. Gunakan 0 jika belum ada saldo."
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  id="cash-account-opening-balance"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.opening_balance || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      opening_balance: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="100000000"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </FormField>
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
                  <span>{isEditing ? "Save Changes" : "Create Account"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
