"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Loader2,
  X,
  History,
  FileText,
  Layers,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  validateImportRows,
  executeImportBatch,
  getImportBatches,
  PreviewRow,
  ImportBatchSummary,
} from "@/app/actions/importActions";
import {
  getWorkbookSheetsMeta,
  parseSheetTransactions,
  parseFlatCSV,
  SheetMeta,
  ParsedTransactionRow,
} from "@/lib/import/excelParser";

function formatCurrency(amount: number) {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export default function ImportPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"EXCEL" | "CSV">("EXCEL");
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const csvRawRowsRef = useRef<ParsedTransactionRow[]>([]);

  // Daftar sheet yang tersedia & dipilih
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

  // Pratinjau hasil parse & validasi
  const [allParsedRows, setAllParsedRows] = useState<ParsedTransactionRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [validationStats, setValidationStats] = useState<{
    totalValid: number;
    totalInvalid: number;
    totalDebit: number;
    totalKredit: number;
    totalNeedsCategory: number;
  } | null>(null);

  // Filter tampilan pratinjau
  const [activeTab, setActiveTab] = useState<"ALL" | "TERMIN" | "EXPENSE_PROJ" | "EXPENSE_OFFICE" | "NEEDS_CAT">("ALL");
  const [filterSheet, setFilterSheet] = useState<string>("ALL");

  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchBatches = async () => {
    try {
      setIsLoadingBatches(true);
      const res = await getImportBatches();
      setBatches(res);
    } catch (err) {
      console.error("Gagal memuat batch impor:", err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Fungsi untuk mem-parse ulang baris saat sheet yang dipilih berubah
  const reparseRowsForSelectedSheets = async (
    activeSheetNames: Set<string>,
    type: "EXCEL" | "CSV"
  ) => {
    let collected: ParsedTransactionRow[] = [];

    if (type === "EXCEL" && workbookRef.current) {
      const wb = workbookRef.current;
      for (const sName of wb.SheetNames) {
        if (activeSheetNames.has(sName)) {
          const s = wb.Sheets[sName];
          if (s) {
            const parsed = parseSheetTransactions(s, sName);
            collected = collected.concat(parsed);
          }
        }
      }
    } else if (type === "CSV") {
      collected = csvRawRowsRef.current.filter((r) => activeSheetNames.has(r.sheetName));
    }

    setAllParsedRows(collected);

    // Jalankan validasi
    const res = await validateImportRows(collected);
    setPreviewRows(res.rows);
    setValidationStats({
      totalValid: res.totalValid,
      totalInvalid: res.totalInvalid,
      totalDebit: res.totalDebit,
      totalKredit: res.totalKredit,
      totalNeedsCategory: res.totalNeedsCategory,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setFileName(file.name);

      const isCsv = file.name.endsWith(".csv");
      setFileType(isCsv ? "CSV" : "EXCEL");

      if (isCsv) {
        const text = await file.text();
        const parsedRows = parseFlatCSV(text);
        csvRawRowsRef.current = parsedRows;

        // Dapatkan nama-nama sheet dari CSV
        const uniqueSheets = Array.from(new Set(parsedRows.map((r) => r.sheetName)));
        const metaList: SheetMeta[] = uniqueSheets.map((name) => {
          const count = parsedRows.filter((r) => r.sheetName === name).length;
          const isOffice = name.toLowerCase().includes("kantor") || name.toLowerCase().includes("perusahaan") || name.toLowerCase().includes("kas");
          return {
            name,
            type: isOffice ? "OFFICE_CASH" : "PROJECT",
            estimatedRows: count,
            isSelected: true,
          };
        });

        setSheets(metaList);
        const initialSelected = new Set(metaList.map((m) => m.name));
        setSelectedSheets(initialSelected);
        await reparseRowsForSelectedSheets(initialSelected, "CSV");
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { cellDates: true, cellFormula: true });
        workbookRef.current = workbook;

        const metaList = getWorkbookSheetsMeta(workbook);
        setSheets(metaList);

        // Pilih default: semua sheet kecuali ringkasan/rekapitulasi
        const initialSelected = new Set(
          metaList.filter((m) => m.isSelected).map((m) => m.name)
        );
        setSelectedSheets(initialSelected);
        await reparseRowsForSelectedSheets(initialSelected, "EXCEL");
      }
    } catch (err: any) {
      console.error("Error parsing import file:", err);
      setErrorMsg(`Gagal membaca file: ${err?.message || "Format file tidak valid."}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Toggle satu sheet
  const handleToggleSheet = async (sheetName: string) => {
    const next = new Set(selectedSheets);
    if (next.has(sheetName)) {
      next.delete(sheetName);
    } else {
      next.add(sheetName);
    }
    setSelectedSheets(next);
    await reparseRowsForSelectedSheets(next, fileType);
  };

  // Pilih Semua Sheet Proyek
  const handleSelectAllProjects = async () => {
    const projectSheets = sheets.filter((s) => s.type === "PROJECT").map((s) => s.name);
    const next = new Set(projectSheets);
    setSelectedSheets(next);
    await reparseRowsForSelectedSheets(next, fileType);
  };

  // Pilih Semua
  const handleSelectAll = async () => {
    const all = new Set(sheets.filter((s) => s.type !== "SUMMARY").map((s) => s.name));
    setSelectedSheets(all);
    await reparseRowsForSelectedSheets(all, fileType);
  };

  // Kosongkan Pilihan
  const handleDeselectAll = async () => {
    const empty = new Set<string>();
    setSelectedSheets(empty);
    await reparseRowsForSelectedSheets(empty, fileType);
  };

  const handleConfirmImport = async () => {
    if (!fileName || previewRows.length === 0) return;

    try {
      setIsExecutingImport(true);
      setErrorMsg(null);

      const res = await executeImportBatch({
        fileName,
        rows: previewRows,
      });

      setSuccessMsg(
        `Impor selesai! Berhasil menyimpan ${res.successRows} baris transaksi${
          res.errorRows > 0 ? `, ${res.errorRows} baris dilewati karena tidak valid.` : "."
        }`
      );

      setFileName(null);
      setPreviewRows([]);
      setValidationStats(null);
      setSheets([]);
      setSelectedSheets(new Set());
      await fetchBatches();
    } catch (err: any) {
      console.error("Gagal mengeksekusi impor:", err);
      setErrorMsg(err?.message || "Terjadi kesalahan saat memproses impor.");
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setPreviewRows([]);
    setValidationStats(null);
    setSheets([]);
    setSelectedSheets(new Set());
    setErrorMsg(null);
    workbookRef.current = null;
    csvRawRowsRef.current = [];
  };

  // Filter baris pratinjau yang aktif ditampilkan
  const filteredPreviewRows = useMemo(() => {
    return previewRows.filter((r) => {
      // Filter per sheet dropdown
      if (filterSheet !== "ALL" && r.sheetName !== filterSheet) {
        return false;
      }

      // Filter per tab
      if (activeTab === "TERMIN") return r.type === "TERMIN_KLIEN";
      if (activeTab === "EXPENSE_PROJ") return r.type === "PENGELUARAN_PROYEK";
      if (activeTab === "EXPENSE_OFFICE") return r.type === "PENGELUARAN_KANTOR";
      if (activeTab === "NEEDS_CAT") return r.needsCategory;
      return true;
    });
  }, [previewRows, activeTab, filterSheet]);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="border-b border-zinc-200 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-zinc-950" />
          Impor Data Pembukuan Excel / CSV
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Dukungan multi-sheet: pilih sheet proyek atau buku kas kantor secara spesifik, otomatis memisahkan Termin Klien, Beban HPP, dan Biaya Kantor sesuai sheet asli TTD
        </p>
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

      {/* ── Upload Box (Jika Belum Upload) ── */}
      {!fileName && (
        <div className="rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center hover:bg-zinc-50 hover:border-zinc-400 transition-all">
          <input
            type="file"
            id="file-upload"
            accept=".xlsx, .xls, .csv"
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
              Pilih file Excel (.xlsx) atau CSV untuk diimpor
            </h3>
            <p className="text-xs text-zinc-500 max-w-lg mx-auto mb-4 leading-relaxed">
              Mendukung file buku kerja lengkap (seperti <strong>Laporan Keuangan 2026.xlsx</strong> dengan 17 sheet proyek dan Lapkeu Perusahaan) maupun file datar (<strong>transaksi_2026.csv</strong>).
            </p>
            <span className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all">
              <UploadCloud className="h-4 w-4" />
              <span>Telusuri Berkas Komputer</span>
            </span>
          </label>
        </div>
      )}

      {/* ── Pemilihan Sheet (Jika File Multi-Sheet Dibaca) ── */}
      {fileName && sheets.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-zinc-950">Pilih Sheet Yang Ingin Diimpor</h3>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                  {selectedSheets.size} dari {sheets.length} sheet dipilih
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Centang sheet yang ingin diproses. Sistem akan mengekstrak transaksi debit/kredit dan mendeteksi kategori sesuai aturan pembukuan TTD.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllProjects}
                className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                Pilih Semua Proyek
              </button>
              <button
                type="button"
                onClick={handleSelectAll}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 transition-colors"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* Grid Pilihan Sheet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {sheets.map((s) => {
              const isChecked = selectedSheets.has(s.name);
              const isSummary = s.type === "SUMMARY";
              return (
                <div
                  key={s.name}
                  onClick={() => !isSummary && handleToggleSheet(s.name)}
                  className={`flex items-start gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSummary
                      ? "opacity-40 bg-zinc-50 border-zinc-200 cursor-not-allowed"
                      : isChecked
                      ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 shadow-xs"
                      : "border-zinc-200 bg-zinc-50/30 hover:bg-zinc-50 text-zinc-700"
                  }`}
                >
                  <div className="mt-0.5">
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-400 shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-tight">{s.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {s.type === "PROJECT" && (
                        <span className="text-[9px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          Proyek
                        </span>
                      )}
                      {s.type === "OFFICE_CASH" && (
                        <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          Buku Kas Kantor
                        </span>
                      )}
                      {s.type === "SUMMARY" && (
                        <span className="text-[9px] font-semibold bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">
                          Ringkasan
                        </span>
                      )}
                      {s.estimatedRows > 0 && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ~{s.estimatedRows} baris
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pratinjau & Validasi ── */}
      {fileName && validationStats && (
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-sm text-zinc-950">{fileName}</span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                  {selectedSheets.size} sheet aktif
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {previewRows.length} total baris transaksi tervalidasi siap impor
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
                disabled={isExecutingImport || validationStats.totalValid === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-all"
              >
                {isExecutingImport ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Konfirmasi &amp; Impor {validationStats.totalValid} Baris</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Statistik Ringkasan */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Baris Valid</span>
              <span className="font-mono text-base font-bold text-emerald-950 block mt-0.5">
                {validationStats.totalValid}
              </span>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
              <span className="text-[10px] font-bold uppercase text-blue-800">Total Termin (Debit)</span>
              <span className="font-mono text-xs font-bold text-blue-950 block mt-0.5 truncate">
                {formatCurrency(validationStats.totalDebit)}
              </span>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 border border-purple-100">
              <span className="text-[10px] font-bold uppercase text-purple-800">Total Pengeluaran (Kredit)</span>
              <span className="font-mono text-xs font-bold text-purple-950 block mt-0.5 truncate">
                {formatCurrency(validationStats.totalKredit)}
              </span>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
              <span className="text-[10px] font-bold uppercase text-amber-800">Perlu Kategori</span>
              <span className="font-mono text-base font-bold text-amber-950 block mt-0.5">
                {validationStats.totalNeedsCategory}
              </span>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
              <span className="text-[10px] font-bold uppercase text-rose-800">Tidak Valid (Error)</span>
              <span className="font-mono text-base font-bold text-rose-950 block mt-0.5">
                {validationStats.totalInvalid}
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
                Semua ({previewRows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TERMIN")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "TERMIN" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                Termin Klien ({previewRows.filter((r) => r.type === "TERMIN_KLIEN").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("EXPENSE_PROJ")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "EXPENSE_PROJ" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                Beban Proyek ({previewRows.filter((r) => r.type === "PENGELUARAN_PROYEK").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("EXPENSE_OFFICE")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "EXPENSE_OFFICE" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Biaya Kantor ({previewRows.filter((r) => r.type === "PENGELUARAN_KANTOR").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("NEEDS_CAT")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "NEEDS_CAT" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Perlu Kategori ({previewRows.filter((r) => r.needsCategory).length})
              </button>
            </div>

            {/* Dropdown Filter Sheet */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={filterSheet}
                onChange={(e) => setFilterSheet(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 focus:outline-hidden focus:ring-1 focus:ring-zinc-950"
              >
                <option value="ALL">Semua Sheet Terpilih ({selectedSheets.size})</option>
                {Array.from(selectedSheets).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabel Pratinjau Baris */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-100/90 backdrop-blur-sm z-10">
                <tr className="text-zinc-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 pl-3">Sheet / Proyek</th>
                  <th className="py-2.5">No</th>
                  <th className="py-2.5">Tanggal</th>
                  <th className="py-2.5">Uraian / Keterangan</th>
                  <th className="py-2.5">Tipe</th>
                  <th className="py-2.5">Kategori</th>
                  <th className="py-2.5 text-right">Debit (Termin)</th>
                  <th className="py-2.5 text-right">Kredit (Beban)</th>
                  <th className="py-2.5 pr-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredPreviewRows.slice(0, 100).map((r, idx) => (
                  <tr key={`${r.sheetName}-${r.rowNumber}-${idx}`} className={r.isValid ? "hover:bg-zinc-50" : "bg-rose-50/50"}>
                    <td className="py-2.5 pl-3 font-semibold text-zinc-900 whitespace-nowrap">
                      {r.sheetName}
                    </td>
                    <td className="py-2.5 font-mono text-zinc-400">{r.no || r.rowNumber}</td>
                    <td className="py-2.5 font-mono text-zinc-500 whitespace-nowrap">{r.date}</td>
                    <td className="py-2.5 font-medium text-zinc-900 pr-2 max-w-xs truncate" title={r.description}>
                      {r.description}
                      {r.workerAdvanceTo && (
                        <span className="block text-[10px] text-indigo-600 font-mono">
                          Kasbon Mandor: {r.workerAdvanceTo}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      {r.type === "TERMIN_KLIEN" && (
                        <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                          Termin Klien
                        </span>
                      )}
                      {r.type === "PENGELUARAN_PROYEK" && (
                        <span className="inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800">
                          Beban HPP
                        </span>
                      )}
                      {r.type === "PENGELUARAN_KANTOR" && (
                        <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                          Kantor
                        </span>
                      )}
                      {r.type === "SETORAN_PROYEK" && (
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                          Setoran (Lewati)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      {r.needsCategory ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Perlu Kategori
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-[11px]">{r.category}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-700 whitespace-nowrap">
                      {r.debit > 0 ? (
                        <span className="text-blue-700 font-bold">{formatCurrency(r.debit)}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-700 whitespace-nowrap">
                      {r.kredit > 0 ? (
                        <span className="text-zinc-950 font-bold">{formatCurrency(r.kredit)}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-center whitespace-nowrap">
                      {r.isValid ? (
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
          {filteredPreviewRows.length > 100 && (
            <p className="text-[11px] text-zinc-400 text-center">
              Menampilkan 100 dari {filteredPreviewRows.length} baris yang cocok dengan filter.
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
