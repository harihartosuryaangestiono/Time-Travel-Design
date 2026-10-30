"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  History,
  Download,
  AlertOctagon,
  FileCheck2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  executeImportBatchRows,
  finishImportBatch,
  getImportBatches,
  ImportBatchSummary,
  startImportBatch,
} from "@/app/actions/importActions";
import {
  parseCsv,
  parseSingleSheetExcel,
  checkExcelWorkbook,
  generateCsvTemplate,
  ParsedRow,
  ParsedImportResult,
} from "@/lib/import/excelParser";

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export default function ImportPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ParsedImportResult | null>(null);
  const [unsupportedWorkbookMsg, setUnsupportedWorkbookMsg] = useState<string | null>(null);

  // Filter tampilan pratinjau
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "SKIPPED" | "NEEDS_CAT" | "ERROR">("ALL");
  const [filterJenis, setFilterJenis] = useState<string>("ALL");

  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchBatches = async () => {
    try {
      setIsLoadingBatches(true);
      const res = await getImportBatches();
      setBatches(res);
    } catch (err) {
      console.error("Gagal memuat batch impor:", err);
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat riwayat impor.");
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Download template CSV ber-BOM UTF-8
  const handleDownloadTemplate = () => {
    const csvContent = generateCsvTemplate();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "template_transaksi_pembukuan_ttd.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setUnsupportedWorkbookMsg(null);
      setFileName(file.name);

      const isCsv = file.name.endsWith(".csv");

      if (isCsv) {
        const text = await file.text();
        const res = parseCsv(text);
        setImportResult(res);
      } else {
        // File Excel .xlsx / .xls
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { cellDates: true });

        // Cek apakah multi-sheet atau mengandung sheet Rekapitulasi
        const check = checkExcelWorkbook(workbook);
        if (!check.isSupported) {
          setUnsupportedWorkbookMsg(
            check.reason || "Format workbook multi-sheet belum didukung di UI. Gunakan template CSV atau skrip import-ttd-2026."
          );
          setImportResult(null);
          return;
        }

        // Single-sheet Excel
        const targetSheetName = check.sheetName || workbook.SheetNames[0];
        const sheet = workbook.Sheets[targetSheetName];
        const res = parseSingleSheetExcel(sheet, targetSheetName);
        setImportResult(res);
      }
    } catch (err: any) {
      console.error("Error parsing import file:", err);
      setErrorMsg(`Gagal membaca berkas: ${err?.message || "Format berkas tidak valid."}`);
      setImportResult(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!fileName || !importResult || importResult.rows.length === 0) return;

    // Larang konfirmasi jika ada baris error
    if (importResult.totalInvalid > 0) {
      setErrorMsg(`Terdapat ${importResult.totalInvalid} baris transaksi yang tidak valid. Perbaiki berkas sebelum mengimpor.`);
      return;
    }

    let importStarted = false;
    let processedRows = 0;

    try {
      setIsExecutingImport(true);
      setErrorMsg(null);

      const { batchId } = await startImportBatch({
        fileName,
        totalRows: importResult.rows.length,
      });
      importStarted = true;

      const chunkSize = 10;
      setImportProgress({ done: 0, total: importResult.rows.length });

      for (let offset = 0; offset < importResult.rows.length; offset += chunkSize) {
        const rows = importResult.rows.slice(offset, offset + chunkSize);
        await executeImportBatchRows({ batchId, rows });
        processedRows += rows.length;
        setImportProgress({ done: processedRows, total: importResult.rows.length });
      }

      const res = await finishImportBatch(batchId);
      if (!res || typeof res.successRows !== "number") {
        throw new Error("Server tidak mengembalikan ringkasan hasil impor. Muat ulang riwayat batch untuk memeriksa statusnya.");
      }

      setSuccessMsg(
        `Impor selesai! Berhasil menyimpan ${res.successRows} baris transaksi${
          importResult.totalSkipped > 0 ? ` (${importResult.totalSkipped} baris SETORAN_PROYEK dilewati agar tidak tercatat dobel).` : "."
        }`
      );

      setFileName(null);
      setImportResult(null);
      setUnsupportedWorkbookMsg(null);
      await fetchBatches();
    } catch (err: any) {
      console.error("Gagal mengeksekusi impor:", err);
      const detail = err?.message || "Terjadi kesalahan saat memproses impor.";
      const progressMessage = importStarted
        ? ` Batch mungkin sudah menyimpan sebagian data (${processedRows} dari ${importResult.rows.length} baris terkonfirmasi). Periksa riwayat impor sebelum mencoba kembali.`
        : "";
      setErrorMsg(`${detail}${progressMessage}`);
    } finally {
      setIsExecutingImport(false);
      setImportProgress(null);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setImportResult(null);
    setUnsupportedWorkbookMsg(null);
    setErrorMsg(null);
  };

  // Filter baris pratinjau yang aktif ditampilkan
  const filteredRows = useMemo(() => {
    if (!importResult) return [];
    return importResult.rows.filter((r) => {
      // Filter per dropdown jenis
      if (filterJenis !== "ALL" && r.jenis !== filterJenis) {
        return false;
      }

      // Filter per tab
      if (activeTab === "VALID") return r.isValid && !r.isSkipped;
      if (activeTab === "SKIPPED") return r.isSkipped;
      if (activeTab === "NEEDS_CAT") return r.needsCategory;
      if (activeTab === "ERROR") return !r.isValid;
      return true;
    });
  }, [importResult, activeTab, filterJenis]);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-200 gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-zinc-950" />
            Impor Data Pembukuan (.csv / .xlsx)
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Mendukung template CSV standar Time Travel Design dengan pemetaan header dinamis, validasi tanggal ketat, dan idempoten
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-xs hover:bg-zinc-50 transition-colors"
          >
            <Download className="h-4 w-4 text-zinc-600" />
            <span>Unduh Template CSV</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Peringatan Jika File Excel Multi-Sheet / Ada Rekapitulasi (Poin 4) ── */}
      {unsupportedWorkbookMsg && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/70 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">Berkas Workbook Multi-Sheet Terdeteksi</h3>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                {unsupportedWorkbookMsg}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 pt-2 border-t border-amber-200/60">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-950 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Template CSV</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 transition-colors"
            >
              Pilih Berkas Lain
            </button>
          </div>
        </div>
      )}

      {/* ── Upload Box (Jika Belum Upload) ── */}
      {!fileName && (
        <div className="rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center hover:bg-zinc-50 hover:border-zinc-400 transition-all">
          <input
            type="file"
            id="file-upload"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-200 text-zinc-700 mb-4">
              {isProcessingFile ? (
                <Loader2 className="h-6 w-6 animate-spin text-zinc-950" />
              ) : (
                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              )}
            </div>
            <h3 className="text-sm font-bold text-zinc-950 mb-1">
              Pilih berkas CSV atau Excel (.xlsx) untuk diimpor
            </h3>
            <p className="text-xs text-zinc-500 max-w-lg mx-auto mb-4 leading-relaxed">
              Disarankan menggunakan berkas <strong>transaksi_2026.csv</strong> atau template CSV standar dengan kolom <code>buku, sheet_asal, baris_excel, tanggal, keterangan, jenis, kategori, debit, kredit, kasbon_ke, perlu_kategori</code>.
            </p>
            <span className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all">
              <UploadCloud className="h-4 w-4" />
              <span>Telusuri Berkas Komputer</span>
            </span>
          </label>
        </div>
      )}

      {/* ── Pratinjau & Validasi (Poin 5 & 6) ── */}
      {fileName && importResult && (
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-sm text-zinc-950">{fileName}</span>
                <span className="rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold">
                  {importResult.totalRead} baris dibaca
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {importResult.totalValid} baris valid siap diimpor, {importResult.totalSkipped} baris dilewati (SETORAN_PROYEK)
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleReset}
                disabled={isExecutingImport}
                className="rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Ganti Berkas
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isExecutingImport || importResult.totalInvalid > 0 || importResult.totalValid === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-all"
                title={
                  importResult.totalInvalid > 0
                    ? `Perbaiki ${importResult.totalInvalid} baris error sebelum melanjutkan.`
                    : ""
                }
              >
                {isExecutingImport ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Konfirmasi &amp; Impor {importResult.totalValid} Baris</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {importProgress && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Menyimpan transaksi secara bertahap...</span>
                <span>{importProgress.done} / {importProgress.total}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={importProgress.total}
                aria-valuenow={importProgress.done}
              >
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Kartu Ringkasan Statistik */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Baris Valid</span>
              <span className="font-mono text-base font-bold text-emerald-950 block mt-0.5">
                {importResult.totalValid}
              </span>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
              <span className="text-[10px] font-bold uppercase text-blue-800">Total Debit (Valid)</span>
              <span className="font-mono text-xs font-bold text-blue-950 block mt-0.5 truncate" title={formatCurrency(importResult.totalDebit)}>
                {formatCurrency(importResult.totalDebit)}
              </span>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 border border-purple-100">
              <span className="text-[10px] font-bold uppercase text-purple-800">Total Kredit (Beban)</span>
              <span className="font-mono text-xs font-bold text-purple-950 block mt-0.5 truncate" title={formatCurrency(importResult.totalKredit)}>
                {formatCurrency(importResult.totalKredit)}
              </span>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
              <span className="text-[10px] font-bold uppercase text-amber-800">Perlu Kategori</span>
              <span className="font-mono text-base font-bold text-amber-950 block mt-0.5">
                {importResult.totalNeedsCategory}
              </span>
              <span className="text-[10px] text-amber-700 block truncate">
                {formatCurrency(importResult.needsCategoryAmount)}
              </span>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
              <span className="text-[10px] font-bold uppercase text-rose-800">Baris Error</span>
              <span className="font-mono text-base font-bold text-rose-950 block mt-0.5">
                {importResult.totalInvalid}
              </span>
            </div>
          </div>

          {/* Rincian Jumlah Baris Per Jenis Transaksi */}
          <div className="rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200/80">
            <span className="text-[10px] font-bold uppercase text-zinc-500 block mb-2">
              Rincian Jenis Transaksi
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 text-blue-900 font-medium">
                Termin Klien: <strong>{importResult.jenisCounts["TERMIN_KLIEN"] || 0}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-2.5 py-1 text-indigo-900 font-medium">
                Beban Proyek: <strong>{importResult.jenisCounts["PENGELUARAN_PROYEK"] || 0}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-emerald-900 font-medium">
                Beban Kantor: <strong>{importResult.jenisCounts["PENGELUARAN_KANTOR"] || 0}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-teal-100 px-2.5 py-1 text-teal-900 font-medium">
                Modal Awal: <strong>{importResult.jenisCounts["MODAL_AWAL"] || 0}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-100 px-2.5 py-1 text-cyan-900 font-medium">
                Bunga Bank: <strong>{importResult.jenisCounts["BUNGA_BANK"] || 0}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-200 px-2.5 py-1 text-zinc-700 font-medium">
                Setoran Dilewati: <strong>{importResult.totalSkipped}</strong>
              </span>
            </div>
          </div>

          {/* Filter Baris Pratinjau */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 pb-2 sm:pb-0 sm:border-0">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "ALL" ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Semua ({importResult.rows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("VALID")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "VALID" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Valid ({importResult.totalValid})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("NEEDS_CAT")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "NEEDS_CAT" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Perlu Kategori ({importResult.totalNeedsCategory})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SKIPPED")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "SKIPPED" ? "bg-zinc-700 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Dilewati ({importResult.totalSkipped})
              </button>
              {importResult.totalInvalid > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("ERROR")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === "ERROR" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  Error ({importResult.totalInvalid})
                </button>
              )}
            </div>

            {/* Filter Jenis Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 focus:outline-hidden focus:ring-1 focus:ring-zinc-950"
              >
                <option value="ALL">Semua Jenis Transaksi</option>
                <option value="TERMIN_KLIEN">TERMIN_KLIEN</option>
                <option value="PENGELUARAN_PROYEK">PENGELUARAN_PROYEK</option>
                <option value="PENGELUARAN_KANTOR">PENGELUARAN_KANTOR</option>
                <option value="MODAL_AWAL">MODAL_AWAL</option>
                <option value="BUNGA_BANK">BUNGA_BANK</option>
                <option value="SETORAN_PROYEK">SETORAN_PROYEK (Dilewati)</option>
              </select>
            </div>
          </div>

          {/* Tabel Pratinjau Baris */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-100/90 backdrop-blur-sm z-10">
                <tr className="text-zinc-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 pl-3">Sheet Asal</th>
                  <th className="py-2.5">Baris</th>
                  <th className="py-2.5">Tanggal</th>
                  <th className="py-2.5">Keterangan</th>
                  <th className="py-2.5">Jenis</th>
                  <th className="py-2.5">Kategori</th>
                  <th className="py-2.5 text-right">Debit</th>
                  <th className="py-2.5 text-right">Kredit</th>
                  <th className="py-2.5 pr-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredRows.slice(0, 100).map((r, idx) => (
                  <tr
                    key={`${r.sheetAsal}-${r.barisExcel}-${idx}`}
                    className={
                      !r.isValid
                        ? "bg-rose-50/70"
                        : r.isSkipped
                        ? "bg-zinc-50/50 opacity-60"
                        : "hover:bg-zinc-50"
                    }
                  >
                    <td className="py-2 pl-3 font-semibold text-zinc-900 whitespace-nowrap">
                      {r.sheetAsal}
                    </td>
                    <td className="py-2 font-mono text-zinc-400">{r.barisExcel}</td>
                    <td className="py-2 font-mono text-zinc-600 whitespace-nowrap">{r.date || "-"}</td>
                    <td className="py-2 font-medium text-zinc-900 pr-2 max-w-xs truncate" title={r.description}>
                      {r.description}
                      {r.kasbonKe && (
                        <span className="block text-[10px] text-indigo-600 font-mono">
                          Kasbon: {r.kasbonKe}
                        </span>
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          r.jenis === "TERMIN_KLIEN"
                            ? "bg-blue-100 text-blue-800"
                            : r.jenis === "PENGELUARAN_PROYEK"
                            ? "bg-indigo-100 text-indigo-800"
                            : r.jenis === "PENGELUARAN_KANTOR"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.jenis === "MODAL_AWAL"
                            ? "bg-teal-100 text-teal-800"
                            : r.jenis === "BUNGA_BANK"
                            ? "bg-cyan-100 text-cyan-800"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {r.jenis}
                      </span>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {r.needsCategory ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Perlu dikategorikan
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-[11px]">{r.category || "-"}</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-zinc-700 whitespace-nowrap">
                      {r.debit > 0 ? (
                        <span className="text-blue-700 font-bold">{formatCurrency(r.debit)}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-zinc-700 whitespace-nowrap">
                      {r.kredit > 0 ? (
                        <span className="text-zinc-950 font-bold">{formatCurrency(r.kredit)}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-center whitespace-nowrap">
                      {r.isSkipped ? (
                        <span className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                          Dilewati
                        </span>
                      ) : r.isValid ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Valid
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800"
                          title={r.validationError}
                        >
                          {r.validationError}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 100 && (
            <p className="text-[11px] text-zinc-400 text-center">
              Menampilkan 100 dari {filteredRows.length} baris pratinjau yang sesuai filter.
            </p>
          )}
        </div>
      )}

      {/* ── Riwayat Batch Impor (import_batches) ── */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-700" />
            Riwayat Batch Impor (import_batches)
          </h3>
          <span className="text-xs text-zinc-400">
            {batches.length} riwayat tercatat
          </span>
        </div>

        {isLoadingBatches ? (
          <div className="py-6 text-center text-xs text-zinc-400 animate-pulse">
            Memuat riwayat impor...
          </div>
        ) : batches.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            Belum ada berkas yang pernah diimpor melalui antarmuka web.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                  <th className="pb-2.5 pl-2">Tanggal</th>
                  <th className="pb-2.5">Nama Berkas</th>
                  <th className="pb-2.5 text-center">Total Baris</th>
                  <th className="pb-2.5 text-center">Berhasil</th>
                  <th className="pb-2.5 text-center">Gagal</th>
                  <th className="pb-2.5 pr-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/70">
                    <td className="py-2.5 pl-2 font-mono text-zinc-500 whitespace-nowrap">{b.created_at}</td>
                    <td className="py-2.5 font-semibold text-zinc-900">{b.file_name}</td>
                    <td className="py-2.5 text-center font-mono">{b.total_rows}</td>
                    <td className="py-2.5 text-center font-mono font-bold text-emerald-700">{b.success_rows}</td>
                    <td className="py-2.5 text-center font-mono font-bold text-rose-600">{b.error_rows}</td>
                    <td className="py-2.5 pr-2 text-center">
                      <Badge
                        variant={b.error_rows === 0 ? "success" : "warning"}
                        size="sm"
                      >
                        {b.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
