import { z } from "zod";

export const AdvanceRecipientTypeSchema = z.enum(["EMPLOYEE", "MANDOR", "OWNER"]);
export type AdvanceRecipientType = z.infer<typeof AdvanceRecipientTypeSchema>;

export const SaveAdvanceRecipientSchema = z.object({
  id: z.string().optional(),
  type: AdvanceRecipientTypeSchema.default("EMPLOYEE"),
  profile_id: z.string().optional().nullable(),
  name: z.string().min(1, "Nama penerima kasbon wajib diisi"),
  phone: z.string().optional().nullable(),
  project_id: z.string().optional().nullable(),
  max_advance_amount: z.number().nonnegative("Plafon kasbon tidak boleh negatif").default(5000000),
  notes: z.string().optional().nullable(),
});
export type SaveAdvanceRecipientInput = z.infer<typeof SaveAdvanceRecipientSchema>;

export const CreateCashAdvanceSchema = z.object({
  id: z.string().optional(),
  number: z.string().optional(),
  date: z.string().min(1, "Tanggal pengajuan kasbon wajib diisi"),
  advance_type: z.enum(["EMPLOYEE", "MANDOR"]).optional().default("EMPLOYEE"),
  recipient_id: z.string().optional().nullable(),
  employee_id: z.string().optional().nullable(),
  mandor_name: z.string().optional().nullable(),
  wage_category: z.string().optional().default("Upah Tukang"),
  project_id: z.string().optional().nullable(),
  purpose: z.string().min(1, "Tujuan kasbon wajib diisi"),
  amount: z.number().positive("Nominal kasbon harus lebih besar dari 0"),
  notes: z.string().optional().nullable(),
  status: z.enum([
    "DRAFT",
    "SUBMITTED",
    "APPROVED",
    "DISBURSED",
    "PARTIALLY_SETTLED",
    "SETTLED",
    "REJECTED",
    "CANCELLED",
  ]).optional().default("DRAFT"),
});
export type CreateCashAdvanceInput = z.input<typeof CreateCashAdvanceSchema>;

export const SettleAdvanceSchema = z.object({
  cash_advance_id: z.string().uuid("ID kasbon tidak valid"),
  amount: z.number().positive("Nominal pelunasan harus lebih dari 0"),
  settlement_method: z.enum(["CASH", "INSTALLMENT", "PAYROLL_DEDUCTION", "EXPENSE"]),
  description: z.string().min(1, "Keterangan pelunasan wajib diisi"),
  date: z.string().optional(),
  expense_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type SettleAdvanceInput = z.infer<typeof SettleAdvanceSchema>;

export interface AdvanceRecapItem {
  id: string;
  name: string;
  type: "EMPLOYEE" | "MANDOR" | "OWNER";
  projectName?: string | null;
  maxAdvanceAmount: number;
  totalDisbursed: number;
  totalSettled: number;
  openBalance: number;
  remainingLimit: number;
  activeCount: number;
  statusLimit: "AMAN" | "MENDEKATI_LIMIT" | "MELEBIHI_LIMIT";
}
