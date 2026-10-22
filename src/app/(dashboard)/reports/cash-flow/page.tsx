"use client";

import { useState, useEffect } from "react";
import { Download, Printer, Filter, ArrowUpRight, ArrowDownRight, Wallet, AlertCircle, FileSpreadsheet } from "lucide-react";
import { fetchCashFlow } from "@/app/actions/reportActions";

function formatCurrency(value: number): string {
  if (isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface CashFlowActivity {
  description: string;
  amount: number;
}

interface CashFlowData {
  opening_balance: number;
  closing_balance: number;
  net_change: number;
  operating_activities: CashFlowActivity[];
  investing_activities: CashFlowActivity[];
  financing_activities: CashFlowActivity[];
}

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<CashFlowData>({
    opening_balance: 0,
    closing_balance: 0,
    net_change: 0,
    operating_activities: [],
    investing_activities: [],
    financing_activities: [],
  });

  const loadData = async (start: string, end: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetchCashFlow(start, end);
      setData({
        opening_balance: res.opening_balance || 0,
        closing_balance: res.closing_balance || 0,
        net_change: res.net_change || 0,
        operating_activities: res.operating_activities || [],
        investing_activities: res.investing_activities || [],
        financing_activities: res.financing_activities || [],
      });
    } catch (err: any) {
      console.error("Gagal memuat arus kas:", err);
      setErrorMessage(err.message || "Gagal memuat laporan arus kas dari database.");
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

  const exportCSV = () => {
    const rows = [
      ["Kategori", "Aktivitas Arus Kas", "Jumlah (IDR)"],
      ["Saldo Awal Kas", "Saldo Awal Kas & Bank", data.opening_balance],
      ...data.operating_activities.map((a) => ["Operasional", `"${a.description}"`, a.amount]),
      ...data.investing_activities.map((a) => ["Investasi", `"${a.description}"`, a.amount]),
      ...data.financing_activities.map((a) => ["Pendanaan", `"${a.description}"`, a.amount]),
      ["Kenaikan/(Penurunan) Bersih", "Net Cash Change", data.net_change],
      ["Saldo Akhir Kas", "Saldo Akhir Kas & Bank", data.closing_balance],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Arus_Kas_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const operatingTotal = data.operating_activities.reduce((sum, a) => sum + (a.amount || 0), 0);
  const investingTotal = data.investing_activities.reduce((sum, a) => sum + (a.amount || 0), 0);
  const financingTotal = data.financing_activities.reduce((sum, a) => sum + (a.amount || 0), 0);

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

      {/* Cash Position Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
            SALDO AWAL KAS
          </span>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xl font-bold text-zinc-950 font-mono tabular-nums">
              {isLoading ? "..." : formatCurrency(data.opening_balance)}
            </span>
            <Wallet className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Saldo kas &amp; bank per {startDate}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
            PERUBAHAN BERSIH PERIODE
          </span>
          <div className="mt-1 flex items-center justify-between">
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                data.net_change >= 0 ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {isLoading
                ? "..."
                : `${data.net_change >= 0 ? "+" : ""}${formatCurrency(data.net_change)}`}
            </span>
            {data.net_change >= 0 ? (
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-rose-600" />
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Net operating, investing &amp; financing</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#09090B] p-5 text-white shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
            SALDO AKHIR KAS TERVERIFIKASI
          </span>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xl font-bold text-white font-mono tabular-nums">
              {isLoading ? "..." : formatCurrency(data.closing_balance)}
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
              Verified
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">Total likuiditas aktif per {endDate}</p>
        </div>
      </div>

      {/* Main Statement Breakdown */}
      {isLoading ? (
        <div className="h-96 w-full animate-pulse rounded-3xl border border-zinc-100 bg-white p-6" />
      ) : data.operating_activities.length === 0 &&
        data.investing_activities.length === 0 &&
        data.financing_activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            Belum Ada Transaksi Arus Kas
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            Aktivitas arus kas akan otomatis terhitung dari pergerakan akun kas &amp; bank dalam periode yang dipilih.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                STATEMENT OF CASH FLOWS
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                RINGKASAN ARUS KAS METODE LANGSUNG
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              {startDate} s/d {endDate}
            </span>
          </div>

          <div className="p-6 space-y-8 text-xs">
            {/* 1. OPERATING ACTIVITIES */}
            <div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-3">
                <h3 className="font-bold text-zinc-950 uppercase tracking-wider font-mono text-[11px]">
                  1. Arus Kas dari Aktivitas Operasional
                </h3>
                <span
                  className={`font-mono font-bold ${
                    operatingTotal >= 0 ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(operatingTotal)}
                </span>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.operating_activities.map((act, idx) => (
                  <div key={idx} className="flex justify-between py-2">
                    <span className="text-zinc-700">{act.description}</span>
                    <span
                      className={`font-mono font-medium tabular-nums ${
                        act.amount >= 0 ? "text-zinc-900" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(act.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. INVESTING ACTIVITIES */}
            <div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-3">
                <h3 className="font-bold text-zinc-950 uppercase tracking-wider font-mono text-[11px]">
                  2. Arus Kas dari Aktivitas Investasi
                </h3>
                <span
                  className={`font-mono font-bold ${
                    investingTotal >= 0 ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(investingTotal)}
                </span>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.investing_activities.length > 0 ? (
                  data.investing_activities.map((act, idx) => (
                    <div key={idx} className="flex justify-between py-2">
                      <span className="text-zinc-700">{act.description}</span>
                      <span
                        className={`font-mono font-medium tabular-nums ${
                          act.amount >= 0 ? "text-zinc-900" : "text-rose-600"
                        }`}
                      >
                        {formatCurrency(act.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-zinc-400">Tidak ada transaksi investasi pada periode ini</p>
                )}
              </div>
            </div>

            {/* 3. FINANCING ACTIVITIES */}
            <div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-3">
                <h3 className="font-bold text-zinc-950 uppercase tracking-wider font-mono text-[11px]">
                  3. Arus Kas dari Aktivitas Pendanaan
                </h3>
                <span
                  className={`font-mono font-bold ${
                    financingTotal >= 0 ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(financingTotal)}
                </span>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.financing_activities.length > 0 ? (
                  data.financing_activities.map((act, idx) => (
                    <div key={idx} className="flex justify-between py-2">
                      <span className="text-zinc-700">{act.description}</span>
                      <span
                        className={`font-mono font-medium tabular-nums ${
                          act.amount >= 0 ? "text-zinc-900" : "text-rose-600"
                        }`}
                      >
                        {formatCurrency(act.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-zinc-400">Tidak ada transaksi pendanaan pada periode ini</p>
                )}
              </div>
            </div>
          </div>

          {/* Reconciliation Footer */}
          <div className="border-t border-zinc-200 bg-zinc-50 p-6 space-y-2 text-xs">
            <div className="flex justify-between font-semibold text-zinc-700">
              <span>Saldo Kas Awal Periode</span>
              <span className="font-mono">{formatCurrency(data.opening_balance)}</span>
            </div>
            <div className="flex justify-between font-semibold text-zinc-700">
              <span>Total Kenaikan / (Penurunan) Kas Bersih</span>
              <span className="font-mono">{formatCurrency(data.net_change)}</span>
            </div>
            <div className="flex justify-between font-bold text-zinc-950 text-sm pt-2 border-t border-zinc-200">
              <span>SALDO KAS AKHIR PERIODE</span>
              <span className="font-mono text-base">{formatCurrency(data.closing_balance)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
