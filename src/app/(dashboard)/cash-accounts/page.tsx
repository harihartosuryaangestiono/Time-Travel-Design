"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Wallet,
  ArrowRightLeft,
  CreditCard,
  Coins,
  Edit3,
  Trash2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { CashAccountModal, CashAccountFormData } from "@/components/modals/CashAccountModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import {
  getCashAccountsWithBalances,
  deleteCashAccountRecord,
} from "@/app/actions/cashAccountActions";

interface CashAccount {
  id: string;
  name: string;
  type: string;
  opening_balance: number;
  current_balance: number;
  bank_name: string | null;
  account_number: string | null;
}

function formatCurrency(amount: number) {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export default function CashAccountsPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CashAccountFormData | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<CashAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCashAccountsWithBalances();
      setAccounts(data);
    } catch (e: any) {
      console.error("Error fetching cash accounts:", e);
      setError(e?.message || "Gagal memuat daftar akun kas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSaveAccount = async () => {
    await fetchAccounts();
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      setIsDeleting(true);
      await deleteCashAccountRecord(accountToDelete.id);
      await fetchAccounts();
      setShowDelete(false);
      setAccountToDelete(null);
    } catch (err: any) {
      console.error("Account delete error:", err);
      alert(err?.message || "Gagal menghapus akun kas.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Saldo dihitung dari opening_balance + mutasi berjalan (current_balance)
  const totalBalance = accounts.reduce((sum, acc) => sum + (isNaN(acc.current_balance) ? 0 : acc.current_balance), 0);
  const bankTotal = accounts
    .filter((a) => a.type === "BANK")
    .reduce((sum, acc) => sum + (isNaN(acc.current_balance) ? 0 : acc.current_balance), 0);
  const cashTotal = accounts
    .filter((a) => a.type === "CASH")
    .reduce((sum, acc) => sum + (isNaN(acc.current_balance) ? 0 : acc.current_balance), 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
            Rekening Bank &amp; Kas Perusahaan
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manajemen likuiditas kas, saldo riil mutasi tanpa menimpa saldo awal
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedAccount(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Rekening</span>
          </button>
        </div>
      </div>

      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Likuiditas Kas"
          value={isLoading ? "..." : formatCurrency(totalBalance)}
          subtitle="Saldo riil (Saldo Awal + Seluruh Mutasi)"
          icon={Wallet}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Kas di Bank"
          value={isLoading ? "..." : formatCurrency(bankTotal)}
          subtitle="Giro &amp; tabungan operasional"
          icon={CreditCard}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-700"
        />
        <StatCard
          title="Kas Kecil / Tunai"
          value={isLoading ? "..." : formatCurrency(cashTotal)}
          subtitle="Petty cash kantor &amp; lapangan"
          icon={Coins}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
        <StatCard
          title="Rekening Aktif"
          value={isLoading ? "..." : `${accounts.length} Akun`}
          subtitle="Rekening kas &amp; bank terdaftar"
          icon={ArrowRightLeft}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAccounts}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Skeleton Loading ── */}
      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 rounded-3xl border border-zinc-200 bg-zinc-100 p-6 shadow-sm animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && accounts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-4">
            <Wallet className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900">Belum Ada Rekening Kas</h4>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
            Tambahkan rekening bank operasional atau kas kecil kantor untuk mencatat alur kas masuk dan keluar.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedAccount(null);
              setShowModal(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Rekening Pertama</span>
          </button>
        </div>
      )}

      {/* ── Accounts Cards ── */}
      {!isLoading && accounts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const isBCA = acc.name.toLowerCase().includes("bca");
            const isMandiri = acc.name.toLowerCase().includes("mandiri");

            return (
              <div
                key={acc.id}
                className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl transition-all duration-200 hover:translate-y-[-2px] ${
                  isBCA
                    ? "bg-gradient-to-br from-[#09090B] via-[#121212] to-[#18181B] ring-1 ring-white/15"
                    : isMandiri
                    ? "bg-gradient-to-br from-[#18181B] via-[#27272A] to-[#3F3F46] ring-1 ring-white/15"
                    : "bg-gradient-to-br from-[#27272A] via-[#3F3F46] to-[#52525B] ring-1 ring-white/15"
                }`}
              >
                {/* Top Card Strip */}
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span className="font-semibold tracking-wider uppercase text-[10px] font-mono">
                    {acc.type === "BANK" ? "REKENING BANK" : "KAS KECIL / TUNAI"}
                  </span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                    AKTIF
                  </span>
                </div>

                {/* Card Chip & Brand */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-7 w-10 rounded-md bg-amber-400/80 ring-1 ring-amber-300 shadow-inner flex items-center justify-center">
                    <div className="h-4 w-6 border border-amber-800/40 rounded-sm" />
                  </div>
                  <span className="font-bold tracking-tight text-white/90 text-sm">
                    {acc.bank_name || "Kas Perusahaan"}
                  </span>
                </div>

                {/* Account Number */}
                <div className="mt-5 font-mono text-xs tracking-widest text-white/70">
                  {acc.account_number || "•••• •••• •••• 0000"}
                </div>

                {/* Balance */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                      SALDO BERJALAN RIIL
                    </span>
                    <span className="text-[10px] text-white/60 font-mono">
                      Awal: {formatCurrency(acc.opening_balance)}
                    </span>
                  </div>
                  <div className="text-2xl font-black tracking-tight text-white font-mono tabular-nums mt-0.5">
                    {formatCurrency(acc.current_balance)}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
                  <span className="text-white/80 font-medium truncate max-w-[130px]">
                    {acc.name}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccount({
                          id: acc.id,
                          name: acc.name,
                          type: acc.type as any,
                          bank_name: acc.bank_name || "",
                          account_number: acc.account_number || "",
                          opening_balance: acc.opening_balance,
                        });
                        setShowModal(true);
                      }}
                      className="rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                      title="Edit Akun"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountToDelete(acc);
                        setShowDelete(true);
                      }}
                      className="rounded-lg p-1 text-white/70 hover:bg-rose-500/30 hover:text-rose-200 transition-colors"
                      title="Hapus Akun"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Add / Edit ── */}
      <CashAccountModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAccount(null);
        }}
        onSuccess={handleSaveAccount}
        accountToEdit={selectedAccount}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          setShowDelete(false);
          setAccountToDelete(null);
        }}
        onConfirm={handleDeleteAccount}
        title="Hapus Akun Kas / Bank"
        description="Apakah Anda yakin ingin menghapus akun ini secara permanen?"
        itemName={accountToDelete ? `${accountToDelete.name} (${accountToDelete.account_number || "-"})` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
