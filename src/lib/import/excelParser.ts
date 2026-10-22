import * as XLSX from "xlsx";

export type SheetType = "PROJECT" | "OFFICE_CASH" | "SUMMARY" | "UNKNOWN";

export interface SheetMeta {
  name: string;
  type: SheetType;
  estimatedRows: number;
  isSelected: boolean;
}

export interface ParsedTransactionRow {
  sheetName: string;
  rowNumber: number;
  no?: number;
  date: string;
  description: string;
  debit: number;
  kredit: number;
  category: string;
  type: "TERMIN_KLIEN" | "PENGELUARAN_PROYEK" | "PENGELUARAN_KANTOR" | "SETORAN_PROYEK";
  ledger: "PROYEK" | "KANTOR";
  needsCategory: boolean;
  workerAdvanceTo?: string;
  projectName?: string;
}

export function detectSheetType(sheetName: string): SheetType {
  const lower = sheetName.toLowerCase().trim();
  if (lower.includes("rekapitulasi") || lower.includes("summary") || lower.includes("dashboard")) {
    return "SUMMARY";
  }
  if (
    lower.includes("lapkeu perusahaan") ||
    lower.includes("kas perusahaan") ||
    lower.includes("buku kas") ||
    (lower.includes("kantor") && !lower.includes("proyek") && !lower.includes("office")) ||
    lower === "operasional"
  ) {
    return "OFFICE_CASH";
  }
  return "PROJECT";
}

export function excelDateToISO(serial: unknown): string {
  if (serial instanceof Date) {
    return serial.toISOString().split("T")[0];
  }
  if (typeof serial === "string" && serial.includes("-")) {
    const parts = serial.trim().split("-");
    if (parts.length === 3 && parts[0].length === 4) return serial.trim();
  }
  const n = parseFloat(String(serial));
  if (!isNaN(n) && n > 0) {
    const utcDays = Math.floor(n - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split("T")[0];
    }
  }
  return new Date().toISOString().split("T")[0];
}

// Analisis formula cell SUM(F...:F...) seperti di Excel TTD asli
export function parseFormulaRows(sheet: XLSX.WorkSheet, formulaStr: string, visited = new Set<string>()): Set<number> {
  const rows = new Set<number>();
  if (!formulaStr) return rows;

  const sumMatches = Array.from(formulaStr.matchAll(/SUM\(([^)]+)\)/g));
  for (const m of sumMatches) {
    const parts = m[1].split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes(":")) {
        const [startCell, endCell] = trimmed.split(":");
        const startCol = startCell.replace(/[0-9]/g, "");
        const endCol = endCell.replace(/[0-9]/g, "");
        const startRow = parseInt(startCell.replace(/[^0-9]/g, ""), 10);
        const endRow = parseInt(endCell.replace(/[^0-9]/g, ""), 10);

        if (startCol === "F" && endCol === "F") {
          for (let r = startRow; r <= endRow; r++) rows.add(r);
        } else {
          for (let r = startRow; r <= endRow; r++) {
            ["K", "L", "M", "N"].forEach((col) => {
              const cellKey = `${col}${r}`;
              const cell = sheet[cellKey];
              if (cell && cell.f && !visited.has(cellKey)) {
                visited.add(cellKey);
                parseFormulaRows(sheet, cell.f, visited).forEach((subR) => rows.add(subR));
              }
            });
          }
        }
      } else {
        const col = trimmed.replace(/[0-9]/g, "");
        const r = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
        if (col === "F" && !isNaN(r)) {
          rows.add(r);
        } else if (!isNaN(r)) {
          const cellKey = `${col}${r}`;
          const cell = sheet[cellKey];
          if (cell && cell.f && !visited.has(cellKey)) {
            visited.add(cellKey);
            parseFormulaRows(sheet, cell.f, visited).forEach((subR) => rows.add(subR));
          }
        }
      }
    }
  }

  const cleanStr = formulaStr.replace(/SUM\([^)]+\)/g, "");
  const cellMatches = Array.from(cleanStr.matchAll(/([A-Z]+)([0-9]+)/g));
  for (const m of cellMatches) {
    const col = m[1];
    const r = parseInt(m[2], 10);
    if (col === "F" && !isNaN(r)) {
      rows.add(r);
    } else if (col !== "F" && !isNaN(r)) {
      const cellKey = `${col}${r}`;
      const cell = sheet[cellKey];
      if (cell && cell.f && !visited.has(cellKey)) {
        visited.add(cellKey);
        parseFormulaRows(sheet, cell.f, visited).forEach((subR) => rows.add(subR));
      }
    }
  }

  return rows;
}

// Rekomendasi kategori cerdas jika baris tidak punya formula
export function suggestCategory(desc: string, isProject: boolean): { category: string; isGuessed: boolean } {
  const d = desc.toLowerCase().trim();

  if (isProject) {
    // 4 Kategori HPP
    if (/upah|tukang|gajian|kasbon|mandor|ongkos tukang/.test(d)) {
      return { category: "Upah Tukang", isGuessed: true };
    }
    if (/sewa|steger|scaffolding|molen|genset|alat|pompa/.test(d)) {
      return { category: "Sewa Alat Proyek", isGuessed: true };
    }
    if (/transport|bensin|solar|tol|ojol|ongkir|delivery/.test(d)) {
      return { category: "Transportasi Lapangan", isGuessed: true };
    }
    if (/material|semen|pasir|bata|hebel|besi|baja|cat|keramik|pipa|kabel|triplek|gypsum|kayu|batu|paku|lem|baut|seng|kawat/.test(d)) {
      return { category: "Bahan Baku Utama / Material", isGuessed: true };
    }
  } else {
    // 11 Kategori Kantor
    if (/gaji|salary|upah staf|thr|bonus|honor/.test(d)) {
      return { category: "Gaji dan Upah Karyawan", isGuessed: true };
    }
    if (/bensin|solar|tol|parkir|grab|gojek|transport/.test(d)) {
      return { category: "Transportasi Operasional", isGuessed: true };
    }
    if (/makan|konsumsi|snack|kopi|minum|galon|lunch/.test(d)) {
      return { category: "Biaya Konsumsi Kantor", isGuessed: true };
    }
    if (/jamuan|entertain|dinner|meeting klien|treat/.test(d)) {
      return { category: "Biaya Jamuan / Representasi", isGuessed: true };
    }
    if (/iklan|ads|marketing|brosur|social media|domain|hosting/.test(d)) {
      return { category: "Biaya Marketing", isGuessed: true };
    }
    if (/listrik|pln|internet|wifi|pdam|air|kebersihan|sampah|atk|keperluan kantor/.test(d)) {
      return { category: "Kebutuhan Workshop", isGuessed: true };
    }
    if (/admin|biaya transfer|pajak bank|bunga|materai/.test(d)) {
      return { category: "Biaya Administrasi Finansial", isGuessed: true };
    }
    if (/renov|cat kantor|perbaikan kantor/.test(d)) {
      return { category: "Renovasi Kantor", isGuessed: true };
    }
    if (/notaris|legal|akta|izin|nib|pajak/.test(d)) {
      return { category: "Legalitas Perusahaan", isGuessed: true };
    }
    if (/laptop|pc|komputer|printer|monitor|gadget|mouse|hp/.test(d)) {
      return { category: "Perangkat Gadget", isGuessed: true };
    }
    if (/meja|kursi|lemari|rak|ac|inventaris/.test(d)) {
      return { category: "Inventaris", isGuessed: true };
    }
  }

  return { category: "Perlu dikategorikan", isGuessed: false };
}

// Mengekstrak daftar sheet dan estimasi transaksi
export function getWorkbookSheetsMeta(workbook: XLSX.WorkBook): SheetMeta[] {
  return workbook.SheetNames.map((name) => {
    const type = detectSheetType(name);
    const sheet = workbook.Sheets[name];
    let estimatedRows = 0;

    if (sheet && sheet["!ref"]) {
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      estimatedRows = Math.max(0, range.e.r - 5);
    }

    return {
      name,
      type,
      estimatedRows,
      // Default: centang jika bukan sheet Ringkasan
      isSelected: type !== "SUMMARY",
    };
  });
}

// Parsing isi sheet Excel terpilih menjadi daftar ParsedTransactionRow
export function parseSheetTransactions(
  sheet: XLSX.WorkSheet,
  sheetName: string
): ParsedTransactionRow[] {
  const type = detectSheetType(sheetName);
  if (type === "SUMMARY") return [];

  const isProject = type === "PROJECT";
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (data.length < 6) return [];

  // Peta formula kategori dari cell referensi (J7:J17)
  const categoryMap = new Map<number, string>();
  const mandorRowSet = new Set<number>();

  if (isProject) {
    const addProjCat = (cellRef: string, catName: string) => {
      const c = sheet[cellRef];
      if (c && c.f) {
        parseFormulaRows(sheet, c.f).forEach((r) => categoryMap.set(r, catName));
      }
    };
    addProjCat("J7", "Bahan Baku Utama / Material");
    addProjCat("J8", "Upah Tukang");
    addProjCat("J9", "Sewa Alat Proyek");
    addProjCat("J10", "Transportasi Lapangan");

    if (sheet["J13"] && sheet["J13"].f) {
      parseFormulaRows(sheet, sheet["J13"].f).forEach((r) => {
        mandorRowSet.add(r);
        categoryMap.set(r, "Upah Tukang");
      });
    }
  } else {
    const addKasCat = (cellRef: string, catName: string) => {
      const c = sheet[cellRef];
      if (c && c.f) {
        parseFormulaRows(sheet, c.f).forEach((r) => categoryMap.set(r, catName));
      }
    };
    addKasCat("J7", "Gaji dan Upah Karyawan");
    addKasCat("J8", "Transportasi Operasional");
    addKasCat("J9", "Biaya Konsumsi Kantor");
    addKasCat("J10", "Biaya Jamuan / Representasi");
    addKasCat("J11", "Biaya Marketing");
    addKasCat("J12", "Biaya Administrasi Finansial");
    addKasCat("J13", "Renovasi Kantor");
    addKasCat("J14", "Legalitas Perusahaan");
    addKasCat("J15", "Inventaris");
    addKasCat("J16", "Perangkat Gadget");
    addKasCat("J17", "Kebutuhan Workshop");
  }

  const results: ParsedTransactionRow[] = [];

  // Iterasi baris data (mulai dari baris index 5/6)
  for (let r = 5; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;

    const no = typeof row[0] === "number" ? row[0] : parseInt(String(row[0] || ""), 10);
    const dateRaw = row[1];
    const desc = String(row[2] || "").trim();
    const debit = typeof row[3] === "number" ? row[3] : parseFloat(String(row[3] || "0")) || 0;
    const kredit = typeof row[4] === "number" ? row[4] : parseFloat(String(row[4] || "0")) || 0;

    // Abaikan jika bukan baris data transaksi
    if (isNaN(no) && !desc && debit === 0 && kredit === 0) continue;
    if (desc.toLowerCase().includes("total") || desc.toLowerCase().includes("jumlah") || desc.toLowerCase().includes("saldo awal")) continue;
    if (debit === 0 && kredit === 0) continue;

    const rowExcel = r + 1; // 1-indexed Excel row
    const date = excelDateToISO(dateRaw);

    let category = categoryMap.get(rowExcel) || "";
    let needsCategory = false;

    // Tentukan tipe transaksi
    let txType: "TERMIN_KLIEN" | "PENGELUARAN_PROYEK" | "PENGELUARAN_KANTOR" | "SETORAN_PROYEK";
    let workerAdvanceTo: string | undefined = undefined;

    if (isProject) {
      if (debit > 0) {
        txType = "TERMIN_KLIEN";
        category = "Pendapatan Termin Proyek";
      } else {
        txType = "PENGELUARAN_PROYEK";
        if (!category) {
          const suggested = suggestCategory(desc, true);
          category = suggested.category;
          if (!suggested.isGuessed) needsCategory = true;
        }
        if (mandorRowSet.has(rowExcel) || /kasbon/i.test(desc)) {
          workerAdvanceTo = desc;
        }
      }
    } else {
      if (debit > 0) {
        txType = "SETORAN_PROYEK";
        category = "Setoran Kas Masuk Proyek";
      } else {
        txType = "PENGELUARAN_KANTOR";
        if (!category) {
          const suggested = suggestCategory(desc, false);
          category = suggested.category;
          if (!suggested.isGuessed) needsCategory = true;
        }
      }
    }

    results.push({
      sheetName,
      rowNumber: rowExcel,
      no: isNaN(no) ? undefined : no,
      date,
      description: desc,
      debit,
      kredit,
      category: category || "Perlu dikategorikan",
      type: txType,
      ledger: isProject ? "PROYEK" : "KANTOR",
      needsCategory,
      workerAdvanceTo,
      projectName: isProject ? sheetName : undefined,
    });
  }

  return results;
}

// Parsing CSV datar berformat transaksi_2026.csv
export function parseFlatCSV(csvText: string): ParsedTransactionRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const isTtdCsv = headerLine.includes("sheet") && headerLine.includes("debit") && headerLine.includes("kredit");

  const results: ParsedTransactionRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    if (isTtdCsv) {
      // Regex CSV splitter yang menghormati tanda kutip
      const cols: string[] = [];
      let inQuotes = false;
      let curVal = "";
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cols.push(curVal.trim().replace(/^"|"$/g, ""));
          curVal = "";
        } else {
          curVal += char;
        }
      }
      cols.push(curVal.trim().replace(/^"|"$/g, ""));

      // Format transaksi_2026.csv: sheet,row,no,date,desc,debit,kredit,category,type,ledger,needs_category,worker_advance_to
      const sheet = cols[0] || "Import";
      const rowNum = parseInt(cols[1] || `${i + 1}`, 10);
      const no = parseInt(cols[2] || "0", 10);
      const date = cols[3] || new Date().toISOString().split("T")[0];
      const desc = cols[4] || "";
      const debit = parseFloat(cols[5] || "0") || 0;
      const kredit = parseFloat(cols[6] || "0") || 0;
      const category = cols[7] || "Perlu dikategorikan";
      const rawType = cols[8] as any;
      const ledger = (cols[9] || "PROYEK") as "PROYEK" | "KANTOR";
      const needsCategory = cols[10]?.toUpperCase() === "TRUE";
      const workerAdvanceTo = cols[11] || undefined;

      let type: "TERMIN_KLIEN" | "PENGELUARAN_PROYEK" | "PENGELUARAN_KANTOR" | "SETORAN_PROYEK" = "PENGELUARAN_PROYEK";
      if (rawType === "TERMIN_KLIEN" || rawType === "PENGELUARAN_PROYEK" || rawType === "PENGELUARAN_KANTOR" || rawType === "SETORAN_PROYEK") {
        type = rawType;
      } else if (debit > 0) {
        type = ledger === "PROYEK" ? "TERMIN_KLIEN" : "SETORAN_PROYEK";
      } else {
        type = ledger === "PROYEK" ? "PENGELUARAN_PROYEK" : "PENGELUARAN_KANTOR";
      }

      results.push({
        sheetName: sheet,
        rowNumber: isNaN(rowNum) ? i + 1 : rowNum,
        no: isNaN(no) ? undefined : no,
        date,
        description: desc,
        debit,
        kredit,
        category,
        type,
        ledger,
        needsCategory,
        workerAdvanceTo,
        projectName: ledger === "PROYEK" ? sheet : undefined,
      });
    } else {
      // Format CSV umum (Tanggal, Keterangan, Kategori, Debit, Kredit)
      const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      const date = parts[0] || new Date().toISOString().split("T")[0];
      const desc = parts[1] || "";
      const cat = parts[2] || "Perlu dikategorikan";
      const debit = parseFloat(parts[3] || "0") || 0;
      const kredit = parseFloat(parts[4] || "0") || 0;

      const type = debit > 0 ? "TERMIN_KLIEN" : "PENGELUARAN_KANTOR";

      results.push({
        sheetName: "Import Sheet",
        rowNumber: i + 1,
        date,
        description: desc,
        debit,
        kredit,
        category: cat,
        type,
        ledger: type === "TERMIN_KLIEN" ? "PROYEK" : "KANTOR",
        needsCategory: cat === "Perlu dikategorikan" || !cat,
      });
    }
  }

  return results;
}
