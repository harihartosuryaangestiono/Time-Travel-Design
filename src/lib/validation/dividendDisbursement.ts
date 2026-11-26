import { z } from "zod";

export const CreateDividendDisbursementSchema = z.object({
  cash_account_id: z.string().min(1, "Pilih rekening perusahaan."),
  recipient_name: z.string().trim().min(1, "Nama pemegang saham wajib diisi."),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal pencairan tidak valid.")
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, "Tanggal pencairan tidak valid."),
  amount: z.number().finite().positive("Nominal dividen harus lebih besar dari 0."),
  reference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type CreateDividendDisbursementInput = z.infer<
  typeof CreateDividendDisbursementSchema
>;
