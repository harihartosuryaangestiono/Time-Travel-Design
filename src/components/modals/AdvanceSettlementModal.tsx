"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, DollarSign, Calendar, FileText, Loader2, CreditCard } from "lucide-react";
import { settleCashAdvanceRecord, SettleAdvanceInput } from "@/app/actions/cashAdvanceActions";

interface AdvanceSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  advance: {
    id: string;
    number: string;
    employee: string;
    purpose: string;
    disbursed_amount: number;
    settled_amount: number;
    returned_amount: number;
  } | null;
}

export function AdvanceSettlementModal({
  isOpen,
  onClose,
  onSuccess,
  advance,
}: AdvanceSettlementModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<"CASH" | "INSTALLMENT" | "PAYROLL_DEDUCTION" | "EXPENSE">("CASH");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openBalance = advance
    ? Math.max(0, advance.disbursed_amount - advance.settled_amount - advance.returned_amount)
    : 0;

  useEffect(() => {
    if (advance) {
      setAmount(openBalance);
      setDescription(`Pelunasan kasbon ${advance.number} - ${advance.employee}`);
      setDate(new Date().toISOString().split("T")[0]);
      setMethod("CASH");
      setNotes("");
      setErrorMsg(null);
    }
  }, [advance, isOpen, openBalance]);

  if (!isOpen || !advance) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMsg("Nominal pelunasan harus lebih dari 0.");
      return;
    }
    if (amount > openBalance) {
      setErrorMsg(`Nominal pelunasan tidak boleh melebihi sisa kasbon (Rp ${openBalance.toLocaleString("id-ID")}).`);
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Keterangan pelunasan wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await settleCashAdvanceRecord({
        cash_advance_id: advance.id,
        amount,
        settlement_method: method,
        description: description.trim(),
        date,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Gagal memproses pelunasan:", err);
      setErrorMsg(err?.message || "Terjadi kesalahan saat memproses pelunasan.");
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

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200/90 bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-950">
              Pelunasan / Rekonsiliasi Kasbon
            </h3>
            <p className="text-xs text-zinc-500">
              Catat penyelesaian kasbon melalui tunai, cicilan, potong gaji, atau bukti nota
            </p>
          </div>
        </div>

        {/* Info Ringkasan Kasbon */}
        <div className="mb-5 rounded-2xl bg-zinc-50 p-4 border border-zinc-200/80 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Nomor &amp; Penerima:</span>
            <span className="font-semibold text-zinc-900">{advance.number} • {advance.employee}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Total Dicairkan:</span>
            <span className="font-mono text-zinc-700">Rp {advance.disbursed_amount.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Sudah Diselesaikan:</span>
            <span className="font-mono text-zinc-700">Rp {(advance.settled_amount + advance.returned_amount).toLocaleString("id-ID")}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-zinc-200 font-bold">
            <span className="text-zinc-800">Sisa Kasbon (Open Balance):</span>
            <span className="font-mono text-amber-700">Rp {openBalance.toLocaleString("id-ID")}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Metode Pelunasan */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Metode Pelunasan
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: "CASH", label: "Tunai" },
                { id: "INSTALLMENT", label: "Cicilan" },
                { id: "PAYROLL_DEDUCTION", label: "Potong Gaji" },
                { id: "EXPENSE", label: "Nota Bon" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id as any)}
                  className={`rounded-xl border px-2.5 py-2 text-center text-xs font-medium transition-all ${
                    method === m.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-bold"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nominal Pelunasan */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Nominal Pelunasan (Rp)
              </label>
              <button
                type="button"
                onClick={() => setAmount(openBalance)}
                className="text-[11px] text-emerald-700 font-semibold hover:underline"
              >
                Lunasi Semua (Rp {openBalance.toLocaleString("id-ID")})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">Rp</span>
              <input
                type="number"
                min="1"
                max={openBalance}
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                required
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 font-mono text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Tanggal Pelunasan */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Tanggal Transaksi
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Keterangan Pelunasan
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 h-3.5 w-3.5 text-zinc-400" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Misal: Pelunasan sisa uang muka pekerjaan..."
                rows={2}
                required
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 pt-2 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Catatan Internal (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan nomor kwitansi atau referensi lain..."
              className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Simpan Pelunasan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
