import type { CellStyle, WorkBook, WorkSheet } from "xlsx-js-style";

export const RAB_BRAND_LOGO_PATH = "/images/logo-full-transparent.png";
export const RAB_EXPORT_COLORS = {
  black: "000000",
  white: "FFFFFF",
  lightGray: "F2F2F2",
  lineGray: "D9D9D9",
  mutedGray: "666666",
};

export interface RabExcelExportInput {
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  rab: {
    rab_number: string;
    version: number;
    title: string;
    date: string;
    client_name?: string | null;
    project_location?: string | null;
    project?: {
      name?: string | null;
      location?: string | null;
      client?: { name?: string | null } | null;
    };
    total_hpp: number;
    overhead_amount: number;
    contingency_amount: number;
    profit_amount: number;
    tax_percentage: number;
    tax_amount: number;
    grand_total: number;
  };
  groups: Array<{
    division: string;
    subtotalHpp: number;
    items: Array<{
      item_name: string;
      unit: string;
      volume: number;
      unit_hpp: number;
      total_hpp: number;
    }>;
  }>;
}

const COLORS = RAB_EXPORT_COLORS;
const CELL_BORDER = {
  top: { style: "thin" as const, color: { rgb: COLORS.lineGray } },
  bottom: { style: "thin" as const, color: { rgb: COLORS.lineGray } },
  left: { style: "thin" as const, color: { rgb: COLORS.lineGray } },
  right: { style: "thin" as const, color: { rgb: COLORS.lineGray } },
};
const NUMBER_FORMAT = "#,##0.########";

interface RabMetadata {
  label: string;
  value: string;
}

function fill(color: string) {
  return { patternType: "solid" as const, fgColor: { rgb: color } };
}

function encodeCell(rowIndex: number, columnIndex: number) {
  let column = columnIndex + 1;
  let label = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    column = Math.floor((column - 1) / 26);
  }
  return `${label}${rowIndex + 1}`;
}

function applyRowStyle(
  worksheet: WorkSheet,
  rowIndex: number,
  startColumn: number,
  endColumn: number,
  style: CellStyle,
) {
  for (let column = startColumn; column <= endColumn; column += 1) {
    const address = encodeCell(rowIndex, column);
    const cell = worksheet[address] || { t: "s" as const, v: "" };
    cell.s = style;
    worksheet[address] = cell;
  }
}

function formatDocumentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatFeePercentage(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function estimateWrappedHeight(text: string, width: number) {
  const lineCount = text.split(/\r?\n/).reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / width)),
    0,
  );
  return Math.max(24, lineCount * 14 + 10);
}

function getRabMetadata(input: RabExcelExportInput): RabMetadata[] {
  const { rab } = input;
  const projectName = rab.project?.name?.trim() || rab.title.trim();
  return [
    { label: "Nomor RAB", value: rab.rab_number.trim() },
    { label: "Versi", value: String(rab.version) },
    { label: "Tanggal", value: formatDocumentDate(rab.date) },
    { label: "Nama Proyek", value: projectName },
    { label: "Lokasi", value: rab.project?.location?.trim() || "" },
    { label: "Klien", value: rab.project?.client?.name?.trim() || "" },
  ].filter((item) => item.value.length > 0);
}

export function createRabExcelWorkbook(
  input: RabExcelExportInput,
  XLSX: typeof import("xlsx-js-style"),
): WorkBook {
  const { company, rab, groups } = input;
  const rows: (string | number)[][] = [];
  const fullWidthRows: number[] = [];
  const metadataRows: Array<{ row: number; left: boolean; right: boolean }> = [];
  const groupRows: number[] = [];
  const subtotalRows: number[] = [];
  const itemRows: number[] = [];
  const itemRowHeights = new Map<number, number>();
  const summaryRows: Array<{ row: number; type: "total" | "fee" | "tax" | "grand" }> = [];
  const metadataItems = getRabMetadata(input);
  const projectName = rab.project?.name?.trim() || rab.title.trim();
  const companyContact = [
    company.address?.trim(),
    company.phone?.trim() ? `Telepon ${company.phone.trim()}` : "",
    company.email?.trim() ? `Email ${company.email.trim()}` : "",
  ].filter(Boolean).join("\n");
  const logoRow = rows.length;
  rows.push(["", "", companyContact, "", "", ""]);
  const addFullWidthRow = (text: string) => {
    fullWidthRows.push(rows.length);
    rows.push([text, "", "", "", "", ""]);
    return rows.length - 1;
  };
  const reportTitleRow = addFullWidthRow("RENCANA ANGGARAN BIAYA (RAB)");
  const projectTitleRow = addFullWidthRow(projectName.toUpperCase());

  for (let index = 0; index < metadataItems.length; index += 2) {
    const left = metadataItems[index];
    const right = metadataItems[index + 1];
    const row = rows.length;
    rows.push([
      left ? `${left.label}: ${left.value}` : "",
      "",
      "",
      right ? `${right.label}: ${right.value}` : "",
      "",
      "",
    ]);
    metadataRows.push({ row, left: Boolean(left), right: Boolean(right) });
  }
  rows.push([]);

  const tableHeaderRow = rows.length;
  rows.push([
    "No",
    "Uraian Pekerjaan",
    "Volume",
    "Satuan",
    "Harga Satuan (Rp)",
    "Jumlah Harga (Rp)",
  ]);

  let itemNumber = 1;
  groups.forEach((group, groupIndex) => {
    rows.push([String.fromCharCode(65 + groupIndex), group.division, "", "", "", ""]);
    groupRows.push(rows.length - 1);
    group.items.forEach((item) => {
      rows.push([
        itemNumber++,
        item.item_name,
        item.volume,
        item.unit,
        item.unit_hpp,
        item.total_hpp,
      ]);
      const itemRow = rows.length - 1;
      itemRows.push(itemRow);
      itemRowHeights.set(itemRow, estimateWrappedHeight(item.item_name, 56));
    });
    rows.push([`Subtotal ${group.division}`, "", "", "", "", group.subtotalHpp]);
    subtotalRows.push(rows.length - 1);
  });

  rows.push([]);
  const addSummaryRow = (
    label: string,
    amount: number,
    type: "total" | "fee" | "tax" | "grand",
  ) => {
    rows.push([label, "", "", "", "", amount]);
    summaryRows.push({ row: rows.length - 1, type });
  };
  const feeAmount = rab.overhead_amount + rab.contingency_amount + rab.profit_amount;
  const feePercentage = rab.total_hpp > 0 ? (feeAmount / rab.total_hpp) * 100 : 0;
  addSummaryRow("Total Semua Pekerjaan", rab.total_hpp, "total");
  addSummaryRow(`Fee (${formatFeePercentage(feePercentage)}%)`, feeAmount, "fee");
  if (rab.tax_percentage > 0) {
    addSummaryRow(`Pajak Pertambahan Nilai (PPN ${rab.tax_percentage}%)`, rab.tax_amount, "tax");
  }
  addSummaryRow("GRAND TOTAL", rab.grand_total, "grand");

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!merges"] = [
    { s: { r: logoRow, c: 2 }, e: { r: logoRow, c: 5 } },
    ...fullWidthRows.map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: 5 } })),
    ...metadataRows.flatMap(({ row, left, right }) => [
      ...(left ? [{ s: { r: row, c: 0 }, e: { r: row, c: 2 } }] : []),
      ...(right ? [{ s: { r: row, c: 3 }, e: { r: row, c: 5 } }] : []),
    ]),
    ...groupRows.map((row) => ({ s: { r: row, c: 1 }, e: { r: row, c: 5 } })),
    ...subtotalRows.map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: 4 } })),
    ...summaryRows.map(({ row }) => ({ s: { r: row, c: 0 }, e: { r: row, c: 4 } })),
  ];
  worksheet["!cols"] = [
    { wch: 7 },
    { wch: 56 },
    { wch: 13 },
    { wch: 13 },
    { wch: 23 },
    { wch: 24 },
  ];
  worksheet["!rows"] = rows.map((_, row) => ({
    hpt: row === logoRow ? 78
      : row === reportTitleRow ? 27
        : row === projectTitleRow ? 26
          : metadataRows.some((metadata) => metadata.row === row) ? 30
            : row === tableHeaderRow ? 30
              : groupRows.includes(row) ? 23
                : itemRowHeights.get(row) ?? (
                  subtotalRows.includes(row) ? 23
                    : summaryRows.some((summary) => summary.row === row) ? 25
                      : 9
                ),
  }));
  worksheet["!margins"] = {
    left: 0.25,
    right: 0.25,
    top: 0.35,
    bottom: 0.45,
    header: 0.15,
    footer: 0.25,
  };

  applyRowStyle(worksheet, logoRow, 0, 5, {
    font: { name: "Arial", sz: 10, color: { rgb: COLORS.black } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: { bottom: { style: "medium", color: { rgb: COLORS.black } } },
  });
  applyRowStyle(worksheet, reportTitleRow, 0, 5, {
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: COLORS.white } },
    fill: fill(COLORS.black),
    alignment: { horizontal: "center", vertical: "center" },
  });
  applyRowStyle(worksheet, projectTitleRow, 0, 5, {
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: COLORS.black } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });
  metadataRows.forEach(({ row, left, right }) => {
    if (left) {
      applyRowStyle(worksheet, row, 0, 2, {
        font: { name: "Arial", sz: 9, color: { rgb: COLORS.black } },
        fill: fill(COLORS.lightGray),
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: CELL_BORDER,
      });
    }
    if (right) {
      applyRowStyle(worksheet, row, 3, 5, {
        font: { name: "Arial", sz: 9, color: { rgb: COLORS.black } },
        fill: fill(COLORS.lightGray),
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        border: CELL_BORDER,
      });
    }
  });
  applyRowStyle(worksheet, tableHeaderRow, 0, 5, {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: COLORS.white } },
    fill: fill(COLORS.black),
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: CELL_BORDER,
  });

  groupRows.forEach((row) => {
    applyRowStyle(worksheet, row, 0, 5, {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: COLORS.black } },
      fill: fill(COLORS.lightGray),
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: CELL_BORDER,
    });
    const numberCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    if (numberCell) {
      numberCell.s = {
        ...numberCell.s,
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  });

  itemRows.forEach((row) => {
    for (let column = 0; column < 6; column += 1) {
      const horizontal = column === 0 || column === 3 ? "center"
        : column === 1 ? "left"
          : "right";
      applyRowStyle(worksheet, row, column, column, {
        font: { name: "Arial", sz: 9, color: { rgb: COLORS.black } },
        fill: fill(COLORS.white),
        alignment: {
          horizontal,
          vertical: "center",
          wrapText: column === 1,
        },
        border: CELL_BORDER,
      });
    }
    const volumeCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
    if (volumeCell) volumeCell.z = NUMBER_FORMAT;
    [4, 5].forEach((column) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = NUMBER_FORMAT;
    });
  });

  subtotalRows.forEach((row) => {
    applyRowStyle(worksheet, row, 0, 5, {
      font: { name: "Arial", sz: 9, bold: true, color: { rgb: COLORS.black } },
      fill: fill(COLORS.lightGray),
      alignment: { horizontal: "right", vertical: "center" },
      border: CELL_BORDER,
    });
    const labelCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    if (labelCell) {
      labelCell.s = {
        ...labelCell.s,
        alignment: { horizontal: "left", vertical: "center" },
      };
    }
    const amountCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 5 })];
    if (amountCell) amountCell.z = NUMBER_FORMAT;
  });

  summaryRows.forEach(({ row, type }) => {
    const isGrandTotal = type === "grand";
    applyRowStyle(worksheet, row, 0, 5, {
      font: {
        name: "Arial",
        sz: isGrandTotal ? 12 : 9,
        bold: isGrandTotal || type === "total",
        color: { rgb: isGrandTotal ? COLORS.white : COLORS.black },
      },
      fill: fill(isGrandTotal ? COLORS.black : type === "total" ? COLORS.lightGray : COLORS.white),
      alignment: { horizontal: "right", vertical: "center" },
      border: CELL_BORDER,
    });
    const labelCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    if (labelCell) {
      labelCell.s = {
        ...labelCell.s,
        alignment: { horizontal: "left", vertical: "center" },
      };
    }
    const amountCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 5 })];
    if (amountCell) amountCell.z = isGrandTotal ? '"Rp" #,##0.########' : NUMBER_FORMAT;
  });

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: `RAB ${rab.rab_number}`,
    Subject: rab.title,
    Author: company.name,
    Company: company.name,
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(workbook, worksheet, "RAB Penawaran");
  return workbook;
}

async function loadBlackBrandLogoDataUrl() {
  const response = await fetch(RAB_BRAND_LOGO_PATH);
  if (!response.ok) {
    throw new Error(`Gagal memuat logo Time Travel Design: ${response.status}`);
  }
  const logoUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Gagal membaca logo Time Travel Design."));
      image.src = logoUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Browser tidak mendukung pemrosesan logo RAB.");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (pixels.data[index + 3] > 0) {
        pixels.data[index] = 0;
        pixels.data[index + 1] = 0;
        pixels.data[index + 2] = 0;
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(logoUrl);
  }
}

export async function downloadRabExcel(input: RabExcelExportInput, fileName: string) {
  const logoDataUrl = await loadBlackBrandLogoDataUrl();
  const file = await createRabExcelFile(input, logoDataUrl);
  const blob = new Blob([file], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function addPaginationBreaks(worksheet: import("exceljs").Worksheet, headerRow: number) {
  const pageCapacity = 490;
  const rowHeight = (rowNumber: number) => worksheet.getRow(rowNumber).height ?? 15;
  const repeatHeaderHeight = rowHeight(headerRow);
  let usedHeight = 0;
  for (let rowNumber = 1; rowNumber <= headerRow; rowNumber += 1) {
    usedHeight += rowHeight(rowNumber);
  }

  let summaryStartRow = 0;
  let summaryEndRow = 0;
  worksheet.eachRow((row, rowNumber) => {
    const label = String(row.getCell(1).value ?? "");
    if (label === "Total Semua Pekerjaan") summaryStartRow = rowNumber;
    if (label === "GRAND TOTAL") summaryEndRow = rowNumber;
  });

  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const firstCell = row.getCell(1).value;
    const isCategory = typeof firstCell === "string" && /^[A-Z]$/.test(firstCell);
    const isSummaryStart = rowNumber === summaryStartRow;
    let keepBlockHeight = rowHeight(rowNumber);
    if (isCategory) keepBlockHeight += rowHeight(rowNumber + 1);
    if (isSummaryStart && summaryEndRow >= summaryStartRow) {
      keepBlockHeight = 0;
      for (let summaryRow = summaryStartRow; summaryRow <= summaryEndRow; summaryRow += 1) {
        keepBlockHeight += rowHeight(summaryRow);
      }
    }

    if (usedHeight + keepBlockHeight > pageCapacity && rowNumber > headerRow) {
      worksheet.getRow(rowNumber - 1).addPageBreak();
      usedHeight = repeatHeaderHeight;
    }
    usedHeight += rowHeight(rowNumber);
  }
}

export async function createRabExcelFile(input: RabExcelExportInput, logoDataUrl: string) {
  const [XLSX, ExcelJS] = await Promise.all([
    import("xlsx-js-style"),
    import("exceljs"),
  ]);
  const styledWorkbook = createRabExcelWorkbook(input, XLSX);
  const stagedFile = XLSX.write(styledWorkbook, { type: "array", bookType: "xlsx" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(stagedFile);

  const worksheet = workbook.getWorksheet("RAB Penawaran");
  if (!worksheet) throw new Error("Worksheet RAB Penawaran tidak ditemukan.");
  let tableHeaderRow = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (row.getCell(1).value === "No" && row.getCell(2).value === "Uraian Pekerjaan") {
      tableHeaderRow = rowNumber;
    }
  });
  if (!tableHeaderRow) throw new Error("Header tabel RAB tidak ditemukan.");

  const logoId = workbook.addImage({ base64: logoDataUrl, extension: "png" });
  worksheet.addImage(logoId, {
    tl: { col: 0.2, row: 0.08 },
    ext: { width: 170, height: 86 },
  });
  worksheet.views = [{ showGridLines: false }];
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.45, header: 0.15, footer: 0.25 },
  };
  worksheet.pageSetup.printArea = `A1:F${worksheet.rowCount}`;
  worksheet.pageSetup.printTitlesRow = `${tableHeaderRow}:${tableHeaderRow}`;
  worksheet.headerFooter = {
    differentFirst: false,
    differentOddEven: false,
    oddHeader: "",
    oddFooter: "&CHalaman &P dari &N",
    evenHeader: "",
    evenFooter: "&CHalaman &P dari &N",
    firstHeader: "",
    firstFooter: "&CHalaman &P dari &N",
  };
  addPaginationBreaks(worksheet, tableHeaderRow);

  return workbook.xlsx.writeBuffer();
}
