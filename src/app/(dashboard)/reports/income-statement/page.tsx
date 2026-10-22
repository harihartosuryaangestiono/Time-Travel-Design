"use client";

import { useState, useEffect } from "react";
import { Download, Printer, Filter, AlertCircle, FileSpreadsheet } from "lucide-react";
import { fetchIncomeStatement } from "@/app/actions/reportActions";
import { createClient } from "@/lib/supabase/client";

function formatCurrency(value: number): string {
  if (isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface IncomeStatementData {
  revenue: { code: string; name: string; amount: number }[];
  cost_of_sales: { code: string; name: string; amount: number }[];
  operating_expenses: { code: string; name: string; amount: number }[];
  other_income: { code: string; name: string; amount: number }[];
  other_expenses: { code: string; name: string; amount: number }[];
  gross_profit: number;
  net_profit: number;
  total_revenue: number;
  total_cost_of_sales: number;
  total_operating_expenses: number;
  total_other_income: number;
  total_other_expenses: number;
}

export default function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [orgName, setOrgName] = useState("Time Travel Design");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<IncomeStatementData>({
    revenue: [],
    cost_of_sales: [],
    operating_expenses: [],
    other_income: [],
    other_expenses: [],
    gross_profit: 0,
    net_profit: 0,
    total_revenue: 0,
    total_cost_of_sales: 0,
    total_operating_expenses: 0,
    total_other_income: 0,
    total_other_expenses: 0,
  });

  const loadData = async (start: string, end: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Ambil nama organisasi dinamis
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from("organization_members")
          .select("organization:organizations(name)")
          .eq("profile_id", user.id)
          .single();
        if ((member as any)?.organization?.name) {
          setOrgName((member as any).organization.name);
        }
      }

      const res = await fetchIncomeStatement(start, end);
      setData({
        revenue: res.revenue || [],
        cost_of_sales: res.cost_of_sales || [],
        operating_expenses: res.operating_expenses || [],
        other_income: [],
        other_expenses: [],
        gross_profit: res.gross_profit || 0,
        net_profit: res.net_profit || 0,
        total_revenue: res.total_revenue || 0,
        total_cost_of_sales: res.total_cost_of_sales || 0,
        total_operating_expenses: res.total_operating_expenses || 0,
        total_other_income: 0,
        total_other_expenses: 0,
      });
    } catch (err: any) {
      console.error("Gagal memuat laba rugi:", err);
      setErrorMessage(err.message || "Gagal memuat laporan laba rugi dari database.");
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
      ["Kode Akun", "Nama Akun", "Kategori", "Jumlah (IDR)"],
      ...data.revenue.map((r) => [r.code, `"${r.name}"`, "Pendapatan", r.amount]),
      ["", "Total Pendapatan", "", data.total_revenue],
      ...data.cost_of_sales.map((c) => [c.code, `"${c.name}"`, "HPP Proyek", c.amount]),
      ["", "Total HPP Proyek", "", data.total_cost_of_sales],
      ["", "LABA KOTOR", "", data.gross_profit],
      ...data.operating_expenses.map((o) => [o.code, `"${o.name}"`, "Biaya Operasional", o.amount]),
      ["", "Total Biaya Operasional", "", data.total_operating_expenses],
      ["", "LABA BERSIH", "", data.net_profit],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laba_Rugi_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const grossMargin =
    data.total_revenue > 0
      ? ((data.gross_profit / data.total_revenue) * 100).toFixed(1)
      : "0.0";
  const netMargin =
    data.total_revenue > 0
      ? ((data.net_profit / data.total_revenue) * 100).toFixed(1)
      : "0.0";

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

      {/* Financial Statement Card */}
      {isLoading ? (
        <div className="h-96 w-full animate-pulse rounded-3xl border border-zinc-100 bg-white p-6" />
      ) : data.revenue.length === 0 &&
        data.cost_of_sales.length === 0 &&
        data.operating_expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">
            Belum Ada Transaksi Pendapatan atau Beban
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            Laporan laba rugi akan otomatis terakumulasi dari invoice terbayar dan pengeluaran proyek yang tercatat.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
          {/* Document Header */}
          <div className="border-b border-zinc-100 bg-[#09090B] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-300 font-bold">
                  LAPORAN KEUANGAN
                </span>
                <span className="text-xs text-zinc-400 font-mono">{orgName}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-white">
                Laporan Laba Rugi Komprehensif
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Periode: {startDate} s/d {endDate} • Mata Uang: IDR
              </p>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Margin Kotor</span>
                <p className="text-lg font-bold text-white font-mono">{grossMargin}%</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Margin Bersih</span>
                <p className="text-lg font-bold text-white font-mono">{netMargin}%</p>
              </div>
            </div>
          </div>

          {/* Statement Body */}
          <div className="p-6 sm:p-8 space-y-8 text-sm">
            {/* Section 1: Revenue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
                <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                  1. Pendapatan Operasional &amp; Jasa Desain
                </h3>
                <span className="text-xs text-zinc-400 font-mono font-semibold">KODE AKUN</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.revenue.length > 0 ? (
                  data.revenue.map((item) => (
                    <div key={item.code} className="flex justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                        <span className="text-zinc-700 font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-zinc-900 font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-xs text-zinc-400">Tidak ada pendapatan tercatat pada periode ini</p>
                )}
              </div>
              <div className="flex justify-between border-t border-zinc-300 pt-2.5 font-bold text-zinc-900">
                <span>Total Pendapatan Operasional</span>
                <span className="font-mono tabular-nums text-zinc-900">
                  {formatCurrency(data.total_revenue)}
                </span>
              </div>
            </div>

            {/* Section 2: COGS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
                <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                  2. Beban Pokok Proyek &amp; Material Langsung (HPP)
                </h3>
                <span className="text-xs text-zinc-400 font-mono font-semibold">KODE AKUN</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.cost_of_sales.length > 0 ? (
                  data.cost_of_sales.map((item) => (
                    <div key={item.code} className="flex justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                        <span className="text-zinc-700 font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-rose-600 font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-xs text-zinc-400">Tidak ada beban HPP pada periode ini</p>
                )}
              </div>
              <div className="flex justify-between border-t border-zinc-300 pt-2.5 font-bold text-zinc-900">
                <span>Total Beban Pokok Proyek</span>
                <span className="font-mono tabular-nums text-rose-600">
                  {formatCurrency(data.total_cost_of_sales)}
                </span>
              </div>
            </div>

            {/* Gross Profit Callout */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 flex justify-between items-center font-bold">
              <span className="text-zinc-900 uppercase tracking-tight text-xs sm:text-sm">
                LABA KOTOR (GROSS PROFIT)
              </span>
              <span className="text-base sm:text-lg font-mono tabular-nums text-zinc-950">
                {formatCurrency(data.gross_profit)}
              </span>
            </div>

            {/* Section 3: Operating Expenses */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-2">
                <h3 className="font-bold uppercase tracking-wider text-zinc-900 text-xs">
                  3. Beban Operasional &amp; Administrasi Studio
                </h3>
                <span className="text-xs text-zinc-400 font-mono font-semibold">KODE AKUN</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.operating_expenses.length > 0 ? (
                  data.operating_expenses.map((item) => (
                    <div key={item.code} className="flex justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-zinc-400 w-12">{item.code}</span>
                        <span className="text-zinc-700 font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-rose-600 font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-xs text-zinc-400">Tidak ada beban operasional pada periode ini</p>
                )}
              </div>
              <div className="flex justify-between border-t border-zinc-300 pt-2.5 font-bold text-zinc-900">
                <span>Total Beban Operasional</span>
                <span className="font-mono tabular-nums text-rose-600">
                  {formatCurrency(data.total_operating_expenses)}
                </span>
              </div>
            </div>

            {/* Net Profit Callout */}
            <div className="rounded-2xl border-2 border-zinc-950 bg-[#09090B] p-5 text-white flex justify-between items-center font-bold">
              <div>
                <span className="text-xs uppercase tracking-wider text-zinc-400 block font-mono">
                  HASIL OPERASIONAL BERSIH
                </span>
                <span className="text-base sm:text-lg tracking-tight">
                  LABA / (RUGI) BERSIH TAHUN BERJALAN
                </span>
              </div>
              <span
                className={`text-xl sm:text-2xl font-mono tabular-nums ${
                  data.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCurrency(data.net_profit)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
