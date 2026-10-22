"use client";

import { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  ArrowRight,
  Wallet,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Plus,
  Search,
  Loader2,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { getCashTransfers, createCashTransfer } from "@/app/actions/transferActions";
import { createClient } from "@/lib/supabase/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface TransferItem {
  id: string;
  reference: string;
  date: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  notes: string;
  processedBy: string;
}

interface CashAccountOption {
  id: string;
  name: string;
  account_number: string | null;
  current_balance: number;
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [accounts, setAccounts] = useState<CashAccountOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [successNotice, setSuccessNotice] = useState(false);

  const fetchTransfersAndAccounts = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // 1. Ambil data cash accounts
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", user.id)
        .single();

      if (member) {
        const { data: accData } = await supabase
          .from("cash_accounts")
          .select("id, name, account_number, current_balance")
          .eq("organization_id", member.organization_id)
          .eq("is_active", true)
          .order("name");

        if (accData) {
          const mappedAccounts = accData.map((a: any) => ({
            id: a.id,
            name: a.name,
            account_number: a.account_number,
            current_balance: parseFloat(a.current_balance || "0"),
          }));
          setAccounts(mappedAccounts);

          if (mappedAccounts.length >= 2 && !fromAccountId) {
            setFromAccountId(mappedAccounts[0].id);
            setToAccountId(mappedAccounts[1].id);
          } else if (mappedAccounts.length === 1 && !fromAccountId) {
            setFromAccountId(mappedAccounts[0].id);
          }
        }
      }

      // 2. Ambil data transfers
      const rawTransfers = await getCashTransfers();
      const mappedTransfers: TransferItem[] = rawTransfers.map((t: any) => {
        const amt = parseFloat(t.amount || "0");
        return {
          id: t.id,
          reference: t.reference || `TRF-${t.id.slice(0, 8)}`,
          date: t.date ? t.date.split("T")[0] : "-",
          fromAccount: t.from_account?.name || "Akun Kas",
          toAccount: t.to_account?.name || "Akun Kas",
          amount: isNaN(amt) ? 0 : amt,
          notes: t.notes || "-",
          processedBy: t.creator?.full_name || t.creator?.email || "Finance",
        };
      });

      setTransfers(mappedTransfers);
    } catch (e: any) {
      console.error("Gagal memuat transfer kas:", e);
      setErrorMessage(e.message || "Gagal memuat histori transfer kas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfersAndAccounts();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setModalError("Nominal transfer harus lebih besar dari 0.");
      return;
    }
    if (!fromAccountId || !toAccountId) {
      setModalError("Pilih akun sumber dan akun tujuan.");
      return;
    }
    if (fromAccountId === toAccountId) {
      setModalError("Akun sumber dan tujuan tidak boleh sama.");
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      await createCashTransfer({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: numAmount,
        notes,
      });

      setShowModal(false);
      setAmount("");
      setNotes("");
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 4000);
      await fetchTransfersAndAccounts();
    } catch (err: any) {
      setModalError(err.message || "Gagal memproses transfer dana.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTransferred = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Akun yang paling sering menjadi sumber
  const sourceCountMap: Record<string, number> = {};
  transfers.forEach((t) => {
    sourceCountMap[t.fromAccount] = (sourceCountMap[t.fromAccount] || 0) + 1;
  });
  let mostUsedSource = "-";
  let maxCount = 0;
  Object.entries(sourceCountMap).forEach(([acc, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostUsedSource = acc;
    }
  });

  const filteredTransfers = transfers.filter(
    (t) =>
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      t.notes.toLowerCase().includes(search.toLowerCase()) ||
      t.fromAccount.toLowerCase().includes(search.toLowerCase()) ||
      t.toAccount.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Success Notice */}
      {successNotice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          Transfer dana internal berhasil diproses dan saldo rekening kas telah disinkronkan.
        </div>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
          <button
            onClick={() => fetchTransfersAndAccounts()}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Top Action & KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Likuiditas Ditransfer"
          value={isLoading ? "..." : formatCurrency(totalTransferred)}
          subtitle={`${transfers.length} transaksi selesai`}
          icon={ArrowRightLeft}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Sumber Dana Utama"
          value={isLoading ? "..." : mostUsedSource}
          subtitle={
            maxCount > 0
              ? `${maxCount}x transfer keluar`
              : "Belum ada histori transfer"
          }
          icon={Wallet}
          iconBgColor="bg-sky-500/10"
          iconColor="text-sky-700"
        />
        <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#09090B] p-5 text-white shadow-lg">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">
              Operasional Kas &amp; Bank
            </span>
            <h3 className="text-base font-bold mt-1">Transfer Antar Rekening</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Top up kas kecil atau pindah dana antar rekening bank operasional
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setShowModal(true);
            }}
            disabled={accounts.length < 2}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white py-2 px-4 text-xs font-bold text-zinc-950 hover:bg-zinc-100 active:scale-95 disabled:opacity-50 transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            {accounts.length < 2
              ? "Perlu Minimal 2 Akun Kas"
              : "Eksekusi Transfer"}
          </button>
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-zinc-950" />
              Histori Mutasi &amp; Transfer Internal
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Catatan transfer dan pergeseran saldo antar rekening kas perusahaan
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari nomor ref, akun, catatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-xl bg-zinc-100"
              />
            ))}
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center my-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-zinc-200 text-zinc-400 mb-3 shadow-sm">
              <Layers className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-900 mb-1">
              {search ? "Transfer Tidak Ditemukan" : "Belum Ada Histori Transfer Dana"}
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              {search
                ? `Tidak ada transaksi yang cocok dengan kata kunci "${search}".`
                : "Gunakan fitur ini saat memindahkan saldo antar rekening bank atau mengisi kembali kas kecil (petty cash)."}
            </p>
            {accounts.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setShowModal(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Buat Transfer Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">No. Referensi</th>
                  <th className="pb-3">Tanggal</th>
                  <th className="pb-3">Sumber &amp; Tujuan</th>
                  <th className="pb-3">Catatan / Keperluan</th>
                  <th className="pb-3">Diproses Oleh</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 pr-2 text-right">Nominal Transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredTransfers.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 pl-2 font-mono font-bold text-zinc-950 whitespace-nowrap">
                      {item.reference}
                    </td>
                    <td className="py-3.5 font-mono text-zinc-500 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-zinc-800">{item.fromAccount}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-zinc-950 font-bold">{item.toAccount}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-zinc-600 max-w-xs truncate">
                      {item.notes}
                    </td>
                    <td className="py-3.5 text-zinc-500 whitespace-nowrap">
                      {item.processedBy}
                    </td>
                    <td className="py-3.5 whitespace-nowrap">
                      <Badge variant="success" dot size="sm">
                        SELESAI
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-2 text-right font-mono font-bold text-zinc-950 tabular-nums whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-zinc-950">
                  Transfer Dana Internal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Akun Sumber (Debit) *
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  required
                >
                  <option value="">Pilih akun sumber</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatCurrency(acc.current_balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Akun Tujuan (Kredit) *
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  required
                >
                  <option value="">Pilih akun tujuan</option>
                  {accounts
                    .filter((acc) => acc.id !== fromAccountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — Saldo: {formatCurrency(acc.current_balance)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Nominal Transfer (IDR) *
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Contoh: 10000000"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-sm font-bold text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-none"
                  required
                />
                <div className="flex gap-2 mt-2">
                  {["1000000", "5000000", "10000000", "25000000"].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200"
                    >
                      {formatCurrency(Number(preset))}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Keterangan &amp; Keperluan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Pengisian petty cash operasional studio..."
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Konfirmasi Transfer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
