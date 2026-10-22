"use client";

import { useState, useEffect } from "react";
import { saveCashAdvanceRecord, checkAdvanceLimit } from "@/app/actions/cashAdvanceActions";
import { getProjects } from "@/app/actions/projectActions";
import { X, Coins, User, Calendar, HardHat, AlertTriangle, Loader2, Check } from "lucide-react";

export interface CashAdvanceFormData {
  id?: string;
  number: string;
  date: string;
  advance_type?: "EMPLOYEE" | "MANDOR";
  purpose: string;
  employee: string;
  mandor_name?: string;
  project_id?: string;
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
    advance_type: "EMPLOYEE",
    purpose: "",
    employee: "",
    mandor_name: "",
    project_id: "",
    amount: 0,
    disbursed_amount: 0,
    settled_amount: 0,
    returned_amount: 0,
    status: "DISBURSED",
  });

  const [projects, setProjects] = useState<Array<{ id: string; name: string; labor_advance_limit?: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getProjects()
        .then((data) => {
          if (data) {
            setProjects(
              data.map((p: any) => ({
                id: p.id,
                name: p.name,
                labor_advance_limit: parseFloat(p.labor_advance_limit || "0") || 0,
              }))
            );
          }
        })
        .catch((err) => console.error("Error loading projects:", err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (advanceToEdit) {
      setFormData({
        id: advanceToEdit.id,
        number: advanceToEdit.number || "",
        date: advanceToEdit.date || "",
        advance_type: advanceToEdit.advance_type || "EMPLOYEE",
        purpose: advanceToEdit.purpose || "",
        employee: advanceToEdit.employee || "",
        mandor_name: advanceToEdit.mandor_name || "",
        project_id: advanceToEdit.project_id || "",
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
        advance_type: "EMPLOYEE",
        purpose: "",
        employee: "",
        mandor_name: "",
        project_id: "",
        amount: 0,
        disbursed_amount: 0,
        settled_amount: 0,
        returned_amount: 0,
        status: "DISBURSED",
      });
    }
    setErrorMsg(null);
    setLimitWarning(null);
  }, [advanceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAmountChange = async (val: number) => {
    setFormData((prev) => ({
      ...prev,
      amount: val,
      disbursed_amount: val,
    }));

    if (val > 0) {
      try {
        const check = await checkAdvanceLimit({
          advance_type: formData.advance_type || "EMPLOYEE",
          project_id: formData.project_id || undefined,
          proposed_amount: val,
          exclude_advance_id: formData.id,
        });

        if (check.isExceeded) {
          setLimitWarning(check.message);
        } else {
          setLimitWarning(null);
        }
      } catch (err) {
        // Abaikan jika auth gagal di client side checking
      }
    } else {
      setLimitWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isMandor = formData.advance_type === "MANDOR";
    const recipientName = isMandor ? formData.mandor_name : formData.employee;

    if (!recipientName?.trim()) {
      setErrorMsg(isMandor ? "Nama mandor wajib diisi." : "Nama karyawan penerima wajib diisi.");
      return;
    }

    if (isMandor && !formData.project_id) {
      setErrorMsg("Kasbon mandor (Upah Tukang) wajib memilih proyek terkait.");
      return;
    }

    if (!formData.purpose.trim()) {
      setErrorMsg("Tujuan operasional kasbon wajib diisi.");
      return;
    }

    const amt = Number(formData.amount) || Number(formData.disbursed_amount) || 0;
    if (amt <= 0) {
      setErrorMsg("Nominal kasbon harus lebih dari 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const saved = await saveCashAdvanceRecord({
        id: formData.id,
        number: formData.number,
        date: formData.date,
        advance_type: formData.advance_type || "EMPLOYEE",
        mandor_name: isMandor ? formData.mandor_name : undefined,
        employee_id: undefined,
        project_id: formData.project_id || undefined,
        purpose: formData.purpose,
        amount: amt,
        status: formData.status,
      });

      onSuccess(saved || formData);
      onClose();
    } catch (err: any) {
      console.error("Cash advance save error:", err);
      setErrorMsg(err?.message || "Gagal menyimpan pengajuan kasbon.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMandor = formData.advance_type === "MANDOR";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200/90 bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
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
              {isEditing ? "Edit Kasbon" : "Pencairan Kasbon Baru"}
            </h3>
            <p className="text-xs text-zinc-500">
              Kasbon Karyawan / Owner (Plafon Pribadi) atau Kasbon Mandor (Upah Tukang Proyek)
            </p>
          </div>
        </div>

        {/* Tab Pilihan Jenis Kasbon */}
        <div className="mb-4 flex rounded-xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => {
              setFormData({ ...formData, advance_type: "EMPLOYEE" });
              setLimitWarning(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              !isMandor
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Karyawan / Owner</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({ ...formData, advance_type: "MANDOR" });
              setLimitWarning(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              isMandor
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <HardHat className="h-3.5 w-3.5" />
            <span>Mandor (Upah Tukang)</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {limitWarning && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>{limitWarning}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Advance Ref */}
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
                Status Kasbon
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="DISBURSED">Dicairkan (Dana Keluar)</option>
                <option value="PARTIALLY_SETTLED">Sebagian Diselesaikan</option>
                <option value="SETTLED">Lunas (100% Selesai)</option>
                <option value="SUBMITTED">Diajukan (Menunggu Persetujuan)</option>
              </select>
            </div>
          </div>

          {/* Form Mandor Proyek: Pilih Proyek */}
          {isMandor && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Pilih Proyek Terkait * (Kategori: Upah Tukang)
              </label>
              <select
                required
                value={formData.project_id || ""}
                onChange={(e) => {
                  setFormData({ ...formData, project_id: e.target.value });
                  setLimitWarning(null);
                }}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="">-- Pilih Proyek Arsitektur / Konstruksi --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.labor_advance_limit ? `(Limit Upah: Rp ${p.labor_advance_limit.toLocaleString("id-ID")})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              {isMandor ? "Nama Mandor / Kepala Tukang *" : "Nama Penerima (Karyawan / Owner) *"}
            </label>
            <div className="relative">
              {isMandor ? (
                <HardHat className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              ) : (
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              )}
              <input
                type="text"
                required
                value={isMandor ? formData.mandor_name : formData.employee}
                onChange={(e) =>
                  isMandor
                    ? setFormData({ ...formData, mandor_name: e.target.value })
                    : setFormData({ ...formData, employee: e.target.value })
                }
                placeholder={isMandor ? "Misal: Pak Slamet (Mandor Struktur)" : "Misal: Rian Pratama (Lead Architect)"}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Operational Purpose */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Tujuan &amp; Keperluan Kasbon *
            </label>
            <input
              type="text"
              required
              value={formData.purpose}
              onChange={(e) =>
                setFormData({ ...formData, purpose: e.target.value })
              }
              placeholder={isMandor ? "Kasbon upah tukang mingguan / harian" : "Transport & akomodasi survey lokasi proyek"}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Tanggal Pencairan
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
                Nominal Kasbon (IDR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={formData.disbursed_amount || ""}
                  onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                  placeholder="2500000"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Settled & Returned jika dalam mode Edit */}
          {isEditing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Nota Diselesaikan (IDR)
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
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Pengembalian Tunai (IDR)
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
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 font-mono text-xs font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

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
                  <span>{isEditing ? "Simpan Perubahan" : "Cairkan Kasbon"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
