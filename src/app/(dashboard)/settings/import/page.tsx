"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  validateImportRows,
  executeImportBatch,
  getImportBatches,
  PreviewRow,
  ImportBatchSummary,
} from "@/app/actions/importActions";

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
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [validationStats, setValidationStats] = useState<{
    totalValid: number;
    totalInvalid: number;
    totalDebit: number;
    totalKredit: number;
  } | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      setFileName(file.name);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // Format baris untuk validasi
      const formatted = rawJson.map((row: any) => ({
        date: row.Tanggal || row.date || row.Date || "",
        description: row.Keterangan || row.desc || row.Description || row.keterangan || "",
        category: row.Kategori || row.category || row.Category || "",
        debit: row.Debit || row.debit || 0,
        kredit: row.Kredit || row.kredit || row.credit || 0,
        project: row.Proyek || row.project || row.Project || "",
      }));

      const res = await validateImportRows(formatted);
      setPreviewRows(res.rows);
      setValidationStats({
        totalValid: res.totalValid,
        totalInvalid: res.totalInvalid,
        totalDebit: res.totalDebit,
        totalKredit: res.totalKredit,
      });
    } catch (err: any) {
      console.error("Error parsing import file:", err);
      setErrorMsg(`Gagal membaca file: ${err?.message || "Format file tidak valid."}`);
    } finally {
      setIsProcessingFile(false);
    }
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
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="border-b border-zinc-200 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-zinc-950" />
          Impor Transaksi (.xlsx / .csv)
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Unggah pembukuan Excel atau CSV untuk pratinjau, validasi idempoten, dan impor ke database
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
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
              Format kolom yang didukung: Tanggal, Keterangan, Kategori, Debit, Kredit.
            </p>
            <span className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-all">
              <UploadCloud className="h-4 w-4" />
              <span>Telusuri Berkas Komputer</span>
            </span>
          </label>
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
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {previewRows.length} total baris dibaca dari berkas
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

          {/* Statistik Validasi */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Baris Valid</span>
              <span className="font-mono text-base font-bold text-emerald-950 block mt-0.5">
                {validationStats.totalValid}
              </span>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
              <span className="text-[10px] font-bold uppercase text-rose-800">Tidak Valid (Error)</span>
              <span className="font-mono text-base font-bold text-rose-950 block mt-0.5">
                {validationStats.totalInvalid}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
              <span className="text-[10px] font-bold uppercase text-zinc-500">Total Debit</span>
              <span className="font-mono text-xs font-bold text-zinc-900 block mt-0.5">
                {formatCurrency(validationStats.totalDebit)}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
              <span className="text-[10px] font-bold uppercase text-zinc-500">Total Kredit</span>
              <span className="font-mono text-xs font-bold text-zinc-900 block mt-0.5">
                {formatCurrency(validationStats.totalKredit)}
              </span>
            </div>
          </div>

          {/* Tabel Pratinjau Baris */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-100/90 backdrop-blur-sm z-10">
                <tr className="text-zinc-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 pl-3">Baris</th>
                  <th className="py-2.5">Tanggal</th>
                  <th className="py-2.5">Keterangan</th>
                  <th className="py-2.5">Kategori</th>
                  <th className="py-2.5 text-right">Nominal</th>
                  <th className="py-2.5 pr-3 text-center">Status Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {previewRows.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber} className={r.isValid ? "hover:bg-zinc-50" : "bg-rose-50/50"}>
                    <td className="py-2.5 pl-3 font-mono text-zinc-400">{r.rowNumber}</td>
                    <td className="py-2.5 font-mono text-zinc-500 whitespace-nowrap">{r.date}</td>
                    <td className="py-2.5 font-medium text-zinc-900 pr-2">{r.description}</td>
                    <td className="py-2.5 text-zinc-600 whitespace-nowrap">{r.category}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-zinc-950 whitespace-nowrap">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="py-2.5 pr-3 text-center whitespace-nowrap">
                      {r.isValid ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800" title={r.validationError}>
                          {r.validationError}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewRows.length > 50 && (
            <p className="text-[11px] text-zinc-400 text-center">
              Menampilkan 50 dari {previewRows.length} baris pratinjau.
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
