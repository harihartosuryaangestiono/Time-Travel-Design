import * as XLSX from "xlsx";

export type TransactionType =
  | "TERMIN_KLIEN"
  | "PENGELUARAN_PROYEK"
  | "PENGELUARAN_KANTOR"
  | "MODAL_AWAL"
  | "BUNGA_BANK"
  | "SETORAN_PROYEK";

export interface ParsedRow {
  rowNumber: number;
  sheetAsal: string;
  barisExcel: number;
  no?: number;
  date: string;
  description: string;
  category: string;
  jenis: TransactionType;
  buku: "PROYEK" | "KAS_PERUSAHAAN";
  debit: number;
  kredit: number;
  amount: number;
  kasbonKe?: string;
  needsCategory: boolean;
  isSkipped: boolean;
  isValid: boolean;
  validationError?: string;
  externalRef: string;
}

export interface ParsedImportResult {
  rows: ParsedRow[];
  totalRead: number;
  totalRows: number; // alias untuk totalRead
  totalSkipped: number;
  totalValid: number;
  totalInvalid: number;
  totalDebit: number;
  totalKredit: number;
  totalCredit: number; // alias untuk totalKredit
  totalSkippedDebit: number;
  totalNeedsCategory: number;
  needsCategoryAmount: number;
  jenisCounts: Record<string, number>;
  validRows: ParsedRow[];
}

// 1. Strip UTF-8 BOM jika ada
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

// Helper validasi tanggal kalender sebenarnya (mencegah 30 Februari atau 31 April)
function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// 2. Parser Tanggal Ketat: terima nomor seri Excel, ISO (YYYY-MM-DD), dan dd/MM/yyyy
// JANGAN PERNAH default ke tanggal hari ini!
export function parseStrictDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  // Jika sudah Date instance
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split("T")[0];
  }

  // Jika nomor seri Excel (angka 1000..100000)
  if (typeof val === "number" || (!isNaN(Number(val)) && typeof val === "string" && !String(val).includes("-") && !String(val).includes("/"))) {
    const n = Number(val);
    if (n >= 1000 && n <= 100000) {
      const utcDays = Math.floor(n - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }
    return null;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Format ISO: YYYY-MM-DD atau YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  // Format dd/MM/yyyy atau dd-MM-yyyy atau dd.MM.yyyy
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  return null;
}

// 3. Pembaca Header: Pindai 15 baris pertama untuk mencocokkan nama header secara dinamis
export interface HeaderMapping {
  headerRowIndex: number;
  colMap: {
    sheetAsal?: number;
    barisExcel?: number;
    no?: number;
    date?: number;
    desc?: number;
    debit?: number;
    kredit?: number;
    category?: number;
    jenis?: number;
    buku?: number;
    needsCategory?: number;
    kasbonKe?: number;
  };
}

export function findHeaderRow(grid: any[][], maxScanRows = 15): HeaderMapping | null {
  const scanLimit = Math.min(grid.length, maxScanRows);

  for (let r = 0; r < scanLimit; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;

    const colMap: HeaderMapping["colMap"] = {};

    row.forEach((cell, idx) => {
      const text = String(cell || "").toLowerCase().trim().replace(/[\r\n\t_]/g, " ");

      if (/tanggal|tgl|date/i.test(text)) {
        colMap.date = idx;
      } else if (/keterangan|uraian|desc|deskripsi/i.test(text)) {
        colMap.desc = idx;
      } else if (/debit|debet|pemasukan|termin/i.test(text)) {
        colMap.debit = idx;
      } else if (/kredit|credit|pengeluaran|beban/i.test(text)) {
        colMap.kredit = idx;
      } else if (/^no$|^nomor$|^no\./i.test(text)) {
        colMap.no = idx;
      } else if (/perlu.*kategori|needs.*category/i.test(text)) {
        colMap.needsCategory = idx;
      } else if (/kategori|category/i.test(text)) {
        colMap.category = idx;
      } else if (/jenis|type/i.test(text)) {
        colMap.jenis = idx;
      } else if (/buku|ledger/i.test(text)) {
        colMap.buku = idx;
      } else if (/sheet/i.test(text)) {
        colMap.sheetAsal = idx;
      } else if (/baris|row/i.test(text)) {
        colMap.barisExcel = idx;
      } else if (/kasbon|mandor/i.test(text)) {
        colMap.kasbonKe = idx;
      }
    });

    // Harus memiliki minimal kolom Tanggal dan Keterangan atau Debit/Kredit
    if (
      (colMap.date !== undefined && colMap.desc !== undefined) ||
      (colMap.debit !== undefined && colMap.kredit !== undefined && (colMap.date !== undefined || colMap.desc !== undefined))
    ) {
      return {
        headerRowIndex: r,
        colMap,
      };
    }
  }

  return null;
}

// Helper parsing satu baris CSV yang menghormati tanda kutip ganda
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ""));
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ""));
  return result;
}

// 4. Parser Format CSV (Datar, Template, atau transaksi_2026.csv)
export function parseCsv(csvContent: string): ParsedImportResult {
  const cleanContent = stripBom(csvContent).trim();
  const rawLines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (rawLines.length === 0) {
    return {
      rows: [],
      totalRead: 0,
      totalRows: 0,
      totalSkipped: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalDebit: 0,
      totalKredit: 0,
      totalCredit: 0,
      totalSkippedDebit: 0,
      totalNeedsCategory: 0,
      needsCategoryAmount: 0,
      jenisCounts: {},
      validRows: [],
    };
  }

  const grid = rawLines.map(parseCsvLine);
  const headerInfo = findHeaderRow(grid, 15);

  if (!headerInfo) {
    throw new Error("Header CSV tidak ditemukan. Pastikan terdapat kolom Tanggal, Keterangan, Debit, dan Kredit.");
  }

  const { headerRowIndex, colMap } = headerInfo;
  const dataRows = grid.slice(headerRowIndex + 1);

  return processGridRows(dataRows, colMap, "CSV_IMPORT");
}

// 5. Parser Single-Sheet Excel
export function parseSingleSheetExcel(sheet: XLSX.WorkSheet, sheetName = "Sheet1"): ParsedImportResult {
  const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (grid.length === 0) {
    return {
      rows: [],
      totalRead: 0,
      totalRows: 0,
      totalSkipped: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalDebit: 0,
      totalKredit: 0,
      totalCredit: 0,
      totalSkippedDebit: 0,
      totalNeedsCategory: 0,
      needsCategoryAmount: 0,
      jenisCounts: {},
      validRows: [],
    };
  }

  const headerInfo = findHeaderRow(grid, 15);
  if (!headerInfo) {
    throw new Error(`Header tidak ditemukan pada sheet '${sheetName}'. Pastikan terdapat kolom Tanggal, Keterangan, Debit, dan Kredit.`);
  }

  const { headerRowIndex, colMap } = headerInfo;
  const dataRows = grid.slice(headerRowIndex + 1);

  return processGridRows(dataRows, colMap, sheetName);
}

// Core processor untuk array 2D setelah header dipetakan
function processGridRows(
  dataRows: any[][],
  colMap: HeaderMapping["colMap"],
  defaultSheetName: string
): ParsedImportResult {
  const rows: ParsedRow[] = [];
  let totalRead = 0;
  let totalSkipped = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  let totalDebit = 0;
  let totalKredit = 0;
  let totalSkippedDebit = 0;
  let totalNeedsCategory = 0;
  let needsCategoryAmount = 0;
  const jenisCounts: Record<string, number> = {};

  dataRows.forEach((cols, idx) => {
    // Lewati baris kosong total
    if (!cols || cols.every((c) => c === "" || c === null || c === undefined)) {
      return;
    }

    const rowNumber = idx + 1;
    totalRead++;

    const rawSheet = colMap.sheetAsal !== undefined ? String(cols[colMap.sheetAsal] || "").trim() : defaultSheetName;
    const sheetAsal = rawSheet || defaultSheetName;
    const barisExcel = colMap.barisExcel !== undefined ? parseInt(String(cols[colMap.barisExcel] || "0"), 10) || rowNumber + 1 : rowNumber + 1;
    const no = colMap.no !== undefined ? parseInt(String(cols[colMap.no] || ""), 10) : undefined;
    const rawDesc = colMap.desc !== undefined ? String(cols[colMap.desc] || "").trim() : "";
    const debit = colMap.debit !== undefined ? parseFloat(String(cols[colMap.debit] || "0")) || 0 : 0;
    const kredit = colMap.kredit !== undefined ? parseFloat(String(cols[colMap.kredit] || "0")) || 0 : 0;
    const rawCategory = colMap.category !== undefined ? String(cols[colMap.category] || "").trim() : "";
    const rawJenis = colMap.jenis !== undefined ? String(cols[colMap.jenis] || "").trim().toUpperCase() : "";
    const rawBuku = colMap.buku !== undefined ? String(cols[colMap.buku] || "").trim().toUpperCase() : "";
    const rawNeeds = colMap.needsCategory !== undefined ? String(cols[colMap.needsCategory] || "").trim().toUpperCase() : "";
    const kasbonKe = colMap.kasbonKe !== undefined ? String(cols[colMap.kasbonKe] || "").trim() : undefined;

    // Abaikan baris summary seperti "TOTAL", "JUMLAH"
    if (/^(total|jumlah|subtotal|saldo akhir)$/i.test(rawDesc)) {
      return;
    }

    // Tanggal validasi ketat
    const rawDate = colMap.date !== undefined ? cols[colMap.date] : null;
    const parsedDate = parseStrictDate(rawDate);

    // Buku (PROYEK atau KAS_PERUSAHAAN)
    const buku: "PROYEK" | "KAS_PERUSAHAAN" =
      rawBuku === "KAS_PERUSAHAAN" || rawBuku === "KANTOR" || sheetAsal.toLowerCase().includes("lapkeu") || sheetAsal.toLowerCase().includes("kantor")
        ? "KAS_PERUSAHAAN"
        : "PROYEK";

    // Jenis Transaksi
    let jenis: TransactionType = "PENGELUARAN_PROYEK";
    if (
      rawJenis === "SETORAN_PROYEK" ||
      rawJenis === "TERMIN_KLIEN" ||
      rawJenis === "PENGELUARAN_PROYEK" ||
      rawJenis === "PENGELUARAN_KANTOR" ||
      rawJenis === "MODAL_AWAL" ||
      rawJenis === "BUNGA_BANK"
    ) {
      jenis = rawJenis as TransactionType;
    } else if (buku === "PROYEK") {
      jenis = debit > 0 ? "TERMIN_KLIEN" : "PENGELUARAN_PROYEK";
    } else {
      if (debit > 0) {
        if (/modal/i.test(rawDesc)) jenis = "MODAL_AWAL";
        else if (/bunga/i.test(rawDesc)) jenis = "BUNGA_BANK";
        else if (/final project|setoran/i.test(rawDesc)) jenis = "SETORAN_PROYEK";
        else jenis = "SETORAN_PROYEK";
      } else {
        jenis = "PENGELUARAN_KANTOR";
      }
    }

    // Catat hitungan jenis
    jenisCounts[jenis] = (jenisCounts[jenis] || 0) + 1;

    // Aturan 3: SETORAN_PROYEK dilewati
    const isSkipped = jenis === "SETORAN_PROYEK";

    // Validasi baris
    let isValid = true;
    let validationError = "";

    if (!parsedDate) {
      isValid = false;
      validationError = "Tanggal transaksi tidak valid.";
    } else if (!rawDesc) {
      isValid = false;
      validationError = "Keterangan transaksi kosong.";
    } else if (debit === 0 && kredit === 0) {
      isValid = false;
      validationError = "Nominal debit atau kredit harus diisi (> 0).";
    }

    // Penentuan kategori & needs_category
    // Kategori diambil apa adanya (TIDAK DITEBAK!).
    // perlu_kategori = YA / TRUE atau category kosong / "Perlu dikategorikan" diimpor sebagai "Perlu dikategorikan"
    const isExplicitNeeds = rawNeeds === "YA" || rawNeeds === "TRUE" || rawNeeds === "1";
    let category = rawCategory;
    let needsCategory = false;

    if (jenis === "TERMIN_KLIEN" || jenis === "MODAL_AWAL" || jenis === "SETORAN_PROYEK") {
      needsCategory = false;
      if (!category) {
        category = jenis === "TERMIN_KLIEN" ? "Pendapatan Termin Proyek" : jenis === "MODAL_AWAL" ? "Modal Awal Kas" : "Setoran Kas Masuk";
      }
    } else {
      // Pengeluaran atau Bunga Bank
      if (isExplicitNeeds || !category || category.toLowerCase() === "perlu dikategorikan") {
        needsCategory = true;
        category = "Perlu dikategorikan";
      }
    }

    const amount = debit > 0 ? debit : kredit;
    const externalRef = `${sheetAsal}_${barisExcel}`;

    if (isSkipped) {
      totalSkipped++;
      totalSkippedDebit += debit;
    } else if (isValid) {
      totalValid++;
      totalDebit += debit;
      totalKredit += kredit;
      if (needsCategory) {
        totalNeedsCategory++;
        needsCategoryAmount += amount;
      }
    } else {
      totalInvalid++;
    }

    rows.push({
      rowNumber,
      sheetAsal,
      barisExcel,
      no: isNaN(Number(no)) ? undefined : no,
      date: parsedDate || "",
      description: rawDesc,
      category,
      jenis,
      buku,
      debit,
      kredit,
      amount,
      kasbonKe: kasbonKe || undefined,
      needsCategory,
      isSkipped,
      isValid,
      validationError: validationError || undefined,
      externalRef,
    });
  });

  return {
    rows,
    totalRead,
    totalRows: totalRead,
    totalSkipped,
    totalValid,
    totalInvalid,
    totalDebit,
    totalKredit,
    totalCredit: totalKredit,
    totalSkippedDebit,
    totalNeedsCategory,
    needsCategoryAmount,
    jenisCounts,
    validRows: rows.filter((r) => r.isValid && !r.isSkipped),
  };
}

// 6. Pemeriksa Workbook Multi-Sheet:
// Jika file .xlsx berisi banyak sheet atau sheet "Rekapitulasi", tampilkan pesan peringatan jelas
export function checkExcelWorkbook(workbookOrSheets: XLSX.WorkBook | string[]): {
  isSupported: boolean;
  isMultiSheetOrRekap: boolean;
  reason?: string;
  sheetName?: string;
} {
  const sheetNames = Array.isArray(workbookOrSheets)
    ? workbookOrSheets
    : workbookOrSheets?.SheetNames || [];

  const hasRekapitulasi = sheetNames.some((name) => /rekapitulasi/i.test(name));
  const hasMultipleSheets = sheetNames.length > 1;

  if (hasRekapitulasi || hasMultipleSheets) {
    return {
      isSupported: false,
      isMultiSheetOrRekap: true,
      reason: "Format workbook multi-sheet belum didukung di UI. Gunakan template CSV atau skrip import-ttd-2026.",
    };
  }

  return {
    isSupported: true,
    isMultiSheetOrRekap: false,
    sheetName: sheetNames[0] || "Sheet1",
  };
}

// 7. Generator Template CSV dengan BOM UTF-8
export function generateCsvTemplate(): string {
  const headers = [
    "buku",
    "sheet_asal",
    "baris_excel",
    "tanggal",
    "keterangan",
    "jenis",
    "kategori",
    "debit",
    "kredit",
    "kasbon_ke",
    "perlu_kategori",
  ];

  const sampleRows = [
    [
      "PROYEK",
      "Charity House - Bintaro",
      "7",
      "2026-09-22",
      "Pembayaran Tahap I",
      "TERMIN_KLIEN",
      "",
      "100000000",
      "0",
      "",
      "TIDAK",
    ],
    [
      "PROYEK",
      "Charity House - Bintaro",
      "8",
      "2026-10-04",
      "Material Semen & Pasir",
      "PENGELUARAN_PROYEK",
      "Bahan Baku Utama / Material",
      "0",
      "3513000",
      "",
      "TIDAK",
    ],
    [
      "PROYEK",
      "Charity House - Bintaro",
      "9",
      "2026-10-04",
      "Kasbon Mang Rian",
      "PENGELUARAN_PROYEK",
      "Upah Tukang",
      "0",
      "1000000",
      "Mang Rian",
      "TIDAK",
    ],
    [
      "KAS_PERUSAHAAN",
      "Lapkeu Perusahaan",
      "6",
      "2025-12-31",
      "Kas Modal 2025",
      "MODAL_AWAL",
      "Modal Awal Kas",
      "12500179.89",
      "0",
      "",
      "TIDAK",
    ],
    [
      "KAS_PERUSAHAAN",
      "Lapkeu Perusahaan",
      "14",
      "2026-01-24",
      "Gaji Kantor - Januari",
      "PENGELUARAN_KANTOR",
      "Gaji dan Upah Karyawan",
      "0",
      "5000000",
      "",
      "TIDAK",
    ],
    [
      "KAS_PERUSAHAAN",
      "Lapkeu Perusahaan",
      "7",
      "2026-01-10",
      "WPC Kebutuhan Kantor",
      "PENGELUARAN_KANTOR",
      "Perlu dikategorikan",
      "0",
      "359990",
      "",
      "YA",
    ],
    [
      "KAS_PERUSAHAAN",
      "Lapkeu Perusahaan",
      "17",
      "2026-01-30",
      "Bunga Bank BCA",
      "BUNGA_BANK",
      "Biaya Administrasi Finansial",
      "251.4",
      "0",
      "",
      "TIDAK",
    ],
  ];

  const csvRows = [headers.join(","), ...sampleRows.map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","))];

  // Tambahkan UTF-8 BOM (\uFEFF)
  return "\uFEFF" + csvRows.join("\n");
}
