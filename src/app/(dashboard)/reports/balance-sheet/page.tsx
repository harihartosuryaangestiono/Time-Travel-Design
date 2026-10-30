"use client";

import { useState, useEffect } from "react";
import { Download, Printer, Filter, ShieldCheck, AlertCircle, FileSpreadsheet } from "lucide-react";
import { fetchBalanceSheet } from "@/app/actions/reportActions";

function formatCurrency(value: number): string {
  if (isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface BalanceSheetData {
  assets: { code: string; name: string; amount: number }[];
  liabilities: { code: string; name: string; amount: number }[];
  equity: { code: string; name: string; amount: number }[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  current_profit_loss: number;
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<BalanceSheetData>({
    assets: [],
    liabilities: [],
    equity: [],
    total_assets: 0,
    total_liabilities: 0,
    total_equity: 0,
    current_profit_loss: 0,
  });

  const loadData = async (date: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetchBalanceSheet(date);
      setData({
        assets: res.assets || [],
        liabilities: res.liabilities || [],
        equity: res.equity || [],
        total_assets: res.total_assets || 0,
        total_liabilities: res.total_liabilities || 0,
        total_equity: res.total_equity || 0,
        current_profit_loss: res.current_profit_loss || 0,
      });
    } catch (err: any) {
      console.error("Gagal memuat neraca keuangan:", err);
      setErrorMessage(err.message || "Gagal memuat neraca keuangan dari database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(asOfDate);
  }, []);

  const handleGenerate = () => {
    loadData(asOfDate);
  };

  const exportCSV = () => {
    const rows = [
      ["Kode Akun", "Nama Akun", "Kategori", "Jumlah (IDR)"],
      ...data.assets.map((a) => [a.code, `"${a.name}"`, "Aset", a.amount]),
      ...data.liabilities.map((l) => [l.code, `"${l.name}"`, "Kewajiban", l.amount]),
      ...data.equity.map((e) => [e.code, `"${e.name}"`, "Ekuitas", e.amount]),
      ["", "Laba Tahun Berjalan", "Ekuitas", data.current_profit_loss],
      ["", "TOTAL ASET", "", data.total_assets],
      ["", "TOTAL KEWAJIBAN & EKUITAS", "", totalLiabilitiesAndEquity],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Neraca_Keuangan_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalLiabilitiesAndEquity =
    data.total_liabilities + data.total_equity + data.current_profit_loss;
  const isBalanced = data.total_assets === totalLiabilitiesAndEquity;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Filter and Action Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Per Tanggal:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-800 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

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
            onClick={() => loadData(asOfDate)}
            className="ml-auto underline hover:text-rose-950 font-semibold"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Balance Verification Banner */}
      <div
        className={`flex items-center gap-3 rounded-2xl p-4 border ${
          isBalanced
            ? "border-zinc-300 bg-zinc-50 text-zinc-900"
            : "border-rose-200 bg-rose-50 text-rose-800"
        }`}
      >
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-zinc-950" />
        <div className="text-xs">
          <span className="font-bold">
            {isBalanced
              ? "Keseimbangan Neraca Terverifikasi (Seimbang)"
              : "Peringatan: Selisih Keseimbangan Akuntansi"}
          </span>
          <p className="mt-0.5 text-zinc-500 font-mono">
            Total Aset ({formatCurrency(data.total_assets)}) = Total Kewajiban &amp; Ekuitas ({formatCurrency(totalLiabilitiesAndEquity)})
          </p>
        </div>
      </div>

      {/* Two Column Balance Sheet */}
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-3xl border border-zinc-100 bg-white p-6" />
          <div className="h-80 animate-pulse rounded-3xl border border-zinc-100 bg-white p-6" />
        </div>
      ) : data.assets.length === 0 && data.liabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            Belum Ada Transaksi Neraca
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            Neraca akan terisi otomatis seiring adanya transaksi jurnal, kas, dan aset yang dicatat.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ASSETS */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                  AKTIVA &amp; LIKUIDITAS
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">ASET &amp; PIUTANG</h2>
              </div>
              <div className="divide-y divide-zinc-100 p-5 space-y-1">
                {data.assets.map((item) => (
                  <div key={item.code} className="flex justify-between py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-400 w-12">{item.code}</span>
                      <span className="font-medium text-zinc-700">{item.name}</span>
                    </div>
                    <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 p-5 flex justify-between items-center font-bold text-sm">
              <span className="text-zinc-900 uppercase tracking-tight">TOTAL ASET</span>
              <span className="font-mono tabular-nums text-zinc-950 text-base">
                {formatCurrency(data.total_assets)}
              </span>
            </div>
          </div>

          {/* LIABILITIES & EQUITY */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="border-b border-zinc-100 bg-[#09090B] p-5 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                  PASIVA &amp; MODAL
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">KEWAJIBAN &amp; EKUITAS</h2>
              </div>

              <div className="p-5 space-y-6 text-xs">
                {/* Liabilities */}
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] border-b border-zinc-200 pb-1 font-mono">
                    1. Kewajiban Lancar &amp; Jangka Panjang
                  </h4>
                  <div className="divide-y divide-zinc-100">
                    {data.liabilities.length > 0 ? (
                      data.liabilities.map((item) => (
                        <div key={item.code} className="flex justify-between py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-400 w-12">{item.code}</span>
                            <span className="font-medium text-zinc-700">{item.name}</span>
                          </div>
                          <span className="font-mono tabular-nums text-rose-600 font-semibold">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="py-2 text-zinc-400">Tidak ada kewajiban tercatat</p>
                    )}
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-zinc-800">
                    <span>Subtotal Kewajiban</span>
                    <span className="font-mono">{formatCurrency(data.total_liabilities)}</span>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] border-b border-zinc-200 pb-1 font-mono">
                    2. Modal &amp; Ekuitas Pemilik
                  </h4>
                  <div className="divide-y divide-zinc-100">
                    {data.equity.map((item) => (
                      <div key={item.code} className="flex justify-between py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-400 w-12">{item.code}</span>
                          <span className="font-medium text-zinc-700">{item.name}</span>
                        </div>
                        <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-500 w-12">YTD</span>
                        <span className="font-bold text-zinc-900">Laba Bersih Tahun Berjalan</span>
                      </div>
                      <span className="font-mono tabular-nums text-zinc-900 font-bold">
                        {formatCurrency(data.current_profit_loss)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-zinc-800">
                    <span>Subtotal Ekuitas &amp; Laba</span>
                    <span className="font-mono">
                      {formatCurrency(data.total_equity + data.current_profit_loss)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 p-5 flex justify-between items-center font-bold text-sm">
              <span className="text-zinc-900 uppercase tracking-tight">TOTAL KEWAJIBAN &amp; EKUITAS</span>
              <span className="font-mono tabular-nums text-zinc-950 text-base">
                {formatCurrency(totalLiabilitiesAndEquity)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
