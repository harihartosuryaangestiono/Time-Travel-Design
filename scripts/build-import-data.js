const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const wb = XLSX.readFile("Laporan Keuangan 2026.xlsx", { cellFormula: true, cellDates: true });

function parseFormula(sheet, formulaStr, visited = new Set()) {
  if (!formulaStr) return new Set();
  const rows = new Set();

  // Tangani SUM(...)
  const sumMatches = formulaStr.matchAll(/SUM\(([^)]+)\)/g);
  for (const m of sumMatches) {
    const parts = m[1].split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes(":")) {
        const [startCell, endCell] = trimmed.split(":");
        const startCol = startCell.replace(/[0-9]/g, "");
        const endCol = endCell.replace(/[0-9]/g, "");
        const startRow = parseInt(startCell.replace(/[^0-9]/g, ""));
        const endRow = parseInt(endCell.replace(/[^0-9]/g, ""));

        if (startCol === "F" && endCol === "F") {
          for (let r = startRow; r <= endRow; r++) rows.add(r);
        } else {
          // Range kolom lain misalnya K8:L8
          for (let r = startRow; r <= endRow; r++) {
            // Evaluasi K(r), L(r)
            const cols = ["K", "L", "M", "N"];
            cols.forEach(col => {
              const cellKey = `${col}${r}`;
              if (sheet[cellKey] && sheet[cellKey].f && !visited.has(cellKey)) {
                visited.add(cellKey);
                parseFormula(sheet, sheet[cellKey].f, visited).forEach(subR => rows.add(subR));
              }
            });
          }
        }
      } else {
        const col = trimmed.replace(/[0-9]/g, "");
        const r = parseInt(trimmed.replace(/[^0-9]/g, ""));
        if (col === "F" && !isNaN(r)) {
          rows.add(r);
        } else if (!isNaN(r)) {
          const cellKey = `${col}${r}`;
          if (sheet[cellKey] && sheet[cellKey].f && !visited.has(cellKey)) {
            visited.add(cellKey);
            parseFormula(sheet, sheet[cellKey].f, visited).forEach(subR => rows.add(subR));
          }
        }
      }
    }
  }

  // Tangani cell F12 atau K7+L7 di luar SUM
  const cleanStr = formulaStr.replace(/SUM\([^)]+\)/g, "");
  // Cari semua referensi Cell seperti F12, K7, L7
  const cellMatches = cleanStr.matchAll(/([A-Z]+)([0-9]+)/g);
  for (const m of cellMatches) {
    const col = m[1];
    const r = parseInt(m[2]);
    if (col === "F" && !isNaN(r)) {
      rows.add(r);
    } else if (col !== "F" && !isNaN(r)) {
      const cellKey = `${col}${r}`;
      if (sheet[cellKey] && sheet[cellKey].f && !visited.has(cellKey)) {
        visited.add(cellKey);
        parseFormula(sheet, sheet[cellKey].f, visited).forEach(subR => rows.add(subR));
      }
    }
  }

  return rows;
}

function excelDateToISO(serial) {
  if (serial instanceof Date) {
    return serial.toISOString().split("T")[0];
  }
  if (typeof serial === "string" && serial.includes("-")) {
    return serial;
  }
  const n = parseFloat(serial);
  if (isNaN(n) || n <= 0) return "2026-01-01";
  const utc_days = Math.floor(n - 25569);
  const date_info = new Date(utc_days * 86400 * 1000);
  return date_info.toISOString().split("T")[0];
}

const categories = [
  { name: "Bahan Baku Utama / Material", type: "HPP" },
  { name: "Upah Tukang", type: "HPP" },
  { name: "Sewa Alat Proyek", type: "HPP" },
  { name: "Transportasi Lapangan", type: "HPP" },
  { name: "Gaji dan Upah Karyawan", type: "OPEX" },
  { name: "Transportasi Operasional", type: "OPEX" },
  { name: "Biaya Konsumsi Kantor", type: "OPEX" },
  { name: "Biaya Jamuan / Representasi", type: "OPEX" },
  { name: "Biaya Marketing", type: "OPEX" },
  { name: "Kebutuhan Workshop", type: "OPEX" },
  { name: "Biaya Administrasi Finansial", type: "OPEX" },
  { name: "Renovasi Kantor", type: "CAPEX" },
  { name: "Legalitas Perusahaan", type: "CAPEX" },
  { name: "Inventaris", type: "CAPEX" },
  { name: "Perangkat Gadget", type: "CAPEX" }
];

// 1. Ekstrak Pemetaan Kas Perusahaan
const kasSheet = wb.Sheets["Lapkeu Perusahaan"];
const kasCategoryMap = new Map();

function addKasCategory(cellRef, catName) {
  const cell = kasSheet[cellRef];
  if (!cell || !cell.f) return;
  const rows = parseFormula(kasSheet, cell.f);
  rows.forEach(r => kasCategoryMap.set(r, catName));
}

addKasCategory("J7", "Gaji dan Upah Karyawan");
addKasCategory("J8", "Transportasi Operasional");
addKasCategory("J9", "Biaya Konsumsi Kantor");
addKasCategory("J10", "Biaya Jamuan / Representasi");
addKasCategory("J11", "Biaya Marketing");
addKasCategory("J12", "Biaya Administrasi Finansial");
addKasCategory("J13", "Renovasi Kantor");
addKasCategory("J14", "Legalitas Perusahaan");
addKasCategory("J15", "Inventaris");
addKasCategory("J16", "Perangkat Gadget");
addKasCategory("J17", "Kebutuhan Workshop");

// Ekstrak baris bunga bank yang mengurangi admin finansial
if (kasSheet["J12"] && kasSheet["J12"].f) {
  const f = kasSheet["J12"].f;
  const matches = f.matchAll(/([EF])([0-9]+)/g);
  for (const m of matches) {
    const col = m[1];
    const r = parseInt(m[2]);
    kasCategoryMap.set(r, "Biaya Administrasi Finansial");
  }
}

// 2. Daftar 17 Proyek
const projectSheetNames = [
  "Charity House - Bintaro",
  "3HI Office - Kemayoran",
  "FG House - Harapan Mulya",
  "PH House - Bogor",
  "DNN Office - Kemayoran",
  "RM Kost - Epi Suryadinata",
  "SJ House - Tria Andika (KM)",
  "Dapur Bebek - Bintaro",
  "SJ House - Tria Andika (LT 3)",
  "Kantor Blok SR - Kemayoran",
  "TJ House - Tommy Saputra (T3)",
  "SJ House - Tria Andika (LT2)",
  "CR House - Erick",
  "TJ House - Tommy Saputra (LT2)",
  "TJ House - Tommy Saputra (LT1)",
  "SJ House - Tria Andika (LT1)",
  "YP House - Yerry Primadi"
];

const projectMandorRows = new Map();
const projectCategoryMap = new Map();

projectSheetNames.forEach(sheetName => {
  const s = wb.Sheets[sheetName];
  const catMap = new Map();
  const mandorRows = new Set();

  function addProjCat(cellRef, catName) {
    const c = s[cellRef];
    if (c && c.f) {
      parseFormula(s, c.f).forEach(r => catMap.set(r, catName));
    }
  }

  addProjCat("J7", "Bahan Baku Utama / Material");
  addProjCat("J8", "Upah Tukang");
  addProjCat("J9", "Sewa Alat Proyek");
  addProjCat("J10", "Transportasi Lapangan");

  if (s["J13"] && s["J13"].f) {
    parseFormula(s, s["J13"].f).forEach(r => {
      mandorRows.add(r);
      catMap.set(r, "Upah Tukang");
    });
  }

  projectCategoryMap.set(sheetName, catMap);
  projectMandorRows.set(sheetName, mandorRows);
});

// 3. Ekstrak Transaksi
const allTransactions = [];
let totalRevenue = 0;
let totalMaterial = 0;
let totalUpah = 0;
let totalSewa = 0;
let totalTrans = 0;
let totalOpex = 0;
let totalCapex = 0;
let totalUncategorized = 0;
let uncategorizedCount = 0;
let uncategorizedProjectCount = 0;
let uncategorizedKasCount = 0;

const projectsList = [];

projectSheetNames.forEach(sheetName => {
  const s = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(s, { header: 1, defval: "" });
  const catMap = projectCategoryMap.get(sheetName);
  const mandorSet = projectMandorRows.get(sheetName);

  let projDebit = 0;
  let projKredit = 0;

  const parts = sheetName.split(" - ");
  const code = parts[0].trim();
  const client = parts.length > 1 ? parts.slice(1).join(" - ").trim() : code;

  for (let r = 5; r < data.length; r++) {
    const row = data[r];
    const no = row[0];
    const dateRaw = row[1];
    const desc = row[2];
    const debit = parseFloat(row[3] || 0) || 0;
    const kredit = parseFloat(row[4] || 0) || 0;

    if (typeof no !== "number" || isNaN(no)) continue;
    if (!desc && !debit && !kredit) continue;
    if (typeof desc === "string" && (desc.toLowerCase().includes("total") || desc.toLowerCase().includes("jumlah"))) continue;
    if (debit === 0 && kredit === 0) continue;

    const rowExcel = r + 1;
    const isTermin = debit > 0;
    const date = excelDateToISO(dateRaw);
    const descStr = String(desc).trim();

    let category = null;
    let needs_category = false;
    let worker_advance_to = null;

    if (isTermin) {
      projDebit += debit;
      totalRevenue += debit;
    } else {
      projKredit += kredit;
      if (catMap.has(rowExcel)) {
        category = catMap.get(rowExcel);
        if (category === "Bahan Baku Utama / Material") totalMaterial += kredit;
        if (category === "Upah Tukang") totalUpah += kredit;
        if (category === "Sewa Alat Proyek") totalSewa += kredit;
        if (category === "Transportasi Lapangan") totalTrans += kredit;
      } else {
        category = "Perlu dikategorikan";
        needs_category = true;
        totalUncategorized += kredit;
        uncategorizedCount++;
        uncategorizedProjectCount++;
      }

      if (mandorSet.has(rowExcel) || descStr.toLowerCase().includes("kasbon")) {
        worker_advance_to = descStr;
      }
    }

    allTransactions.push({
      sheet: sheetName,
      row: rowExcel,
      no,
      date,
      desc: descStr,
      debit,
      kredit,
      category,
      type: isTermin ? "TERMIN_KLIEN" : "PENGELUARAN_PROYEK",
      ledger: "PROYEK",
      needs_category,
      worker_advance_to: worker_advance_to || undefined
    });
  }

  projectsList.push({
    name: sheetName,
    code,
    client,
    total_received: projDebit,
    total_spent: projKredit
  });
});

// Proses Sheet Lapkeu Perusahaan
const kasData = XLSX.utils.sheet_to_json(kasSheet, { header: 1, defval: "" });

for (let r = 4; r < kasData.length; r++) {
  const row = kasData[r];
  const no = row[0];
  const dateRaw = row[1];
  const desc = row[2];
  const debit = parseFloat(row[3] || 0) || 0;
  const kredit = parseFloat(row[4] || 0) || 0;

  if (typeof no !== "number" || isNaN(no)) continue;
  if (!desc && !debit && !kredit) continue;
  if (typeof desc === "string" && (desc.toLowerCase().includes("total") || desc.toLowerCase().includes("jumlah") || desc.toLowerCase().includes("saldo"))) continue;
  if (debit === 0 && kredit === 0) continue;

  const rowExcel = r + 1;
  const date = excelDateToISO(dateRaw);
  const descStr = String(desc).trim();

  let type = "PENGELUARAN_KANTOR";
  let category = kasCategoryMap.get(rowExcel) || null;
  let needs_category = false;

  if (rowExcel === 6 && descStr.includes("Kas Modal 2025")) {
    type = "MODAL_AWAL";
    category = null;
  } else if (descStr.startsWith("Final Project -")) {
    type = "SETORAN_PROYEK"; // JANGAN DIIMPOR (input ganda)
    category = null;
  } else if (descStr.toLowerCase().includes("bunga bank bca") && debit > 0) {
    type = "BUNGA_BANK";
    category = "Biaya Administrasi Finansial";
  } else if (kredit > 0) {
    type = "PENGELUARAN_KANTOR";
    if (!category) {
      category = "Perlu dikategorikan";
      needs_category = true;
      totalUncategorized += kredit;
      uncategorizedCount++;
      uncategorizedKasCount++;
    } else {
      const catObj = categories.find(c => c.name === category);
      if (catObj && catObj.type === "OPEX") totalOpex += kredit;
      if (catObj && catObj.type === "CAPEX") totalCapex += kredit;
    }
  }

  allTransactions.push({
    sheet: "Lapkeu Perusahaan",
    row: rowExcel,
    no,
    date,
    desc: descStr,
    debit,
    kredit,
    category,
    type,
    ledger: "KAS_PERUSAHAAN",
    needs_category
  });
}

const totalHpp = totalMaterial + totalUpah + totalSewa + totalTrans;
const importable = allTransactions.filter(t => t.type !== "SETORAN_PROYEK");

console.log("\n=======================================================");
console.log("             HASIL REKONSILIASI AKHIR");
console.log("=======================================================");
console.log(`Total Semua Transaksi Excel : ${allTransactions.length} baris`);
console.log(`SETORAN_PROYEK diabaikan    : ${allTransactions.length - importable.length} baris`);
console.log(`Transaksi Diimpor           : ${importable.length} baris`);
console.log("-------------------------------------------------------");
console.log(`Total Pendapatan Proyek     : Rp ${totalRevenue.toLocaleString("id-ID")}`);
console.log(`Total HPP Berkategori       : Rp ${totalHpp.toLocaleString("id-ID")}`);
console.log(`  - Material                : Rp ${totalMaterial.toLocaleString("id-ID")}`);
console.log(`  - Upah Tukang             : Rp ${totalUpah.toLocaleString("id-ID")}`);
console.log(`  - Sewa Alat               : Rp ${totalSewa.toLocaleString("id-ID")}`);
console.log(`  - Transportasi Lapangan   : Rp ${totalTrans.toLocaleString("id-ID")}`);
console.log(`Total Opex Berkategori      : Rp ${totalOpex.toLocaleString("id-ID")}`);
console.log(`Total Capex                 : Rp ${totalCapex.toLocaleString("id-ID")}`);
console.log(`Total Belum Berkategori     : Rp ${totalUncategorized.toLocaleString("id-ID")} (${uncategorizedCount} baris: ${uncategorizedProjectCount} di proyek, ${uncategorizedKasCount} di kas perusahaan)`);
console.log("=======================================================\n");

const kasbon_karyawan = [
  {
    name: "Om Doddy",
    role: "OWNER",
    max_advance_amount: 100000000,
    opening_balance: 73500000,
    components: [
      { desc: "Plafon Rp 100.000.000, terpakai Rp 73.500.000, sisa plafon Rp 26.500.000", amount: 73500000 }
    ],
    notes: "Saldo awal kasbon dari Excel, rincian tanggal perlu dilengkapi"
  },
  {
    name: "Emir",
    role: "OWNER",
    max_advance_amount: 200000000,
    opening_balance: 113111100,
    components: [
      { desc: "Komponen kasbon Emir di Excel: Rp 102.108.600 + komponen lain", amount: 113111100 }
    ],
    notes: "Saldo awal kasbon dari Excel, rincian tanggal perlu dilengkapi"
  },
  {
    name: "Dustin",
    role: "OWNER",
    max_advance_amount: 200000000,
    opening_balance: 188383595,
    components: [
      { desc: "Komponen kasbon Dustin di Excel: Rp 181.783.595 + komponen lain", amount: 188383595 }
    ],
    notes: "Saldo awal kasbon dari Excel, rincian tanggal perlu dilengkapi"
  }
];

const kasbon_mandor_proyek = [
  {
    mandor_name: "Mas Imam",
    project_name: "RM Kost - Epi Suryadinata",
    plafon: null,
    notes: "RM Kost - Mas Imam (plafon perlu dilengkapi)"
  },
  {
    mandor_name: "Pak Jayadih",
    project_name: "PH House - Bogor",
    plafon: null,
    notes: "PH House - Pak Jayadih (plafon perlu dilengkapi)"
  },
  {
    mandor_name: "Mas Alan",
    project_name: "DNN Office - Kemayoran",
    plafon: 60000000,
    notes: "DNN Office - Mas Alan (plafon Rp 60.000.000)"
  },
  {
    mandor_name: "Mang Rian",
    project_name: "Charity House - Bintaro",
    plafon: null,
    notes: "Charity House - Mang Rian"
  }
];

const finalJson = {
  organization: {
    legal_name: "PT. RUMA INOVASI INDONESIA",
    brand: "Time Travel Design",
    fiscal_year: 2026,
    currency: "IDR",
    opening_cash_2025: 12500179.89
  },
  categories,
  projects: projectsList,
  kasbon_karyawan,
  kasbon_mandor_proyek,
  transactions: allTransactions
};

fs.mkdirSync("data/import", { recursive: true });
fs.writeFileSync("data/import/ttd_import_data.json", JSON.stringify(finalJson, null, 2), "utf8");
console.log("File JSON berhasil dibuat: data/import/ttd_import_data.json");

const csvHeaders = [
  "sheet", "row", "no", "date", "desc", "debit", "kredit", "category", "type", "ledger", "needs_category", "worker_advance_to"
];

const csvRows = [csvHeaders.join(",")];
allTransactions.forEach(t => {
  const row = [
    `"${t.sheet.replace(/"/g, '""')}"`,
    t.row,
    t.no,
    t.date,
    `"${t.desc.replace(/"/g, '""')}"`,
    t.debit,
    t.kredit,
    t.category ? `"${t.category.replace(/"/g, '""')}"` : "",
    t.type,
    t.ledger,
    t.needs_category ? "TRUE" : "FALSE",
    t.worker_advance_to ? `"${t.worker_advance_to.replace(/"/g, '""')}"` : ""
  ];
  csvRows.push(row.join(","));
});

fs.writeFileSync("data/import/transaksi_2026.csv", "\uFEFF" + csvRows.join("\r\n"), "utf8");
console.log("File CSV berhasil dibuat: data/import/transaksi_2026.csv");
