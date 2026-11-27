"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createDividendDisbursement, getDividendDisbursements } from "@/app/actions/dividendActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";

interface CashAccountOption {
  id: string;
  name: string;
}

interface DividendDisbursement {
  id: string;
  date: string;
  recipient_name: string;
  cash_account_name: string;
  amount: number | string;
  reference: string | null;
  notes: string | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function DividendDisbursementPanel() {
  const [disbursements, setDisbursements] = useState<DividendDisbursement[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccountOption[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recipientName, setRecipientName] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [items, accounts] = await Promise.all([
        getDividendDisbursements(),
        getCashAccountsWithBalances(),
      ]);
      setDisbursements(items);
      setCashAccounts(accounts);
      setCashAccountId((current) =>
        accounts.some((account) => account.id === current) ? current : accounts[0]?.id || ""
      );
    } catch (loadError) {
      console.error("Gagal memuat pencairan dividen:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat pencairan dividen.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      await createDividendDisbursement({
        date,
        recipient_name: recipientName,
        cash_account_id: cashAccountId,
        amount: Number(amount),
        reference,
        notes,
      });
      setSuccess(`Dividen untuk ${recipientName} berhasil dicatat.`);
      setRecipientName("");
      setAmount("");
      setReference("");
      setNotes("");
      setIsOpen(false);
      await fetchData();
    } catch (saveError) {
      console.error("Gagal mencatat pencairan dividen:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Gagal mencatat pencairan dividen.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-950">Pencairan Dividen</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Distribusi kepada pemegang saham; bukan kasbon atau biaya operasional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsOpen(true);
          }}
          disabled={cashAccounts.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Catat Pencairan Dividen</span>
        </button>
      </div>

      {error && !isOpen && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {success}
        </div>
      )}

      {isLoading ? (
        <p className="py-4 text-center text-xs text-zinc-500">Memuat riwayat dividen...</p>
      ) : disbursements.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 px-4 py-5 text-center text-xs text-zinc-500">
          Belum ada pencairan dividen.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                <th className="pb-3 pl-2">Tanggal</th>
                <th className="pb-3">Penerima</th>
                <th className="pb-3">Rekening</th>
                <th className="pb-3">Referensi / Catatan</th>
                <th className="pb-3 pr-2 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {disbursements.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/70">
                  <td className="whitespace-nowrap py-3 pl-2 font-mono text-zinc-500">
                    {new Date(item.date).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3 font-semibold text-zinc-900">{item.recipient_name}</td>
                  <td className="py-3 text-zinc-600">{item.cash_account_name}</td>
                  <td className="py-3 text-zinc-500">
                    {[item.reference, item.notes].filter(Boolean).join(" • ") || "—"}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-2 text-right font-mono font-bold text-zinc-900">
                    {formatCurrency(Number(item.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-black/50"
            aria-label="Tutup form pencairan dividen"
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
          />
          <form
            onSubmit={handleSubmit}
            className="relative z-10 w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-zinc-950">Catat Pencairan Dividen</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Saldo kas berkurang dan jurnal mengurangi laba ditahan, bukan laba-rugi.
              </p>
            </div>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-zinc-700">
                Tanggal
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-700">
                Pemegang saham / penerima
                <input
                  required
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Nama penerima dividen"
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-700 sm:col-span-2">
                Rekening perusahaan
                <select
                  required
                  value={cashAccountId}
                  onChange={(event) => setCashAccountId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-normal"
                >
                  <option value="">Pilih rekening pencairan</option>
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-zinc-700">
                Nominal dividen (Rp)
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-mono font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-700">
                Referensi (opsional)
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-zinc-700 sm:col-span-2">
                Catatan (opsional)
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-normal"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || !cashAccountId}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </span>
                ) : "Catat Dividen"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
