"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Coins,
  HardHat,
  Loader2,
  Download,
  CheckCircle,
  FileText,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { FastTransactionEntry } from "@/components/cash-book/FastTransactionEntry";
import {
  getProjectDetailData,
  ProjectDetailData,
} from "@/app/actions/projectDetailActions";
import { getCashAccountsWithBalances } from "@/app/actions/cashAccountActions";
import { getSalesPersonProjectOptions } from "@/app/actions/salesActions";
import type { SalesPersonProjectOption } from "@/app/actions/salesActions";

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; opening_balance: number }>>([]);
  const [salesAssignments, setSalesAssignments] = useState<SalesPersonProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [res, cashAccounts, salesOptions] = await Promise.all([
        getProjectDetailData(projectId),
        getCashAccountsWithBalances(),
        getSalesPersonProjectOptions(),
      ]);
      setData(res);
      setAccounts(cashAccounts);
      setSalesAssignments(salesOptions.filter((assignment) => assignment.projectId === projectId));
    } catch (err: any) {
      console.error("Gagal memuat detail proyek:", err);
      setError(err?.message || "Gagal memuat data detail proyek.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetail();
  }, [fetchProjectDetail]);

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["Tanggal", "Keterangan", "Kategori", "Debit (Termin)", "Kredit (HPP)", "Saldo Berjalan"];
    const rows = data.transactions.map((t) => [
      t.date,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      t.debit,
      t.kredit,
      t.runningBalance,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Buku_Proyek_${data.project.code}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-950" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
        <p className="text-zinc-900 font-bold mb-1">Gagal Memuat Proyek</p>
        <p className="text-xs text-zinc-500 max-w-sm mb-4">{error || "Data proyek tidak ditemukan."}</p>
        <Link
          href="/projects"
          className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition-colors"
        >
          Kembali ke Portofolio Proyek
        </Link>
      </div>
    );
  }

  const { project, hppBreakdown, mandorAdvances } = data;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Top Navigation & Title ── */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Portofolio Proyek</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{project.name}</h1>
              <Badge variant="neutral" size="sm">
                {project.status}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Kode: <span className="font-mono font-semibold text-zinc-700">{project.code}</span> • Klien: <strong className="text-zinc-800">{project.clientName}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5 text-zinc-500" />
            <span>Export Buku Proyek</span>
          </button>
        </div>
      </div>

      {/* ── Peringatan Jika Proyek Merugi / Biaya Melebihi Pendapatan (Temuan Excel G.2) ── */}
      {data.isDeficit && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-5 shadow-sm text-xs text-rose-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-rose-950">
                Peringatan: Proyek Ini Sedang Mengalami Defisit / Merugi
              </h4>
              <p className="mt-1 text-rose-800 leading-relaxed">
                Total pengeluaran biaya proyek ({formatCurrency(data.totalSpent)}) telah melampaui seluruh penerimaan termin ({formatCurrency(data.totalReceived)}) dengan selisih defisit <strong>{formatCurrency(Math.abs(data.netProfit))}</strong> (Margin: {data.profitMargin.toFixed(1)}%).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Summary KPIs ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Diterima (Termin)"
          value={formatCurrency(data.totalReceived)}
          subtitle="Total dana masuk dari klien"
          icon={TrendingUp}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-700"
          gradient
        />
        <StatCard
          title="Total Biaya (HPP Proyek)"
          value={formatCurrency(data.totalSpent)}
          subtitle="Realisasi pengeluaran konstruksi"
          icon={Building2}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-700"
        />
        <StatCard
          title={data.isDeficit ? "Defisit Proyek" : "Sisa / Laba Proyek"}
          value={formatCurrency(Math.abs(data.netProfit))}
          subtitle={`Margin Proyek: ${data.profitMargin.toFixed(1)}%`}
          icon={CheckCircle}
          iconBgColor={data.isDeficit ? "bg-rose-500/10" : "bg-emerald-500/10"}
          iconColor={data.isDeficit ? "text-rose-700" : "text-emerald-700"}
        />
        <StatCard
          title="Plafon Upah Tukang"
          value={project.laborAdvanceLimit > 0 ? formatCurrency(project.laborAdvanceLimit) : "Tanpa Limit"}
          subtitle={`${mandorAdvances.length} Kasbon Mandor`}
          icon={HardHat}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-700"
        />
      </div>

      {/* ── Ringkasan kategori Buku Kecil & Kasbon Mandor ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ringkasan kategori pengeluaran proyek */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950 mb-3 pb-2 border-b border-zinc-100 flex items-center justify-between">
            <span>Ringkasan Biaya HPP Proyek</span>
            <span className="font-mono text-xs font-bold text-rose-700">
              Total: {formatCurrency(data.totalSpent)}
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {hppBreakdown.map(({ name, amount }) => (
              <div key={name} className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">{name}</span>
                <span className="font-mono text-sm font-bold text-zinc-900 mt-1 block">
                  {formatCurrency(amount)}
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5 block">
                  {data.totalSpent > 0 ? ((amount / data.totalSpent) * 100).toFixed(0) : 0}% HPP
                </span>
              </div>
            ))}
            {data.uncategorizedExpenseAmount > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">Belum Dikategorikan</span>
                <span className="font-mono text-sm font-bold text-amber-950 mt-1 block">
                  {formatCurrency(data.uncategorizedExpenseAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Kotak Kasbon Mandor */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950 mb-3 pb-2 border-b border-zinc-100 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HardHat className="h-4 w-4 text-amber-600" />
              Kasbon Mandor
            </span>
            <span className="text-[11px] text-zinc-400 font-normal">
              {mandorAdvances.length} berkas
            </span>
          </h3>

          {mandorAdvances.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              Belum ada kasbon mandor tercatat untuk proyek ini.
            </div>
          ) : (
            <div className="space-y-2.5">
              {mandorAdvances.map((ca) => (
                <div key={ca.id} className="rounded-xl bg-zinc-50 p-3 border border-zinc-100 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-zinc-900">{ca.mandorName}</span>
                    <Badge variant={ca.openBalance === 0 ? "success" : "warning"} size="sm">
                      {ca.openBalance === 0 ? "Lunas" : "Berjalan"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Dicairkan:</span>
                    <span className="font-mono text-zinc-800">{formatCurrency(ca.disbursed)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Sisa Kasbon:</span>
                    <span className="font-mono font-bold text-amber-700">{formatCurrency(ca.openBalance)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Fast Transaction Entry Khusus Proyek ── */}
      <FastTransactionEntry
        onSuccess={fetchProjectDetail}
        accounts={accounts}
        salesAssignments={salesAssignments}
        defaultProjectId={projectId}
        allowProjectSelection={false}
      />

      {/* ── Tabel Transaksi Proyek Ala Excel (Saldo Berjalan) ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-700" />
            Buku Proyek (Buku Kas &amp; Saldo Berjalan)
          </h3>
          <span className="text-xs text-zinc-400 font-medium">
            {data.transactions.length} baris transaksi
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="pb-3 pl-2">Tanggal</th>
              <th className="pb-3">Keterangan Transaksi</th>
              <th className="pb-3">Kategori</th>
              <th className="pb-3 text-right">Debit (Termin)</th>
              <th className="pb-3 text-right">Kredit (Biaya)</th>
              <th className="pb-3 pr-2 text-right">Saldo Berjalan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">
                  Belum ada transaksi termin maupun pengeluaran pada proyek ini.
                </td>
              </tr>
            ) : (
              data.transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-3 pl-2 font-mono text-zinc-500 whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="py-3 pr-2 font-semibold text-zinc-900">
                    {tx.description}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        tx.debit > 0
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : tx.category === "Upah Tukang"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {tx.category}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-emerald-700 font-bold whitespace-nowrap">
                    {tx.debit > 0 ? formatCurrency(tx.debit) : "-"}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-rose-700 font-bold whitespace-nowrap">
                    {tx.kredit > 0 ? formatCurrency(tx.kredit) : "-"}
                  </td>
                  <td
                    className={`py-3 pr-2 text-right font-mono tabular-nums font-black whitespace-nowrap ${
                      tx.runningBalance < 0 ? "text-rose-600" : "text-zinc-950"
                    }`}
                  >
                    {formatCurrency(tx.runningBalance)}
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
