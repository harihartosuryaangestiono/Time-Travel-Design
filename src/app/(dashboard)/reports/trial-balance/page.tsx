"use client";

import { useState, useEffect } from "react";
import { Download, Printer, Filter, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { fetchTrialBalance } from "@/app/actions/reportActions";

function formatCurrency(value: number): string {
  if (isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export default function TrialBalancePage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<TrialBalanceRow[]>([]);

  const loadData = async (start: string, end: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetchTrialBalance(start, end);
      setData(res || []);
    } catch (err: any) {
      console.error("Gagal memuat neraca saldo:", err);
      setErrorMessage(err.message || "Gagal memuat neraca saldo dari database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(startDate, endDate);
  }, []);

  const handleGenerate = () => {
    loadData(startDate, endDate);
  };

  const totals = data.reduce(
    (acc, row) => ({
      opening_debit: acc.opening_debit + (row.opening_debit || 0),
      opening_credit: acc.opening_credit + (row.opening_credit || 0),
      period_debit: acc.period_debit + (row.period_debit || 0),
      period_credit: acc.period_credit + (row.period_credit || 0),
      closing_debit: acc.closing_debit + (row.closing_debit || 0),
      closing_credit: acc.closing_credit + (row.closing_credit || 0),
    }),
    {
      opening_debit: 0,
      opening_credit: 0,
      period_debit: 0,
      period_credit: 0,
      closing_debit: 0,
      closing_credit: 0,
    }
  );

  const isBalanced = totals.closing_debit === totals.closing_credit;

  const exportCSV = () => {
    const rows = [
      [
        "Kode Akun",
        "Nama Akun",
        "Saldo Awal Debit",
        "Saldo Awal Kredit",
        "Mutasi Debit",
        "Mutasi Kredit",
        "Saldo Akhir Debit",
        "Saldo Akhir Kredit",
      ],
      ...data.map((r) => [
        r.account_code,
        `"${r.account_name}"`,
        r.opening_debit,
        r.opening_credit,
        r.period_debit,
        r.period_credit,
        r.closing_debit,
        r.closing_credit,
      ]),
      [
        "",
        "TOTAL",
        totals.opening_debit,
        totals.opening_credit,
        totals.period_debit,
        totals.period_credit,
        totals.closing_debit,
        totals.closing_credit,
      ],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Neraca_Saldo_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {isLoading ? "Memuat..." : "Terapkan Periode"}
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
            onClick={() => loadData(startDate, endDate)}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Trial Balance Table Card */}
      {isLoading ? (
        <div className="h-96 w-full animate-pulse rounded-3xl border border-zinc-100 bg-white p-6" />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            Belum Ada Data Neraca Saldo
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            Neraca saldo akan menampilkan saldo awal, mutasi debit/kredit, dan saldo penutupan dari seluruh bagan akun.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
          {/* Document Header */}
          <div className="border-b border-zinc-100 bg-[#09090B] p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                GENERAL LEDGER VERIFICATION
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                NERACA SALDO (TRIAL BALANCE)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                Periode: {startDate} s/d {endDate}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  isBalanced
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isBalanced ? "Debit & Kredit Seimbang" : "Selisih Neraca"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 font-bold uppercase tracking-wider text-[10px] text-zinc-500 font-mono">
                  <th rowSpan={2} className="py-3 pl-4 border-r border-zinc-200">
                    Akun
                  </th>
                  <th colSpan={2} className="py-2 text-center border-r border-zinc-200">
                    Saldo Awal
                  </th>
                  <th colSpan={2} className="py-2 text-center border-r border-zinc-200">
                    Mutasi Periode
                  </th>
                  <th colSpan={2} className="py-2 text-center pr-4">
                    Saldo Akhir
                  </th>
                </tr>
                <tr className="border-b border-zinc-200 bg-zinc-50/40 text-[10px] text-zinc-400 font-mono">
                  <th className="py-2 text-right pr-3 border-r border-zinc-100">Debit</th>
                  <th className="py-2 text-right pr-3 border-r border-zinc-200">Kredit</th>
                  <th className="py-2 text-right pr-3 border-r border-zinc-100">Debit</th>
                  <th className="py-2 text-right pr-3 border-r border-zinc-200">Kredit</th>
                  <th className="py-2 text-right pr-3 border-r border-zinc-100">Debit</th>
                  <th className="py-2 text-right pr-4">Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                {data.map((row) => (
                  <tr key={row.account_code} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-2.5 pl-4 border-r border-zinc-100 whitespace-nowrap">
                      <span className="font-bold text-zinc-950 mr-2">{row.account_code}</span>
                      <span className="font-sans text-zinc-700">{row.account_name}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-600 border-r border-zinc-100">
                      {row.opening_debit > 0 ? formatCurrency(row.opening_debit) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-600 border-r border-zinc-200">
                      {row.opening_credit > 0 ? formatCurrency(row.opening_credit) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-900 border-r border-zinc-100 font-medium">
                      {row.period_debit > 0 ? formatCurrency(row.period_debit) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-900 border-r border-zinc-200 font-medium">
                      {row.period_credit > 0 ? formatCurrency(row.period_credit) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-950 border-r border-zinc-100 font-bold">
                      {row.closing_debit > 0 ? formatCurrency(row.closing_debit) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-950 font-bold">
                      {row.closing_credit > 0 ? formatCurrency(row.closing_credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-900 bg-zinc-50 font-bold text-zinc-950 font-mono text-xs">
                  <td className="py-3.5 pl-4 border-r border-zinc-200 font-sans uppercase">
                    Total Neraca Saldo
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums border-r border-zinc-200">
                    {formatCurrency(totals.opening_debit)}
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums border-r border-zinc-200">
                    {formatCurrency(totals.opening_credit)}
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums border-r border-zinc-200">
                    {formatCurrency(totals.period_debit)}
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums border-r border-zinc-200">
                    {formatCurrency(totals.period_credit)}
                  </td>
                  <td className="py-3.5 pr-3 text-right tabular-nums border-r border-zinc-200 text-zinc-950">
                    {formatCurrency(totals.closing_debit)}
                  </td>
                  <td className="py-3.5 pr-4 text-right tabular-nums text-zinc-950">
                    {formatCurrency(totals.closing_credit)}
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
