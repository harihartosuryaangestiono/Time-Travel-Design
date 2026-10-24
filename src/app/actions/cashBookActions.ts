"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit/auditLogger";

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

/**
 * Mengambil transaksi Buku Kas Perusahaan dengan perhitungan saldo berjalan kumulatif
 */
export async function getCashBookTransactions(filter?: {
  month?: number;
  year?: number;
  category?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const currentYear = filter?.year || 2026;

  // Ambil saldo awal Kas BCA
  const { data: bcaAccount } = await supabase
    .from("cash_accounts")
    .select("id, opening_balance, name")
    .eq("organization_id", user.organizationId)
    .ilike("name", "%BCA%")
    .maybeSingle();

  const openingBal = parseFloat(bcaAccount?.opening_balance || "0") || 0;

  // Ambil seluruh pengeluaran kantor
  let expQuery = supabase
    .from("expenses")
    .select(`
      id, date, number, description, total_amount, category, needs_category, project_id
    `)
    .eq("organization_id", user.organizationId)
    .is("project_id", null) // Biaya overhead kantor
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: expenses } = await expQuery;

  // Susun baris kas book dengan saldo berjalan
  let runningBalance = openingBal;
  const entries: CashBookEntry[] = [];

  // Baris Saldo Awal jika di awal
  entries.push({
    id: "OPENING_BALANCE_2025",
    date: `${currentYear}-01-01`,
    description: "Kas Modal Awal 2025",
    debit: openingBal,
    kredit: 0,
    balance: runningBalance,
    category: "Modal Awal",
    needs_category: false,
  });

  (expenses || []).forEach((e: any) => {
    const amt = parseFloat(e.total_amount || "0") || 0;
    const isBunga = e.description?.toLowerCase().includes("bunga bank bca");

    let debit = 0;
    let kredit = 0;

    if (isBunga) {
      debit = amt;
      runningBalance += amt;
    } else {
      kredit = amt;
      runningBalance -= amt;
    }

    entries.push({
      id: e.id,
      date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
      number: e.number,
      description: e.description,
      debit,
      kredit,
      balance: runningBalance,
      category: e.category || "Perlu dikategorikan",
      needs_category: e.needs_category || !e.category,
      project_id: e.project_id,
      projectName: e.project?.name,
    });
  });

  // Terapkan filter bulan jika ada
  let filtered = entries;
  if (filter?.month) {
    filtered = entries.filter((ent) => {
      if (ent.id === "OPENING_BALANCE_2025") return true;
      const m = new Date(ent.date).getMonth() + 1;
      return m === filter.month;
    });
  }

  if (filter?.category && filter.category !== "ALL") {
    filtered = filtered.filter(
      (ent) => ent.id === "OPENING_BALANCE_2025" || ent.category === filter.category
    );
  }

  return {
    entries: filtered.reverse(), // Tampilkan transaksi terbaru di atas
    currentBalance: runningBalance,
    openingBalance: openingBal,
  };
}

/**
 * Autocomplete saran keterangan dari riwayat transaksi
 */
export async function getRecentDescriptions(): Promise<string[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("expenses")
    .select("description")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const set = new Set<string>();
  (data || []).forEach((d: any) => {
    if (d.description?.trim()) set.add(d.description.trim());
  });

  return Array.from(set).slice(0, 15);
}

/**
 * Simpan transaksi cepat ala Excel
 */
export async function createFastTransaction(rawInput: CreateFastTransactionInput) {
  const user = await requireAuthUser();
  const input = CreateFastTransactionSchema.parse(rawInput);
  const supabase = await createClient();

  // Validasi Kategori: WAJIB DIISI (Aturan Bisnis Bagian B)
  if (!input.category || input.category.trim() === "" || input.category === "Perlu dikategorikan") {
    throw new Error("Kategori pengeluaran wajib dipilih sesuai standar pembukuan TTD.");
  }

  // Cari akun kas BCA
  let cashAccountId = input.cash_account_id;
  if (!cashAccountId) {
    const { data: bca } = await supabase
      .from("cash_accounts")
      .select("id")
      .eq("organization_id", user.organizationId)
      .ilike("name", "%BCA%")
      .maybeSingle();
    cashAccountId = bca?.id || null;
  }

  const dateObj = new Date(input.date);
  const yearMonth = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  const randNum = String(Math.floor(1000 + Math.random() * 9000));
  const number = `EXP-${yearMonth}-${randNum}`;

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      organization_id: user.organizationId,
      number,
      date: dateObj.toISOString(),
      merchant: input.description.slice(0, 50),
      description: input.description,
      amount: input.amount,
      tax_amount: 0,
      total_amount: input.amount,
      cash_account_id: cashAccountId,
      project_id: input.project_id || null,
      category: input.category,
      status: "APPROVED",
      needs_category: false,
      source: "MANUAL",
      submitted_by: user.profileId || user.id,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "CREATE_FAST_EXPENSE",
    entityType: "EXPENSE",
    entityId: data.id,
    metadata: {
      number,
      amount: input.amount,
      category: input.category,
      project_id: input.project_id,
    },
  });

  revalidatePath("/cash-book");
  revalidatePath("/reports/rekapitulasi");
  revalidatePath("/cash-accounts");
  if (input.project_id) {
    revalidatePath(`/projects/${input.project_id}`);
  }

  return data;
}
