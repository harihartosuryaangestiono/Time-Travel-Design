import { z } from "zod";

export const CreateFastTransactionSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  description: z.string().min(1, "Keterangan transaksi wajib diisi"),
  category: z.string().min(1, "Kategori wajib dipilih untuk setiap transaksi"),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
  project_id: z.string().optional().nullable(),
  sales_person_id: z.string().optional().nullable(),
  subcontractor_contract_id: z.string().optional().nullable(),
  cash_account_id: z.string().min(1, "Rekening kas/bank wajib dipilih"),
  notes: z.string().optional().nullable(),
});

export type CreateFastTransactionInput = z.infer<typeof CreateFastTransactionSchema>;

export interface CashBookEntry {
  id: string;
  date: string;
  number?: string;
  description: string;
  debit: number;
  kredit: number;
  balance: number;
  category: string;
  needs_category: boolean;
  project_id?: string | null;
  sales_person_id?: string | null;
  sales_person_name?: string | null;
  projectName?: string | null;
  type: "INCOME" | "EXPENSE" | "OPENING";
  source_type:
    | "CASH_BOOK_EXPENSE"
    | "PROJECT_REVENUE"
    | "CASH_RECEIPT"
    | "INVOICE_PAYMENT"
    | "CASH_OPENING_BALANCE";
  can_edit: boolean;
}

export const UpdateCashBookTransactionSchema = z.object({
  id: z.string().min(1),
  source_type: z.enum(["CASH_BOOK_EXPENSE", "PROJECT_REVENUE", "CASH_RECEIPT"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal transaksi tidak valid."),
  description: z.string().trim().min(1, "Keterangan transaksi wajib diisi."),
  category: z.string().trim().min(1, "Kategori wajib dipilih."),
  amount: z.number().positive("Nominal harus lebih dari 0."),
  project_id: z.string().nullable().optional(),
});

export type UpdateCashBookTransactionInput = z.infer<
  typeof UpdateCashBookTransactionSchema
>;
