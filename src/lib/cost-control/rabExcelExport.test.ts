import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx-js-style";
import {
  createRabExcelFile,
  createRabExcelWorkbook,
  RAB_EXPORT_COLORS,
  type RabExcelExportInput,
} from "./rabExcelExport";

const logoDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lO0AAAAASUVORK5CYII=";

const sampleRab: RabExcelExportInput = {
  company: {
    name: "Time Travel Design",
    address: "Jl. Contoh No. 123, Sukabumi",
    phone: "0266-123456",
    email: "info@example.test",
  },
  rab: {
    rab_number: "RAB-2026-001",
    version: 1,
    title: "RAB Penawaran - AS House - Jakarta",
    date: "2026-11-28T00:00:00+07:00",
    client_name: "Klien lama",
    project_location: "Jakarta",
    project: {
      name: "AS House - Sukabumi",
      location: "Sukabumi",
      client: { name: "Klien Proyek" },
    },
    total_hpp: 54_360_000,
    overhead_amount: 14_133_600,
    contingency_amount: 0,
    profit_amount: 0,
    tax_percentage: 0,
    tax_amount: 0,
    grand_total: 68_493_600,
  },
  groups: [
    {
      division: "Pekerjaan Persiapan dan Bongkaran",
      subtotalHpp: 3_400_000,
      items: [
        {
          item_name: "Pembongkaran Rangka dan Plafon Gypsum",
          unit: "m2",
          volume: 100,
          unit_hpp: 27_500,
          total_hpp: 2_750_000,
        },
        {
          item_name: "Pembobokan Dinding Bata",
          unit: "m2",
          volume: 10,
          unit_hpp: 65_000,
          total_hpp: 650_000,
        },
      ],
    },
    {
      division: "Pekerjaan Arsitektural",
      subtotalHpp: 50_960_000,
      items: [{
        item_name: "Dinding Bata Ringan 10 cm",
        unit: "m2",
        volume: 400,
        unit_hpp: 127_400,
        total_hpp: 50_960_000,
      }],
    },
  ],
};

function getWorksheetValues(workbook: XLSX.WorkBook) {
  const worksheet = workbook.Sheets["RAB Penawaran"];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
}

describe("RAB Excel export", () => {
  it("uses project metadata and preserves the exact RAB amounts in a short document", () => {
    const workbook = createRabExcelWorkbook(sampleRab, XLSX);
    const worksheet = workbook.Sheets["RAB Penawaran"];
    const values = getWorksheetValues(workbook);
    const headerRow = values.findIndex((row) => row[0] === "No" && row[1] === "Uraian Pekerjaan");
    const sectionRow = values.findIndex((row) => row[0] === "A" && row[1] === "Pekerjaan Persiapan dan Bongkaran");
    const subtotalRow = values.findIndex((row) => row[0] === "Subtotal Pekerjaan Persiapan dan Bongkaran");
    const totalRow = values.findIndex((row) => row[0] === "Total Semua Pekerjaan");
    const feeRow = values.findIndex((row) => row[0] === "Fee (26%)");
    const grandTotalRow = values.findIndex((row) => row[0] === "GRAND TOTAL");
    const documentText = values.flat().join(" ");

    expect(workbook.Props?.Company).toBe("Time Travel Design");
    expect(documentText).toContain("Nama Proyek: AS House - Sukabumi");
    expect(documentText).toContain("Lokasi: Sukabumi");
    expect(documentText).toContain("Klien: Klien Proyek");
    expect(documentText).not.toContain("Jakarta");
    expect(values[headerRow]).toEqual([
      "No",
      "Uraian Pekerjaan",
      "Volume",
      "Satuan",
      "Harga Satuan (Rp)",
      "Jumlah Harga (Rp)",
    ]);
    expect(values[subtotalRow][0]).toBe("Subtotal Pekerjaan Persiapan dan Bongkaran");
    expect(values[subtotalRow][5]).toBe(3_400_000);
    expect(values[totalRow][5]).toBe(54_360_000);
    expect(values[feeRow][5]).toBe(14_133_600);
    expect(values[grandTotalRow][5]).toBe(68_493_600);
    expect(worksheet[XLSX.utils.encode_cell({ r: headerRow, c: 0 })].s.fill.fgColor.rgb)
      .toBe(RAB_EXPORT_COLORS.black);
    expect(worksheet[XLSX.utils.encode_cell({ r: sectionRow, c: 0 })].s.fill.fgColor.rgb)
      .toBe(RAB_EXPORT_COLORS.lightGray);
    expect(worksheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: 0 })].s.fill.fgColor.rgb)
      .toBe(RAB_EXPORT_COLORS.black);
    expect(worksheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: 0 })].s.font.color.rgb)
      .toBe(RAB_EXPORT_COLORS.white);
  });

  it("omits unavailable project information instead of printing placeholder values", () => {
    const input: RabExcelExportInput = {
      ...sampleRab,
      rab: {
        ...sampleRab.rab,
        project: { name: "AS House", location: "", client: null },
      },
    };
    const workbook = createRabExcelWorkbook(input, XLSX);
    const documentText = getWorksheetValues(workbook).flat().join(" ");

    expect(documentText).toContain("Nama Proyek: AS House");
    expect(documentText).not.toContain("Lokasi:");
    expect(documentText).not.toContain("Klien:");
    expect(documentText).not.toContain("Lokasi: -");
    expect(documentText).not.toContain("Klien: -");
  });

  it("wraps long descriptions and sets repeatable A4 print settings for long documents", async () => {
    const groups = Array.from({ length: 8 }, (_, groupIndex) => ({
      division: `Kategori ${groupIndex + 1}`,
      subtotalHpp: 7_001.4,
      items: Array.from({ length: 7 }, (_, itemIndex) => ({
        item_name: `Item ${itemIndex + 1}: ${"uraian pekerjaan dengan spesifikasi teknis panjang ".repeat(3)}`,
        unit: "m2",
        volume: 1.25,
        unit_hpp: 800.16,
        total_hpp: 1000.2,
      })),
    }));
    const input: RabExcelExportInput = {
      ...sampleRab,
      rab: {
        ...sampleRab.rab,
        total_hpp: 56_011.2,
        overhead_amount: 14_562.91,
        grand_total: 70_574.11,
      },
      groups,
    };
    const workbook = createRabExcelWorkbook(input, XLSX);
    const worksheet = workbook.Sheets["RAB Penawaran"];
    const values = getWorksheetValues(workbook);
    const longItemRow = values.findIndex((row) => String(row[1]).startsWith("Item 1:"));
    const headerRow = values.findIndex((row) => row[0] === "No" && row[1] === "Uraian Pekerjaan") + 1;
    const longItemCell = worksheet[XLSX.utils.encode_cell({ r: longItemRow, c: 1 })];
    const bytes = await createRabExcelFile(input, logoDataUrl);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);
    const outputSheet = reopened.getWorksheet("RAB Penawaran");
    if (!outputSheet) throw new Error("Missing RAB worksheet");

    expect(values.filter((row) => typeof row[0] === "number")).toHaveLength(56);
    expect(worksheet["!rows"]?.[longItemRow]?.hpt ?? 0).toBeGreaterThan(24);
    expect(longItemCell.s.alignment.wrapText).toBe(true);
    expect(outputSheet.views[0].showGridLines).toBe(false);
    expect(outputSheet.pageSetup.paperSize).toBe(9);
    expect(outputSheet.pageSetup.orientation).toBe("landscape");
    expect(outputSheet.pageSetup.fitToWidth).toBe(1);
    expect(outputSheet.pageSetup.printArea).toBe(`A1:F${outputSheet.rowCount}`);
    expect(outputSheet.pageSetup.printTitlesRow).toBe(`${headerRow}:${headerRow}`);
    expect(outputSheet.headerFooter.oddFooter).toContain("Halaman &P dari &N");
    expect(outputSheet.getRow(longItemRow + 1).getCell(3).value).toBe(1.25);
    expect(outputSheet.getRow(longItemRow + 1).getCell(5).value).toBe(800.16);
    expect(values.at(-1)?.[0]).toBe("GRAND TOTAL");
    expect(values.at(-1)?.[5]).toBe(70_574.11);

    const finalXlsx = XLSX.read(bytes, { type: "buffer", cellStyles: true });
    const finalWorksheet = finalXlsx.Sheets["RAB Penawaran"];
    const finalHeaderCell = finalWorksheet[XLSX.utils.encode_cell({ r: headerRow - 1, c: 0 })];
    expect(finalHeaderCell.s.fgColor.rgb).toBe(RAB_EXPORT_COLORS.black);
  });

  it("embeds the logo in the left side of the Excel company letterhead", async () => {
    const bytes = await createRabExcelFile(sampleRab, logoDataUrl);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const worksheet = workbook.getWorksheet("RAB Penawaran");
    const images = worksheet?.getImages() ?? [];

    expect(images).toHaveLength(1);
    expect(images[0].range.tl.col).toBeCloseTo(0.2, 1);
    expect(images[0].range.tl.row).toBeCloseTo(0.08, 2);
    expect(worksheet?.getCell("C1").value).toContain("Jl. Contoh No. 123");
    expect(worksheet?.getCell("C1").alignment.horizontal).toBe("left");
  });
});
