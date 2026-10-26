"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  Filter,
  Download,
  AlertCircle,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { FastTransactionEntry } from "@/components/cash-book/FastTransactionEntry";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";
import { getProjects } from "@/app/actions/projectActions";
import {
  getCashBookTransactions,
  getRecentDescriptions,
} from "@/app/actions/cashBookActions";
import { getSubcontractorPaymentOptions } from "@/app/actions/subcontractorActions";
import type { SubcontractorContractSummary } from "@/app/actions/subcontractorActions";
import type { CashBookEntry } from "@/lib/validation/cashBook";
import {
  GENERAL_EXPENSE_CATEGORIES,
  PROJECT_EXPENSE_CATEGORIES,
} from "@/lib/accounting/expenseCategories";

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

const MONTH_NAMES = [
  "Semua Bulan",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function CashBookPage() {
  const [entries, setEntries] = useState<CashBookEntry[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; opening_balance: number }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Semua
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [subcontractorContracts, setSubcontractorContracts] = useState<SubcontractorContractSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getCashBookTransactions({
        month: selectedMonth > 0 ? selectedMonth : undefined,
        category: selectedCategory,
        cashAccountId: selectedAccountId,
      });
      setAccounts(res.accounts);
      setEntries(res.entries);
      setCurrentBalance(res.currentBalance);
      setOpeningBalance(res.openingBalance);

      const recent = await getRecentDescriptions();
      setRecentDescriptions(recent);
    } catch (err: any) {
      console.error("Gagal memuat buku kas:", err);
      setError(err?.message || "Gagal memuat mutasi buku kas perusahaan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([getCashAccountsWithBalances(), getProjects(), getSubcontractorPaymentOptions()])
      .then(([cashAccounts, projectRows, contracts]) => {
        setAccounts(cashAccounts);
        setSelectedAccountId((current) => current || cashAccounts[0]?.id || "");
        setProjects(projectRows.map((project) => ({
          id: project.id,
          name: project.name,
          code: project.code,
        })));
        setSubcontractorContracts(contracts);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Gagal memuat pilihan rekening/proyek:", err);
        setError(err instanceof Error ? err.message : "Gagal memuat pilihan transaksi.");
        setIsLoading(false);
      });
  }, []);

  const handleTransactionSaved = async () => {
    await Promise.all([
      fetchBookData(),
      getSubcontractorPaymentOptions().then(setSubcontractorContracts),
    ]);
  };

  useEffect(() => {
    if (selectedAccountId) void fetchBookData();
  }, [selectedMonth, selectedCategory, selectedAccountId]);

  const handleExportCSV = () => {
    const headers = ["Tanggal", "Nomor Ref", "Keterangan", "Kategori", "Debit", "Kredit", "Saldo Berjalan"];
    const rows = entries.map((e) => [
      e.date,
      `"${e.number || "-"}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.debit,
      e.kredit,
      e.balance,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Buku_Kas_Perusahaan_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIn = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalOut = entries.reduce((sum, e) => sum + e.kredit, 0);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              PT. RUMA INOVASI INDONESIA
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-[10px] font-semibold text-zinc-600">Time Travel Design</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl mt-0.5 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-zinc-950" />
            Buku Kas Perusahaan (Lapkeu Perusahaan)
          </h2>
          <p className="text-xs text-zinc-500">
            Catat uang masuk dan pengeluaran setelah benar-benar dibayar; transaksi langsung masuk ke rekapitulasi.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-zinc-600" />
          <span>Export Excel / CSV</span>
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Saldo Akhir Kas"
          value={isLoading ? "..." : formatCurrency(currentBalance)}
          subtitle="Saldo berjalan riil saat ini"
          icon={Wallet}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
          gradient
        />
        <StatCard
          title="Saldo Awal Rekening"
          value={isLoading ? "..." : formatCurrency(openingBalance)}
          subtitle="Saldo pada tanggal mulai pencatatan"
          icon={Calendar}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Total Uang Masuk"
          value={isLoading ? "..." : formatCurrency(totalIn)}
          subtitle={`${entries.filter((e) => e.debit > 0).length} transaksi masuk`}
          icon={ArrowDownLeft}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-700"
        />
        <StatCard
          title="Total Uang Keluar"
          value={isLoading ? "..." : formatCurrency(totalOut)}
          subtitle={`${entries.filter((e) => e.kredit > 0).length} pengeluaran kantor`}
          icon={ArrowUpRight}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-700"
        />
      </div>

      {accounts.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Rekening yang dicatat</h3>
            <p className="text-[11px] text-zinc-500">Pilih rekening untuk melihat mutasi dan saldo rekening tersebut.</p>
          </div>
          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-900"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Input Cepat Ala Excel ── */}
      {accounts.length > 0 ? (
        <div className="space-y-2">
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
            Pengeluaran dicatat di sini setelah uang benar-benar keluar. Tidak perlu input ulang di menu lain.
          </p>
          <FastTransactionEntry
            onSuccess={handleTransactionSaved}
            recentDescriptions={recentDescriptions}
            accounts={accounts}
            subcontractorContracts={subcontractorContracts}
            projects={projects}
            defaultProjectId={undefined}
            allowProjectSelection
          />
        </div>
      ) : !isLoading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          Buat rekening atau akun kas terlebih dahulu di Treasury &amp; Bank Accounts sebelum mencatat mutasi.
        </div>
      )}

      {/* ── Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Filter Bulan */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent font-medium text-zinc-900 focus:outline-none"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          {/* Filter Kategori */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent font-medium text-zinc-900 focus:outline-none max-w-xs truncate"
            >
              <option value="ALL">Semua kategori transaksi</option>
              <option value="Pendapatan Proyek">Pendapatan Proyek</option>
              <option value="Setoran Modal">Setoran Modal</option>
              <option value="Bunga Bank">Bunga Bank</option>
              <option value="Pemasukan Lainnya">Pemasukan Lainnya</option>
              <option value="Pembayaran Invoice">Pembayaran Invoice</option>
              <optgroup label="Buku Kecil — Pengeluaran Proyek">
                {PROJECT_EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </optgroup>
              <optgroup label="Buku Besar — Pengeluaran Umum">
                {GENERAL_EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <span className="text-xs text-zinc-400 font-medium self-end sm:self-auto">
          {entries.length} baris mutasi
        </span>
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
            onClick={fetchBookData}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Tabel Mutasi Buku Kas Ala Excel ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="pb-3 pl-2">Tanggal</th>
              <th className="pb-3">Keterangan Transaksi</th>
              <th className="pb-3">Kategori</th>
              <th className="pb-3 text-right">Debit (Masuk)</th>
              <th className="pb-3 text-right">Kredit (Keluar)</th>
              <th className="pb-3 pr-2 text-right">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400 animate-pulse">
                  Memuat data transaksi buku kas...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">
                  Tidak ada transaksi buku kas pada filter yang dipilih.
                </td>
              </tr>
            ) : (
              entries.map((ent) => (
                <tr key={ent.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-3 pl-2 font-mono text-zinc-500 whitespace-nowrap">
                    {ent.date}
                  </td>
                  <td className="py-3 pr-2">
                    <p className="font-semibold text-zinc-900">
                      {ent.description}
                      {ent.type === "INCOME" && (
                        <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Masuk</span>
                      )}
                      {ent.type === "EXPENSE" && (
                        <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">Keluar</span>
                      )}
                    </p>
                    {ent.number && (
                      <p className="font-mono text-[10px] text-zinc-400">{ent.number}</p>
                    )}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ent.needs_category
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {ent.category}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold whitespace-nowrap">
                    {ent.debit > 0 ? formatCurrency(ent.debit) : "-"}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-rose-700 font-semibold whitespace-nowrap">
                    {ent.kredit > 0 ? formatCurrency(ent.kredit) : "-"}
                  </td>
                  <td className="py-3 pr-2 text-right font-mono tabular-nums font-bold text-zinc-950 whitespace-nowrap">
                    {formatCurrency(ent.balance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
