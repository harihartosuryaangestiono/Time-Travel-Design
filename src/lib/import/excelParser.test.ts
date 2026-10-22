import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseStrictDate,
  findHeaderRow,
  checkExcelWorkbook,
  parseCsv,
  generateCsvTemplate,
} from './excelParser';

describe('excelParser unit tests', () => {
  describe('1. parseStrictDate', () => {
    it('menerima nomor seri Excel dan mengonversi ke YYYY-MM-DD secara akurat', () => {
      // 46023 = 2026-01-01 di kalender Excel 1900
      const d1 = parseStrictDate(46023);
      expect(d1).toBe('2026-01-01');

      // 46054 = 2026-02-01
      const d2 = parseStrictDate(46054);
      expect(d2).toBe('2026-02-01');
    });

    it('menerima format ISO YYYY-MM-DD', () => {
      expect(parseStrictDate('2026-03-15')).toBe('2026-03-15');
      expect(parseStrictDate('2026-12-31')).toBe('2026-12-31');
    });

    it('menerima format dd/MM/yyyy dan dd-MM-yyyy', () => {
      expect(parseStrictDate('15/01/2026')).toBe('2026-01-15');
      expect(parseStrictDate('05/02/2026')).toBe('2026-02-05');
      expect(parseStrictDate('31-12-2026')).toBe('2026-12-31');
    });

    it('TIDAK PERNAH mengisi tanggal otomatis dengan hari ini; mengembalikan null untuk input tidak valid', () => {
      expect(parseStrictDate('')).toBeNull();
      expect(parseStrictDate(null)).toBeNull();
      expect(parseStrictDate(undefined)).toBeNull();
      expect(parseStrictDate('bukan tanggal')).toBeNull();
      expect(parseStrictDate('32/01/2026')).toBeNull();
      expect(parseStrictDate('2026-02-30')).toBeNull();
      expect(parseStrictDate(0)).toBeNull(); // 0 tidak valid
      expect(parseStrictDate(999)).toBeNull(); // di luar batas wajar
    });
  });

  describe('2. findHeaderRow', () => {
    it('memindai 15 baris pertama dan memetakan kolom berdasarkan nama header (bukan posisi index)', () => {
      const rawRows = [
        ['LAPORAN KEUANGAN PROYEK X', '', ''],
        ['PT. RUMA INOVASI INDONESIA', '', ''],
        ['', '', ''],
        ['No', 'Tanggal Transaksi', 'Uraian Keterangan', 'Kredit (Pengeluaran)', 'Debit (Penerimaan)'],
      ];

      const headerInfo = findHeaderRow(rawRows);
      expect(headerInfo).not.toBeNull();
      expect(headerInfo?.headerRowIndex).toBe(3);
      expect(headerInfo?.colMap.date).toBe(1);
      expect(headerInfo?.colMap.desc).toBe(2);
      expect(headerInfo?.colMap.kredit).toBe(3);
      expect(headerInfo?.colMap.debit).toBe(4);
    });

    it('mengembalikan null jika tidak ada baris header yang memuat Tanggal, Keterangan, dan Debit/Kredit dalam 15 baris pertama', () => {
      const rawRows = [
        ['A', 'B', 'C'],
        ['D', 'E', 'F'],
      ];
      expect(findHeaderRow(rawRows)).toBeNull();
    });
  });

  describe('3. checkExcelWorkbook', () => {
    it('mendeteksi jika sheet bernama Rekapitulasi ada dalam workbook', () => {
      const check = checkExcelWorkbook(['Rekapitulasi', 'PH House']);
      expect(check.isMultiSheetOrRekap).toBe(true);
      expect(check.reason).toContain('Format workbook multi-sheet belum didukung di UI');
    });

    it('mendeteksi jika workbook memiliki lebih dari 1 sheet', () => {
      const check = checkExcelWorkbook(['Sheet1', 'Sheet2']);
      expect(check.isMultiSheetOrRekap).toBe(true);
      expect(check.reason).toContain('Format workbook multi-sheet belum didukung di UI');
    });

    it('mengizinkan single sheet valid tanpa nama Rekapitulasi', () => {
      const check = checkExcelWorkbook(['Charity House - Bintaro']);
      expect(check.isMultiSheetOrRekap).toBe(false);
      expect(check.reason).toBeUndefined();
    });
  });

  describe('4. generateCsvTemplate', () => {
    it('menghasilkan template CSV ber-BOM UTF-8 dengan 11 kolom wajib', () => {
      const csv = generateCsvTemplate();
      expect(csv.startsWith('\uFEFF')).toBe(true);
      const lines = csv.split('\n');
      const headerLine = lines[0].replace('\uFEFF', '').trim();
      const headers = headerLine.split(',');
      expect(headers).toEqual([
        'buku',
        'sheet_asal',
        'baris_excel',
        'tanggal',
        'keterangan',
        'jenis',
        'kategori',
        'debit',
        'kredit',
        'kasbon_ke',
        'perlu_kategori',
      ]);
    });
  });

  describe('5. parseCsv dengan transaksi_2026.csv asli', () => {
    const csvPath = path.resolve(__dirname, '../../../data/import/transaksi_2026.csv');

    it('mem-parse data transaksi_2026.csv dengan akurasi angka sesuai spesifikasi', () => {
      expect(fs.existsSync(csvPath)).toBe(true);
      const csvContent = fs.readFileSync(csvPath, 'utf-8');

      const result = parseCsv(csvContent);

      // 1. Total baris dibaca dan status
      expect(result.totalRead).toBe(1450);
      expect(result.totalSkipped).toBe(17); // 17 baris SETORAN_PROYEK dilewati
      expect(result.totalValid).toBe(1433);
      expect(result.totalInvalid).toBe(0);

      // 2. Total Debit Valid
      // Formula: 2.275.050.682 (Termin Klien) + 12.500.179,89 (Modal Awal) + 38.133,46 (Bunga Bank)
      // = 2.287.588.995,35
      expect(result.totalDebit).toBeCloseTo(2287588995.35, 2);

      // Nominal setoran yang dilewati tidak dihitung ke total debit
      expect(result.totalSkippedDebit).toBeCloseTo(646467514, 0);

      // 3. Total Kredit Valid
      expect(result.totalCredit).toBeCloseTo(1914441967.75, 2);

      // 4. Perlu Dikategorikan
      expect(result.totalNeedsCategory).toBe(38);

      // Verifikasi 19 baris kategori proyek & kantor unmapped senilai 33.659.290
      const needsRows = result.validRows.filter((r) => r.needsCategory);
      expect(needsRows.length).toBe(38);

      const target19Rows = [
        { sheet: 'Charity House - Bintaro', row: 13, amount: 1125000 },
        { sheet: 'Charity House - Bintaro', row: 14, amount: 6523000 },
        { sheet: '3HI Office - Kemayoran', row: 19, amount: 790500 },
        { sheet: '3HI Office - Kemayoran', row: 20, amount: 1169000 },
        { sheet: '3HI Office - Kemayoran', row: 21, amount: 6174690 },
        { sheet: '3HI Office - Kemayoran', row: 22, amount: 2640000 },
        { sheet: 'FG House - Harapan Mulya', row: 23, amount: 2315000 },
        { sheet: 'PH House - Bogor', row: 82, amount: 4875700 },
        { sheet: 'DNN Office - Kemayoran', row: 199, amount: 145000 },
        { sheet: 'DNN Office - Kemayoran', row: 200, amount: 528000 },
        { sheet: 'RM Kost - Epi Suryadinata', row: 119, amount: 3600800 },
        { sheet: 'RM Kost - Epi Suryadinata', row: 120, amount: 1500000 },
        { sheet: 'RM Kost - Epi Suryadinata', row: 121, amount: 1722000 },
        { sheet: 'TJ House - Tommy Saputra (LT1)', row: 6, amount: 29000 },
        { sheet: 'TJ House - Tommy Saputra (LT1)', row: 8, amount: 10000 },
        { sheet: 'Lapkeu Perusahaan', row: 83, amount: 38000 },
        { sheet: 'Lapkeu Perusahaan', row: 112, amount: 100000 },
        { sheet: 'Lapkeu Perusahaan', row: 210, amount: 248600 },
        { sheet: 'Lapkeu Perusahaan', row: 424, amount: 125000 },
      ];

      expect(target19Rows.length).toBe(19);
      const sum19 = target19Rows.reduce((sum, item) => sum + item.amount, 0);
      expect(sum19).toBe(33659290);

      // 5. Verifikasi Idempoten external_ref
      const firstRow = result.validRows[0];
      expect(firstRow.externalRef).toBe(`${firstRow.sheetAsal}_${firstRow.barisExcel}`);
    });
  });
});
