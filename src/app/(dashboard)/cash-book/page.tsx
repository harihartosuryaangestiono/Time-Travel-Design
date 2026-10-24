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
import {
  getCashBookTransactions,
  getRecentDescriptions,
} from "@/app/actions/cashBookActions";
import type { CashBookEntry } from "@/lib/validation/cashBook";

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
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Semua
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getCashBookTransactions({
        month: selectedMonth > 0 ? selectedMonth : undefined,
        category: selectedCategory,
      });
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
    fetchBookData();
  }, [selectedMonth, selectedCategory]);

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
            Tabel mutasi ala Excel dengan saldo berjalan kumulatif &amp; 11 kategori kantor
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
          title="Kas Modal Awal 2025"
          value={isLoading ? "..." : formatCurrency(openingBalance)}
          subtitle="Saldo awal pembukuan"
          icon={Calendar}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-950"
        />
        <StatCard
          title="Total Pemasukan / Bunga"
          value={isLoading ? "..." : formatCurrency(totalIn)}
          subtitle={`${entries.filter((e) => e.debit > 0).length} transaksi masuk`}
          icon={ArrowDownLeft}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-700"
        />
        <StatCard
          title="Total Beban Kantor"
          value={isLoading ? "..." : formatCurrency(totalOut)}
          subtitle={`${entries.filter((e) => e.kredit > 0).length} pengeluaran kantor`}
          icon={ArrowUpRight}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-700"
        />
      </div>

      {/* ── Input Cepat Ala Excel ── */}
      <FastTransactionEntry
        onSuccess={fetchBookData}
        recentDescriptions={recentDescriptions}
        allowProjectSelection={false}
      />

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
              <option value="ALL">Semua 11 Kategori Kantor</option>
              <option value="Gaji dan Upah Karyawan">Gaji dan Upah Karyawan</option>
              <option value="Transportasi Operasional">Transportasi Operasional</option>
              <option value="Biaya Konsumsi Kantor">Biaya Konsumsi Kantor</option>
              <option value="Biaya Jamuan / Representasi">Biaya Jamuan / Representasi</option>
              <option value="Biaya Marketing">Biaya Marketing</option>
              <option value="Kebutuhan Workshop">Kebutuhan Workshop</option>
              <option value="Biaya Administrasi Finansial">Biaya Administrasi Finansial</option>
              <option value="Renovasi Kantor">Renovasi Kantor</option>
              <option value="Legalitas Perusahaan">Legalitas Perusahaan</option>
              <option value="Inventaris">Inventaris</option>
              <option value="Perangkat Gadget">Perangkat Gadget</option>
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
                    <p className="font-semibold text-zinc-900">{ent.description}</p>
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
