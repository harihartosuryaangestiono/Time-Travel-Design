export const PROJECT_EXPENSE_CATEGORIES = [
  "Document Printing",
  "Project Material Procurement",
  "Worker Salary",
  "Rent & Utilities",
  "Project Transportation",
  "Subcontractor - Glass & Aluminium",
  "Subcontractor - Iron & Steel",
  "Subcontractor - Wood Door & Window",
  "Subcontractor - MEP",
  "Subcontractor - Interior",
  "Construction Waste",
] as const;

export const GENERAL_EXPENSE_CATEGORIES = [
  "Staff Salary",
  "Operational Transportation",
  "Office Consumption & Refreshment",
  "Hospitality & Representation",
  "Marketing & Sales",
  "Office Rent & Utilities",
  "Bank Administration Fee",
  "Office Renovation",
  "Company Legal",
  "Inventory",
] as const;

export type ExpenseBook = "PROJECT" | "GENERAL";

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "bahan baku utama / material": "Project Material Procurement",
  "upah tukang": "Worker Salary",
  "sewa alat proyek": "Rent & Utilities",
  "transportasi lapangan": "Project Transportation",
  "gaji dan upah karyawan": "Staff Salary",
  "transportasi operasional": "Operational Transportation",
  "biaya konsumsi kantor": "Office Consumption & Refreshment",
  "biaya jamuan / representasi": "Hospitality & Representation",
  "biaya marketing": "Marketing & Sales",
  "biaya administrasi finansial": "Bank Administration Fee",
  "renovasi kantor": "Office Renovation",
  "legalitas perusahaan": "Company Legal",
  inventaris: "Inventory",
  "perangkat gadget": "Inventory",
};

export function getExpenseBookCategories(book: ExpenseBook) {
  return book === "PROJECT"
    ? PROJECT_EXPENSE_CATEGORIES
    : GENERAL_EXPENSE_CATEGORIES;
}

export function normalizeExpenseCategory(
  category: string | null | undefined,
  book: ExpenseBook
): string | null {
  const value = category?.trim();
  if (!value) return null;
  const categories: readonly string[] = getExpenseBookCategories(book);
  if (categories.includes(value)) return value;

  const legacyCategory = LEGACY_CATEGORY_MAP[value.toLowerCase()];
  return legacyCategory && categories.includes(legacyCategory) ? legacyCategory : null;
}

export function validateExpenseBookCategory(
  category: string | null | undefined,
  book: ExpenseBook
): string | null {
  const value = category?.trim();
  if (!value) {
    return "Kategori pengeluaran wajib dipilih.";
  }
  const categories: readonly string[] = getExpenseBookCategories(book);
  if (!categories.includes(value)) {
    return book === "PROJECT"
      ? "Pilih kategori yang tersedia untuk Buku Kecil (pengeluaran proyek)."
      : "Pilih kategori yang tersedia untuk Buku Besar (pengeluaran umum).";
  }
  return null;
}
