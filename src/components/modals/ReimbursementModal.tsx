"use client";

import { useState, useEffect } from "react";
import { X, FileCheck, User, Calendar, DollarSign, Loader2, Check } from "lucide-react";
import { saveReimbursementRecord } from "@/app/actions/reimbursementActions";
import { createClient } from "@/lib/supabase/client";

export interface ReimbursementFormData {
  id?: string;
  number: string;
  date: string;
  description: string;
  employee_id?: string;
  employee: string;
  amount: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  paid_date: string | null;
}

interface ReimbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (claim: any) => void;
  claimToEdit?: ReimbursementFormData | null;
}

interface ProfileOption {
  id: string;
  full_name: string | null;
  email: string | null;
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
    date: new Date().toISOString().split("T")[0],
    description: "",
    employee_id: "",
    employee: "",
    amount: 0,
    status: "SUBMITTED",
    paid_date: null,
  });

  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .order("full_name");
        if (data) {
          setProfiles(data);
        }
      } catch (e) {
        console.warn("Gagal memuat profil anggota:", e);
      }
    }
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (claimToEdit) {
      setFormData({
        id: claimToEdit.id,
        number: claimToEdit.number || "",
        date: claimToEdit.date ? claimToEdit.date.split("T")[0] : new Date().toISOString().split("T")[0],
        description: claimToEdit.description || "",
        employee_id: claimToEdit.employee_id || "",
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
        employee_id: "",
        employee: "",
        amount: 0,
        status: "SUBMITTED",
        paid_date: null,
      });
    }
    setErrorMsg(null);
  }, [claimToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setErrorMsg("Keterangan reimbursement wajib diisi.");
      return;
    }
    if (formData.amount <= 0) {
      setErrorMsg("Nominal klaim harus lebih besar dari 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const saved = await saveReimbursementRecord({
        id: formData.id,
        number: formData.number,
        date: formData.date,
        description: formData.description.trim(),
        amount: formData.amount,
        status: formData.status,
        employee_id: formData.employee_id || undefined,
      });

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan klaim reimbursement.");
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
              {isEditing ? "Edit Klaim Reimbursement" : "Pengajuan Klaim Reimbursement"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isEditing
                ? "Perbarui rincian klaim, nominal, dan status pencairan"
                : "Catat pengeluaran operasional staf untuk disetujui dan dicairkan"}
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
                Nomor Referensi
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
                Status Klaim
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED (Menunggu Review)</option>
                <option value="APPROVED">APPROVED (Disetujui)</option>
                <option value="PAID">PAID (Sudah Dicairkan)</option>
                <option value="REJECTED">REJECTED (Ditolak)</option>
                <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Keperluan &amp; Keterangan *
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Contoh: Pembelian tinta plotter dan drafting paper"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Claimant */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Pemohon / Anggota Tim
            </label>
            {profiles.length > 0 ? (
              <select
                value={formData.employee_id}
                onChange={(e) => {
                  const sel = profiles.find((p) => p.id === e.target.value);
                  setFormData({
                    ...formData,
                    employee_id: e.target.value,
                    employee: sel?.full_name || sel?.email || "",
                  });
                }}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="">Pilih anggota tim (default: akun saat ini)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.employee}
                  onChange={(e) =>
                    setFormData({ ...formData, employee: e.target.value })
                  }
                  placeholder="Nama pemohon klaim"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Tanggal Klaim
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
                Nominal Klaim (IDR) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={formData.amount || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: Number(e.target.value) || 0 })
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
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? "Simpan Perubahan" : "Ajukan Klaim"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
