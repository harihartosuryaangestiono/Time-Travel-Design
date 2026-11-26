"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, RefreshCw, Wallet } from "lucide-react";
import { createCashTransfer, getCashTransfers } from "@/app/actions/transferActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";

const EXTERNAL_ACCOUNT = "EXTERNAL";

interface CashAccount {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  current_balance: number;
}

interface CashTransfer {
  id: string;
  from_account_id: string | null;
  from_account_name?: string | null;
  to_account_id: string;
  amount: number | string;
  date: string;
  reference?: string | null;
  notes?: string | null;
  from_account?: { name: string } | null;
  to_account?: { name: string } | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function accountLabel(account: CashAccount) {
  return [account.name, account.bank_name, account.account_number].filter(Boolean).join(" • ");
}

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [fromAccountId, setFromAccountId] = useState(EXTERNAL_ACCOUNT);
  const [externalAccountName, setExternalAccountName] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [accountList, transferList] = await Promise.all([
        getCashAccountsWithBalances(),
        getCashTransfers(),
      ]);
      setAccounts(accountList);
      setTransfers(transferList);
      setToAccountId((current) => accountList.some((account) => account.id === current)
        ? current
        : accountList[0]?.id || "");
    } catch (loadError) {
      console.error("Gagal memuat data pemindahan dana:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data pemindahan dana.");
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
      await createCashTransfer({
        from_account_id: fromAccountId === EXTERNAL_ACCOUNT ? null : fromAccountId,
        from_account_name: fromAccountId === EXTERNAL_ACCOUNT ? externalAccountName : undefined,
        to_account_id: toAccountId,
        amount: Number(amount),
        date,
        reference,
        notes,
      });
      setSuccess("Pemindahan dana berhasil dicatat. Saldo rekening tujuan telah diperbarui.");
      setAmount("");
      setReference("");
      setNotes("");
      await fetchData();
    } catch (saveError) {
      console.error("Gagal menyimpan pemindahan dana:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Gagal mencatat pemindahan dana.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/cash-accounts"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            aria-label="Kembali ke rekening kas dan bank"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">Pemindahan Dana</h1>
            <p className="mt-1 text-xs text-zinc-500">
              Catat transfer antar rekening, termasuk setoran dari rekening pribadi ke rekening perusahaan.
            </p>
          </div>
        </div>
        <Link
          href="/cash-accounts"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <Wallet className="h-3.5 w-3.5" />
          Rekening Kas &amp; Bank
        </Link>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Tutup pesan error">×</button>
        </div>
      )}
      {success && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} aria-label="Tutup pesan sukses">×</button>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-zinc-600" />
          <h2 className="text-sm font-bold text-zinc-950">Catat Pemindahan Dana</h2>
        </div>
        <p className="mb-5 rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800">
          Transfer dicatat sebagai kategori <strong>Pemindahan Dana</strong>, bukan pendapatan atau biaya. Transfer
          tidak masuk Rekapitulasi Lapkeu maupun laba-rugi; saldo rekening perusahaan tetap diperbarui.
        </p>

        {accounts.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Belum ada rekening tujuan perusahaan. Tambahkan rekening lebih dulu di{" "}
            <Link href="/cash-accounts" className="font-semibold underline">Rekening Kas &amp; Bank</Link>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="transfer-source" className="text-xs font-semibold text-zinc-700">Sumber Dana</label>
              <select
                id="transfer-source"
                value={fromAccountId}
                onChange={(event) => {
                  const sourceId = event.target.value;
                  setFromAccountId(sourceId);
                  if (sourceId !== EXTERNAL_ACCOUNT && sourceId === toAccountId) {
                    setToAccountId(accounts.find((account) => account.id !== sourceId)?.id || "");
                  }
                }}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value={EXTERNAL_ACCOUNT}>Rekening pribadi / luar perusahaan</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{accountLabel(account)}</option>
                ))}
              </select>
            </div>

            {fromAccountId === EXTERNAL_ACCOUNT && (
              <div>
                <label htmlFor="external-account-name" className="text-xs font-semibold text-zinc-700">
                  Nama Rekening Pribadi / Sumber Luar
                </label>
                <input
                  id="external-account-name"
                  value={externalAccountName}
                  onChange={(event) => setExternalAccountName(event.target.value)}
                  placeholder="Contoh: Rekening BCA Dustin"
                  required
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
            )}

            <div>
              <label htmlFor="transfer-destination" className="text-xs font-semibold text-zinc-700">Rekening Tujuan PT</label>
              <select
                id="transfer-destination"
                value={toAccountId}
                onChange={(event) => setToAccountId(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                {accounts
                  .filter((account) => fromAccountId === EXTERNAL_ACCOUNT || account.id !== fromAccountId)
                  .map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="transfer-amount" className="text-xs font-semibold text-zinc-700">Nominal (Rp)</label>
              <input
                id="transfer-amount"
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label htmlFor="transfer-date" className="text-xs font-semibold text-zinc-700">Tanggal Transfer</label>
              <input
                id="transfer-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label htmlFor="transfer-reference" className="text-xs font-semibold text-zinc-700">Nomor Referensi (opsional)</label>
              <input
                id="transfer-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="No. bukti transfer"
                className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="transfer-notes" className="text-xs font-semibold text-zinc-700">Catatan (opsional)</label>
              <input
                id="transfer-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Catatan tambahan"
                className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <button
                type="submit"
                disabled={isSaving || isLoading || accounts.length === 0 || !toAccountId}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {isSaving ? "Menyimpan..." : "Simpan Pemindahan Dana"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-bold text-zinc-950">Riwayat Pemindahan Dana</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3">Tanggal / Referensi</th>
                <th className="px-5 py-3">Dari</th>
                <th className="px-5 py-3">Ke</th>
                <th className="px-5 py-3">Kategori</th>
                <th className="px-5 py-3 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-zinc-400">Memuat riwayat transfer...</td></tr>
              ) : transfers.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-zinc-400">Belum ada pemindahan dana.</td></tr>
              ) : transfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-zinc-50/60">
                  <td className="px-5 py-3">
                    <div className="font-medium text-zinc-900">{new Date(transfer.date).toLocaleDateString("id-ID")}</div>
                    <div className="font-mono text-[10px] text-zinc-400">{transfer.reference || "—"}</div>
                  </td>
                  <td className="px-5 py-3">{transfer.from_account?.name || transfer.from_account_name || "Rekening perusahaan"}</td>
                  <td className="px-5 py-3">{transfer.to_account?.name || "Rekening tujuan"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                      Pemindahan Dana
                    </span>
                    {transfer.notes && <div className="mt-1 text-[10px] text-zinc-400">{transfer.notes}</div>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-zinc-900">
                    {formatCurrency(Number(transfer.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
