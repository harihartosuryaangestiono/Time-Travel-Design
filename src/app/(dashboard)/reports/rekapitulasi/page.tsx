"use client";

import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Building2,
  Calendar,
  Wallet,
  Coins,
  CheckCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import {
  getRekapitulasiData,
  RekapitulasiReportData,
} from "@/app/actions/rekapitulasiActions";

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export default function RekapitulasiPage() {
  const [data, setData] = useState<RekapitulasiReportData | null>(null);
  const [year, setYear] = useState<number>(2026);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getRekapitulasiData(year);
      setData(res);
    } catch (err: any) {
      console.error("Gagal memuat rekapitulasi:", err);
      setError(err?.message || "Gagal memuat laporan rekapitulasi keuangan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  const handleExportCSV = () => {
    if (!data) return;

    const rows: string[] = [];
    rows.push("PT. RUMA INOVASI INDONESIA");
    rows.push("Time Travel Design");
    rows.push(`Laporan Keuangan Rekapitulasi - Tahun ${data.fiscalYear}`);
    rows.push("");
    rows.push("No,Keterangan,Debit,Kredit,Total");

    // 1. Revenue
    rows.push("Penghasilan / Omset / Nilai Kontrak (Revenue),,,,");
    data.revenues.forEach((r, idx) => {
      rows.push(`${idx + 1},"${r.projectName} - ${r.clientName}",${r.totalReceived},,`);
    });
    rows.push(`,"TOTAL REVENUE",,,"${data.totalRevenue}"`);
    rows.push("");

    // 2. HPP
    rows.push("Harga Pokok Penjualan (HPP) / COGS,,,,");
    data.hppCategories.forEach((h, idx) => {
      rows.push(`${idx + 1},"${h.name}",,${h.amount},`);
    });
    rows.push(`,"TOTAL HPP",,,"${data.totalHpp}"`);
    rows.push(`,"LABA KOTOR (GROSS INCOME)",,,,"${data.grossProfit}"`);
    rows.push("");

    // 3. OPEX
    rows.push("Biaya Operasional (Operational Expenses),,,,");
    data.opexCategories.forEach((o, idx) => {
      rows.push(`${idx + 1},"${o.name}",,${o.amount},`);
    });
    rows.push(`,"TOTAL BIAYA OPERASIONAL",,,"${data.totalOpex}"`);
    rows.push(`,"LABA BERSIH (NET INCOME)",,,,"${data.netIncome}"`);
    rows.push("");

    // 4. CAPEX
    rows.push("Biaya Aset dan Investasi (Capital Expenditure),,,,");
    data.capexCategories.forEach((c, idx) => {
      rows.push(`${idx + 1},"${c.name}",,${c.amount},`);
    });
    rows.push(`,"TOTAL CAPEX",,,"${data.totalCapex}"`);
    rows.push("");

    // 5. Saldo Kas & Kasbon
    rows.push(`,"Kas Awal 2025",,,,"${data.openingCash}"`);
    rows.push(`,"Kas Saat Ini (Database)",,,,"${data.currentCash}"`);
    data.ownerAdvances.forEach((oa) => {
      rows.push(`,"Kasbon ${oa.name}",,,,"${oa.amount}"`);
    });
    rows.push(`,"Kas Setelah Kasbon",,,,"${data.cashAfterAdvances}"`);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekapitulasi_Lapkeu_${data.fiscalYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Header Laporan Ala Excel ── */}
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
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            Rekapitulasi Laporan Keuangan
          </h2>
          <p className="text-xs text-zinc-500">
            Replika resmi sheet Rekapitulasi Lapkeu (Pendapatan, HPP, Opex, Capex, dan Kasbon Owner)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-transparent font-bold text-zinc-900 focus:outline-none"
            >
              <option value={2026}>Tahun Buku 2026</option>
              <option value={2025}>Tahun Buku 2025</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isLoading || !data}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </button>
        </div>
      )}

      {/* ── Peringatan Transaksi Belum Berkategori (Temuan Excel G.1) ── */}
      {data && data.totalUncategorized > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-sm text-xs text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-amber-950">
                Peringatan: Terdapat {data.uncategorizedExpenses.length} Transaksi Belum Berkategori ({formatCurrency(data.totalUncategorized)})
              </h4>
              <p className="text-amber-800 leading-relaxed">
                Di Excel pembukuan lama, Rp 33,65 juta pengeluaran tanpa kategori tidak ikut terhitung pada rumus penjumlahan rekapitulasi, menyebabkan laba kotor tercatat terlalu tinggi. Di web ini, seluruh pengeluaran wajib memiliki kategori agar laba akurat.
              </p>
              <div className="pt-2">
                <span className="font-semibold text-amber-900">Contoh baris belum berkategori: </span>
                {data.uncategorizedExpenses.slice(0, 3).map((u, i) => (
                  <span key={u.id} className="inline-block bg-white/70 px-2 py-0.5 rounded text-[11px] font-mono mr-1.5 border border-amber-200">
                    {u.desc} ({formatCurrency(u.amount)})
                  </span>
                ))}
                {data.uncategorizedExpenses.length > 3 && (
                  <span className="text-[11px] text-amber-700">
                    + {data.uncategorizedExpenses.length - 3} lainnya
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Ringkasan Atas ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Nilai Kontrak (Revenue)"
          value={isLoading || !data ? "..." : formatCurrency(data.totalRevenue)}
          subtitle={`${data?.revenues.length || 0} Proyek Berjalan`}
          icon={Building2}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-700"
          gradient
        />
        <StatCard
          title="Laba Kotor (Gross Income)"
          value={isLoading || !data ? "..." : formatCurrency(data.grossProfit)}
          subtitle={`Margin Kotor: ${data ? data.grossMargin.toFixed(1) : 0}%`}
          icon={TrendingUp}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-700"
        />
        <StatCard
          title="Laba Bersih (Net Income)"
          value={isLoading || !data ? "..." : formatCurrency(data.netIncome)}
          subtitle={`Margin Bersih: ${data ? data.netMargin.toFixed(1) : 0}%`}
          icon={CheckCircle}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-700"
        />
        <StatCard
          title="Kas Saat Ini (Riil)"
          value={isLoading || !data ? "..." : formatCurrency(data.currentCash)}
          subtitle={`Setelah Kasbon: ${data ? formatCurrency(data.cashAfterAdvances) : "..."}`}
          icon={Wallet}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
      </div>

      {/* ── TABEL UTAMA REKAPITULASI (REPLIKA SHEET ASLI) ── */}
      {data && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto space-y-8">
          {/* 1. Pendapatan Proyek */}
          <div>
            <div className="border-b-2 border-zinc-950 pb-2 mb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-950">
                1. Penghasilan / Omset / Nilai Kontrak (Revenue)
              </h3>
              <span className="font-mono text-xs font-bold text-zinc-900">
                Total: {formatCurrency(data.totalRevenue)}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <th className="py-2 pl-2 w-12">No</th>
                  <th className="py-2">Nama Proyek &amp; Klien</th>
                  <th className="py-2 text-right">Debit (Diterima)</th>
                  <th className="py-2 text-right">Kredit</th>
                  <th className="py-2 pr-2 text-right">Total Akumulasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.revenues.map((r, idx) => (
                  <tr key={r.projectId} className="hover:bg-zinc-50/70">
                    <td className="py-2.5 pl-2 font-mono text-zinc-400">{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">
                      {r.projectName} <span className="text-zinc-400 font-normal">({r.clientName})</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-zinc-950">
                      {formatCurrency(r.totalReceived)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-300">-</td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums font-semibold text-zinc-800">
                      {idx === 0 ? formatCurrency(data.totalRevenue) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. HPP (COGS) */}
          <div>
            <div className="border-b-2 border-zinc-950 pb-2 mb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-950">
                2. Harga Pokok Penjualan (HPP) / Cost of Goods Sold (COGS)
              </h3>
              <span className="font-mono text-xs font-bold text-rose-700">
                Total: {formatCurrency(data.totalHpp)}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <th className="py-2 pl-2 w-12">No</th>
                  <th className="py-2">Kategori Biaya HPP</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Kredit (Realisasi)</th>
                  <th className="py-2 pr-2 text-right">Total Akumulasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.hppCategories.map((h, idx) => (
                  <tr key={h.name} className="hover:bg-zinc-50/70">
                    <td className="py-2.5 pl-2 font-mono text-zinc-400">{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">{h.name}</td>
                    <td className="py-2.5 text-right font-mono text-zinc-300">-</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-rose-700">
                      {formatCurrency(h.amount)}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums font-semibold text-zinc-800">
                      {idx === 0 ? formatCurrency(data.totalHpp) : ""}
                    </td>
                  </tr>
                ))}
                {/* Laba Kotor */}
                <tr className="bg-emerald-50/80 font-bold border-t-2 border-emerald-200">
                  <td colSpan={2} className="py-3 pl-3 text-emerald-950">
                    LABA KOTOR (GROSS INCOME)
                  </td>
                  <td className="py-3 text-right font-mono text-emerald-950">
                    {formatCurrency(data.grossProfit)}
                  </td>
                  <td colSpan={2} className="py-3 pr-3 text-right text-emerald-800 text-[11px]">
                    Margin Kotor: {data.grossMargin.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. OPEX */}
          <div>
            <div className="border-b-2 border-zinc-950 pb-2 mb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-950">
                3. Biaya Operasional (Operational Expenses)
              </h3>
              <span className="font-mono text-xs font-bold text-zinc-900">
                Total: {formatCurrency(data.totalOpex)}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <th className="py-2 pl-2 w-12">No</th>
                  <th className="py-2">Kategori Beban Kantor</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Kredit</th>
                  <th className="py-2 pr-2 text-right">Total Akumulasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.opexCategories.map((o, idx) => (
                  <tr key={o.name} className="hover:bg-zinc-50/70">
                    <td className="py-2.5 pl-2 font-mono text-zinc-400">{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">{o.name}</td>
                    <td className="py-2.5 text-right font-mono text-zinc-300">-</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-zinc-700">
                      {formatCurrency(o.amount)}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums font-semibold text-zinc-800">
                      {idx === 0 ? formatCurrency(data.totalOpex) : ""}
                    </td>
                  </tr>
                ))}
                {/* Laba Bersih */}
                <tr className="bg-purple-50/80 font-bold border-t-2 border-purple-200">
                  <td colSpan={2} className="py-3 pl-3 text-purple-950">
                    LABA BERSIH (NET INCOME)
                  </td>
                  <td className="py-3 text-right font-mono text-purple-950">
                    {formatCurrency(data.netIncome)}
                  </td>
                  <td colSpan={2} className="py-3 pr-3 text-right text-purple-800 text-[11px]">
                    Margin Bersih: {data.netMargin.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. CAPEX */}
          <div>
            <div className="border-b-2 border-zinc-950 pb-2 mb-3 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-950">
                4. Biaya Aset dan Investasi (Capital Expenditure)
              </h3>
              <span className="font-mono text-xs font-bold text-zinc-900">
                Total: {formatCurrency(data.totalCapex)}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <th className="py-2 pl-2 w-12">No</th>
                  <th className="py-2">Pos Pengeluaran Modal</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Kredit</th>
                  <th className="py-2 pr-2 text-right">Total Akumulasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.capexCategories.map((c, idx) => (
                  <tr key={c.name} className="hover:bg-zinc-50/70">
                    <td className="py-2.5 pl-2 font-mono text-zinc-400">{idx + 1}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">{c.name}</td>
                    <td className="py-2.5 text-right font-mono text-zinc-300">-</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-zinc-700">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums font-semibold text-zinc-800">
                      {idx === 0 ? formatCurrency(data.totalCapex) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5. Rekonsiliasi Kas & Kasbon Owner */}
          <div className="rounded-2xl bg-zinc-50 p-5 border border-zinc-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 mb-4 pb-2 border-b border-zinc-200">
              5. Posisi Kas &amp; Pertanggungjawaban Kasbon Owner
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-2.5">
                <div className="flex justify-between py-1 border-b border-zinc-200">
                  <span className="text-zinc-600">Kas Awal Modal 2025:</span>
                  <span className="font-mono font-bold text-zinc-900">{formatCurrency(data.openingCash)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-200">
                  <span className="text-zinc-600">Total Kas Saat Ini (Database):</span>
                  <span className="font-mono font-bold text-emerald-700">{formatCurrency(data.currentCash)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-200">
                  <span className="text-zinc-600">Total Kasbon Owner (Terpakai):</span>
                  <span className="font-mono font-bold text-amber-700">{formatCurrency(data.totalOwnerAdvances)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-sm bg-white p-2 rounded-xl border border-zinc-200">
                  <span className="text-zinc-900">Kas Bersih Setelah Kasbon:</span>
                  <span className="font-mono text-zinc-950">{formatCurrency(data.cashAfterAdvances)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-zinc-700 block mb-1">Rincian Kasbon Owner:</span>
                {data.ownerAdvances.map((oa) => (
                  <div key={oa.name} className="flex justify-between items-center p-2 rounded-xl bg-white border border-zinc-200">
                    <div>
                      <span className="font-semibold text-zinc-900 block">{oa.name}</span>
                      <span className="text-[10px] text-zinc-400">Sisa Plafon: {formatCurrency(oa.remainingLimit)}</span>
                    </div>
                    <span className="font-mono font-bold text-amber-800">{formatCurrency(oa.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
