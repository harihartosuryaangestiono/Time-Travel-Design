"use client";

import { useState, useEffect } from "react";
import { Download, Printer, Filter, BookOpen, AlertCircle, FileSpreadsheet } from "lucide-react";
import { fetchGeneralLedger } from "@/app/actions/reportActions";

function formatCurrency(value: number): string {
  if (isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface LedgerLine {
  id: string;
  date: string;
  entryNumber: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

export default function GeneralLedgerPage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("ALL");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async (start: string, end: string, accId: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetchGeneralLedger({
        startDate: start,
        endDate: end,
        accountId: accId,
      });

      setAccounts(res.accounts || []);
      setLines(res.lines || []);
    } catch (err: any) {
      console.error("Gagal memuat buku besar:", err);
      setErrorMessage(err.message || "Gagal memuat buku besar dari database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(startDate, endDate, selectedAccountId);
  }, []);

  const handleGenerate = () => {
    loadData(startDate, endDate, selectedAccountId);
  };

  const exportCSV = () => {
    const rows = [
      ["Tanggal", "No. Jurnal", "Kode Akun", "Nama Akun", "Keterangan", "Debit", "Kredit"],
      ...lines.map((l) => [
        l.date,
        l.entryNumber,
        l.accountCode,
        `"${l.accountName}"`,
        `"${l.description}"`,
        l.debit,
        l.credit,
      ]),
      ["", "", "", "", "TOTAL", totalDebit, totalCredit],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Buku_Besar_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Filter and Action Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Periode:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
            <span className="text-xs text-zinc-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none max-w-xs"
          >
            <option value="ALL">Semua Akun Buku Besar (Bagan Akun)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {isLoading ? "Memuat..." : "Terapkan Filter"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            Cetak PDF
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-zinc-900" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
          <button
            onClick={() => loadData(startDate, endDate, selectedAccountId)}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Ledger Content */}
      {isLoading ? (
        <div className="h-96 w-full animate-pulse rounded-3xl border border-zinc-100 bg-white p-6" />
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            Belum Ada Mutasi Buku Besar
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            Catatan debit dan kredit akan otomatis terakumulasi di sini saat transaksi jurnal di-posting.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                GENERAL LEDGER AUDIT
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                BUKU BESAR MUTASI TRANSAKSI
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              {lines.length} Baris Jurnal
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px] bg-zinc-50/50">
                  <th className="py-3 pl-4">Tanggal</th>
                  <th className="py-3">No. Jurnal</th>
                  <th className="py-3">Akun</th>
                  <th className="py-3">Keterangan</th>
                  <th className="py-3 text-right">Debit</th>
                  <th className="py-3 pr-4 text-right">Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3 pl-4 text-zinc-500 whitespace-nowrap">{line.date}</td>
                    <td className="py-3 font-bold text-zinc-900 whitespace-nowrap">
                      {line.entryNumber}
                    </td>
                    <td className="py-3 text-zinc-700 whitespace-nowrap">
                      <span className="font-bold text-zinc-900 mr-1.5">{line.accountCode}</span>
                      <span className="font-sans text-zinc-500">{line.accountName}</span>
                    </td>
                    <td className="py-3 font-sans text-zinc-600 max-w-xs truncate">
                      {line.description}
                    </td>
                    <td className="py-3 text-right tabular-nums text-zinc-900 font-medium">
                      {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-zinc-900 font-medium">
                      {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-950 font-mono text-xs">
                  <td colSpan={4} className="py-3.5 pl-4 uppercase font-sans">
                    Total Mutasi Periode
                  </td>
                  <td className="py-3.5 text-right tabular-nums">{formatCurrency(totalDebit)}</td>
                  <td className="py-3.5 pr-4 text-right tabular-nums">
                    {formatCurrency(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
