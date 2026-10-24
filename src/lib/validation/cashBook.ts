import { z } from "zod";

export const CreateFastTransactionSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  description: z.string().min(1, "Keterangan transaksi wajib diisi"),
  category: z.string().min(1, "Kategori wajib dipilih untuk setiap transaksi"),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  type: z.enum(["DEBIT", "KREDIT"]).default("KREDIT"),
  project_id: z.string().optional().nullable(),
  cash_account_id: z.string().optional().nullable(),
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
  projectName?: string | null;
}
