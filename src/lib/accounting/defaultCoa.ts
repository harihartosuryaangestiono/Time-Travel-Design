import { AccountType, NormalBalance } from "@prisma/client";

export interface DefaultAccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  is_system: boolean;
  category_group?: "HPP" | "OPEX" | "CAPEX" | "REVENUE" | "BALANCE_SHEET";
}

/**
 * Single source of truth for the Chart of Accounts (COA)
 * Maps directly to the Excel Laporan_Keuangan_2026 categories:
 * - 4 HPP Categories (Biaya Proyek)
 * - 7 OPEX Categories (Biaya Kantor)
 * - 4 CAPEX Categories (Aset & Investasi)
 * - Balance Sheet & Revenue Accounts
 */
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountDefinition[] = [
  // 1000 - ASSETS
  { code: "1100", name: "Kas", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "1110", name: "Kas/Bank BCA", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "1120", name: "Kas/Bank Mandiri", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "BALANCE_SHEET" },
  { code: "1200", name: "Piutang Usaha", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "1300", name: "Piutang Karyawan (Kasbon)", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "1400", name: "Persediaan Material & Sampel", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "BALANCE_SHEET" },

  // 1500 - CAPEX / FIXED ASSETS
  { code: "1510", name: "Renovasi Kantor", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "CAPEX" },
  { code: "1520", name: "Legalitas Perusahaan", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "CAPEX" },
  { code: "1530", name: "Inventaris", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "CAPEX" },
  { code: "1540", name: "Perangkat Gadget", type: AccountType.ASSET, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "CAPEX" },
  { code: "1600", name: "Akumulasi Penyusutan Aset Tetap", type: AccountType.ASSET, normal_balance: NormalBalance.CREDIT, is_system: true, category_group: "BALANCE_SHEET" },

  // 2000 - LIABILITIES
  { code: "2100", name: "Hutang Usaha", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "2200", name: "Hutang Pajak / PPN", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "2300", name: "Hutang Gaji", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: false, category_group: "BALANCE_SHEET" },
  { code: "2400", name: "Uang Muka Pelanggan / Termin Proyek", type: AccountType.LIABILITY, normal_balance: NormalBalance.CREDIT, is_system: false, category_group: "BALANCE_SHEET" },

  // 3000 - EQUITY
  { code: "3100", name: "Modal Disetor / Modal Saham", type: AccountType.EQUITY, normal_balance: NormalBalance.CREDIT, is_system: true, category_group: "BALANCE_SHEET" },
  { code: "3200", name: "Laba Ditahan", type: AccountType.EQUITY, normal_balance: NormalBalance.CREDIT, is_system: false, category_group: "BALANCE_SHEET" },
  { code: "3300", name: "Laba / Rugi Tahun Berjalan", type: AccountType.EQUITY, normal_balance: NormalBalance.CREDIT, is_system: true, category_group: "BALANCE_SHEET" },

  // 4000 - REVENUE
  { code: "4100", name: "Pendapatan Proyek (Termin Klien)", type: AccountType.REVENUE, normal_balance: NormalBalance.CREDIT, is_system: true, category_group: "REVENUE" },
  { code: "4200", name: "Pendapatan Jasa Desain & Konsultasi", type: AccountType.REVENUE, normal_balance: NormalBalance.CREDIT, is_system: false, category_group: "REVENUE" },
  { code: "4300", name: "Pendapatan Lain-lain", type: AccountType.OTHER_INCOME, normal_balance: NormalBalance.CREDIT, is_system: false, category_group: "REVENUE" },
  { code: "4400", name: "Pendapatan Bunga Bank", type: AccountType.OTHER_INCOME, normal_balance: NormalBalance.CREDIT, is_system: false, category_group: "REVENUE" },

  // 5000 - COST OF SALES / HPP (BIAYA PROYEK - 4 KATEGORI EXCEL)
  { code: "5100", name: "Bahan Baku Utama / Material", type: AccountType.COST_OF_SALES, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "HPP" },
  { code: "5200", name: "Upah Tukang", type: AccountType.COST_OF_SALES, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "HPP" },
  { code: "5300", name: "Sewa Alat Proyek", type: AccountType.COST_OF_SALES, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "HPP" },
  { code: "5400", name: "Transportasi Lapangan", type: AccountType.COST_OF_SALES, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "HPP" },

  // 6000 - OPEX (BIAYA KANTOR - 7 KATEGORI EXCEL)
  { code: "6100", name: "Gaji dan Upah Karyawan", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6200", name: "Transportasi Operasional", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6300", name: "Biaya Konsumsi Kantor", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6400", name: "Biaya Jamuan / Representasi", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6500", name: "Biaya Marketing", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6600", name: "Kebutuhan Workshop", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6700", name: "Biaya Administrasi Finansial", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
  { code: "6800", name: "Beban Operasional Lainnya", type: AccountType.EXPENSE, normal_balance: NormalBalance.DEBIT, is_system: false, category_group: "OPEX" },
];

/** Maps expense categories to the closest existing general-ledger account. */
export const EXCEL_CATEGORY_TO_ACCOUNT_CODE: Record<string, string> = {
  // Buku Kecil
  "Document Printing": "5100",
  "Project Material Procurement": "5100",
  "Worker Salary": "5200",
  "Rent & Utilities": "5300",
  "Project Transportation": "5400",
  "Subcontractor - Glass & Aluminium": "5100",
  "Subcontractor - Iron & Steel": "5100",
  "Subcontractor - Wood Door & Window": "5100",
  "Subcontractor - MEP": "5200",
  "Subcontractor - Interior": "5100",
  "Construction Waste": "5400",

  // Buku Besar
  "Staff Salary": "6100",
  "Operational Transportation": "6200",
  "Office Consumption & Refreshment": "6300",
  "Hospitality & Representation": "6400",
  "Marketing & Sales": "6500",
  "Office Rent & Utilities": "6800",
  "Bank Administration Fee": "6700",
  "Office Renovation": "1510",
  "Company Legal": "1520",
  Inventory: "1530",

  // Legacy category compatibility
  // HPP
  "Bahan Baku Utama / Material": "5100",
  "Upah Tukang": "5200",
  "Sewa Alat Proyek": "5300",
  "Transportasi Lapangan": "5400",

  // OPEX
  "Gaji dan Upah Karyawan": "6100",
  "Transportasi Operasional": "6200",
  "Biaya Konsumsi Kantor": "6300",
  "Biaya Jamuan / Representasi": "6400",
  "Biaya Marketing": "6500",
  "Kebutuhan Workshop": "6600",
  "Biaya Administrasi Finansial": "6700",

  // CAPEX
  "Renovasi Kantor": "1510",
  "Legalitas Perusahaan": "1520",
  "Inventaris": "1530",
  "Perangkat Gadget": "1540",
};
