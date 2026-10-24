"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CashAdvanceStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit/auditLogger";

// ============================================
// SCHEMAS & TYPES
// ============================================

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
  id: string; // recipient_id or identifier
  name: string;
  type: "EMPLOYEE" | "MANDOR" | "OWNER";
  projectName?: string | null;
  maxAdvanceAmount: number; // PLAFON
  totalDisbursed: number;   // TOTAL KASBON DICAIRKAN
  totalSettled: number;     // SUDAH DIBAYAR / DIPERTANGGUNGJAWABKAN
  openBalance: number;      // SISA KASBON (totalDisbursed - totalSettled)
  remainingLimit: number;   // SISA PLAFON (maxAdvanceAmount - openBalance)
  activeCount: number;
  statusLimit: "AMAN" | "MENDEKATI_LIMIT" | "MELEBIHI_LIMIT";
}

// ============================================
// RECIPIENT ACTIONS
// ============================================

export async function getAdvanceRecipients() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: recipients, error } = await supabase
    .from("advance_recipients")
    .select(`
      *,
      project:projects!project_id(id, name, code)
    `)
    .eq("organization_id", user.organizationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching advance recipients:", error.message);
    return [];
  }

  return recipients || [];
}

export async function saveAdvanceRecipient(rawInput: SaveAdvanceRecipientInput) {
  const user = await requireAuthUser();
  const input = SaveAdvanceRecipientSchema.parse(rawInput);
  const supabase = await createClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("advance_recipients")
      .update({
        type: input.type,
        profile_id: input.profile_id || null,
        name: input.name,
        phone: input.phone || null,
        project_id: input.project_id || null,
        max_advance_amount: input.max_advance_amount,
        notes: input.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("organization_id", user.organizationId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit(user, {
      action: "UPDATE_ADVANCE_RECIPIENT",
      entityType: "ADVANCE_RECIPIENT",
      entityId: input.id,
      metadata: { name: input.name, max_advance_amount: input.max_advance_amount },
    });

    revalidatePath("/cash-advances");
    return data;
  } else {
    const { data, error } = await supabase
      .from("advance_recipients")
      .insert({
        organization_id: user.organizationId,
        type: input.type,
        profile_id: input.profile_id || null,
        name: input.name,
        phone: input.phone || null,
        project_id: input.project_id || null,
        max_advance_amount: input.max_advance_amount,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit(user, {
      action: "CREATE_ADVANCE_RECIPIENT",
      entityType: "ADVANCE_RECIPIENT",
      entityId: data.id,
      metadata: { name: input.name, max_advance_amount: input.max_advance_amount },
    });

    revalidatePath("/cash-advances");
    return data;
  }
}

// ============================================
// CASH ADVANCES ACTIONS
// ============================================

export async function getCashAdvances(filters?: {
  status?: CashAdvanceStatus;
  employee_id?: string;
  advance_type?: string;
  project_id?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  let query = supabase
    .from("cash_advances")
    .select(`
      *,
      employee:profiles!employee_id(id, full_name, email, max_advance_amount),
      recipient:advance_recipients!recipient_id(id, name, type, max_advance_amount),
      project:projects!project_id(id, name, code, labor_advance_limit)
    `)
    .eq("organization_id", user.organizationId)
    .order("date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.employee_id) {
    query = query.eq("employee_id", filters.employee_id);
  }

  if (filters?.advance_type) {
    query = query.eq("advance_type", filters.advance_type);
  }

  if (filters?.project_id) {
    query = query.eq("project_id", filters.project_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cash_advances")
    .select(`
      *,
      employee:profiles!employee_id(id, full_name, email, max_advance_amount),
      recipient:advance_recipients!recipient_id(*),
      project:projects!project_id(*),
      settlements:advance_settlements(*)
    `)
    .eq("id", id)
    .eq("organization_id", user.organizationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Validasi Plafon & Sisa Plafon:
 * - Karyawan/Owner: plafon per orang (max_advance_amount).
 * - Mandor Proyek: plafon kasbon per proyek (labor_advance_limit).
 */
export async function checkAdvanceLimit(input: {
  advance_type: "EMPLOYEE" | "MANDOR";
  employee_id?: string | null;
  recipient_id?: string | null;
  project_id?: string | null;
  proposed_amount: number;
  exclude_advance_id?: string;
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (input.advance_type === "EMPLOYEE") {
    const targetEmployeeId = input.employee_id || user.profileId || user.id;

    // Ambil data plafon karyawan
    let maxLimit = 5000000; // default 5 juta
    const { data: profile } = await supabase
      .from("profiles")
      .select("max_advance_amount, full_name")
      .eq("id", targetEmployeeId)
      .maybeSingle();

    if (profile?.max_advance_amount) {
      maxLimit = parseFloat(profile.max_advance_amount) || 5000000;
    }

    // Ambil semua kasbon berjalan karyawan tersebut
    let query = supabase
      .from("cash_advances")
      .select("id, amount, disbursed_amount, settled_amount, returned_amount, status")
      .eq("organization_id", user.organizationId)
      .eq("employee_id", targetEmployeeId)
      .in("status", ["DISBURSED", "PARTIALLY_SETTLED"]);

    if (input.exclude_advance_id) {
      query = query.neq("id", input.exclude_advance_id);
    }

    const { data: activeAdvances } = await query;

    const currentOpenBalance = (activeAdvances || []).reduce((sum, ca) => {
      const disb = parseFloat(ca.disbursed_amount || ca.amount || "0") || 0;
      const setl = parseFloat(ca.settled_amount || "0") || 0;
      const retn = parseFloat(ca.returned_amount || "0") || 0;
      return sum + Math.max(0, disb - setl - retn);
    }, 0);

    const remainingLimit = Math.max(0, maxLimit - currentOpenBalance);
    const isExceeded = input.proposed_amount > remainingLimit;

    return {
      type: "EMPLOYEE",
      recipientName: profile?.full_name || "Karyawan",
      maxLimit,
      currentOpenBalance,
      remainingLimit,
      isExceeded,
      message: isExceeded
        ? `Pengajuan Rp ${input.proposed_amount.toLocaleString("id-ID")} melebihi sisa plafon kasbon Anda (Sisa Plafon: Rp ${remainingLimit.toLocaleString("id-ID")} dari plafon Rp ${maxLimit.toLocaleString("id-ID")}). Harap lunasi kasbon berjalan terlebih dahulu.`
        : "Pengajuan masih dalam batas plafon yang diizinkan.",
    };
  } else {
    // Mandor Proyek
    if (!input.project_id) {
      return {
        type: "MANDOR",
        recipientName: "Mandor",
        maxLimit: 0,
        currentOpenBalance: 0,
        remainingLimit: 0,
        isExceeded: false,
        message: "Kasbon mandor tanpa batas proyek spesifik.",
      };
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name, labor_advance_limit")
      .eq("id", input.project_id)
      .maybeSingle();

    const laborLimit = parseFloat(project?.labor_advance_limit || "0") || 0;

    if (laborLimit <= 0) {
      return {
        type: "MANDOR",
        recipientName: project?.name || "Proyek",
        maxLimit: 0,
        currentOpenBalance: 0,
        remainingLimit: Infinity,
        isExceeded: false,
        message: "Proyek tidak memiliki batasan plafon upah tukang khusus.",
      };
    }

    // Hitung open balance kasbon mandor pada proyek ini
    let query = supabase
      .from("cash_advances")
      .select("id, amount, disbursed_amount, settled_amount, returned_amount, status")
      .eq("organization_id", user.organizationId)
      .eq("project_id", input.project_id)
      .eq("advance_type", "MANDOR")
      .in("status", ["DISBURSED", "PARTIALLY_SETTLED"]);

    if (input.exclude_advance_id) {
      query = query.neq("id", input.exclude_advance_id);
    }

    const { data: activeProjectAdvances } = await query;

    const currentProjectOpenBalance = (activeProjectAdvances || []).reduce((sum, ca) => {
      const disb = parseFloat(ca.disbursed_amount || ca.amount || "0") || 0;
      const setl = parseFloat(ca.settled_amount || "0") || 0;
      const retn = parseFloat(ca.returned_amount || "0") || 0;
      return sum + Math.max(0, disb - setl - retn);
    }, 0);

    const remainingLimit = Math.max(0, laborLimit - currentProjectOpenBalance);
    const isExceeded = input.proposed_amount > remainingLimit;

    return {
      type: "MANDOR",
      recipientName: project?.name || "Proyek",
      maxLimit: laborLimit,
      currentOpenBalance: currentProjectOpenBalance,
      remainingLimit,
      isExceeded,
      message: isExceeded
        ? `Pengajuan Rp ${input.proposed_amount.toLocaleString("id-ID")} melebihi sisa plafon kasbon Upah Tukang untuk proyek ${project?.name} (Sisa Plafon: Rp ${remainingLimit.toLocaleString("id-ID")} dari limit Rp ${laborLimit.toLocaleString("id-ID")}).`
        : "Pengajuan kasbon upah tukang proyek masih dalam batas plafon.",
    };
  }
}

/**
 * Menyimpan atau memperbarui data kasbon dengan pengecekan plafon dan audit logs
 */
export async function saveCashAdvanceRecord(rawInput: CreateCashAdvanceInput) {
  const user = await requireAuthUser();
  const input = CreateCashAdvanceSchema.parse(rawInput);
  const supabase = await createClient();

  // 1. Cek Batasan Plafon
  const limitCheck = await checkAdvanceLimit({
    advance_type: input.advance_type,
    employee_id: input.employee_id,
    recipient_id: input.recipient_id,
    project_id: input.project_id,
    proposed_amount: input.amount,
    exclude_advance_id: input.id,
  });

  if (limitCheck.isExceeded) {
    throw new Error(limitCheck.message);
  }

  if (input.id) {
    // UPDATE
    const { data: existing } = await supabase
      .from("cash_advances")
      .select("status, organization_id, created_by, employee_id")
      .eq("id", input.id)
      .single();

    if (!existing || existing.organization_id !== user.organizationId) {
      throw new Error("Data kasbon tidak ditemukan.");
    }

    const { data, error } = await supabase
      .from("cash_advances")
      .update({
        date: input.date,
        advance_type: input.advance_type,
        recipient_id: input.recipient_id || null,
        employee_id: input.employee_id || existing.employee_id,
        mandor_name: input.mandor_name || null,
        wage_category: input.advance_type === "MANDOR" ? "Upah Tukang" : input.wage_category,
        project_id: input.project_id || null,
        purpose: input.purpose,
        amount: input.amount,
        disbursed_amount:
          input.status === "DISBURSED" ||
          input.status === "PARTIALLY_SETTLED" ||
          input.status === "SETTLED"
            ? input.amount
            : 0,
        status: input.status,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit(user, {
      action: "UPDATE_CASH_ADVANCE",
      entityType: "CASH_ADVANCE",
      entityId: input.id,
      metadata: {
        number: input.number,
        amount: input.amount,
        status: input.status,
        advance_type: input.advance_type,
      },
    });

    revalidatePath("/cash-advances");
    return data;
  } else {
    // CREATE NEW
    const targetDate = new Date(input.date || Date.now());
    const yearMonth = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const randNum = String(Math.floor(Math.random() * 9000) + 1000);
    const number = input.number || `CA-${yearMonth}-${randNum}`;

    const effectiveEmployeeId = input.employee_id || user.profileId || user.id;

    const { data, error } = await supabase
      .from("cash_advances")
      .insert({
        organization_id: user.organizationId,
        number,
        date: input.date,
        advance_type: input.advance_type,
        recipient_id: input.recipient_id || null,
        employee_id: effectiveEmployeeId,
        mandor_name: input.mandor_name || null,
        wage_category: input.advance_type === "MANDOR" ? "Upah Tukang" : input.wage_category,
        project_id: input.project_id || null,
        purpose: input.purpose,
        amount: input.amount,
        disbursed_amount:
          input.status === "DISBURSED" ||
          input.status === "PARTIALLY_SETTLED" ||
          input.status === "SETTLED"
            ? input.amount
            : 0,
        settled_amount: 0,
        returned_amount: 0,
        status: input.status,
        notes: input.notes,
        created_by: user.profileId || user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit(user, {
      action: "CREATE_CASH_ADVANCE",
      entityType: "CASH_ADVANCE",
      entityId: data.id,
      metadata: {
        number,
        amount: input.amount,
        advance_type: input.advance_type,
        mandor_name: input.mandor_name,
      },
    });

    revalidatePath("/cash-advances");
    return data;
  }
}

/**
 * Approve Kasbon:
 * Kebutuhan Bisnis:
 * - Larang approve pengajuan sendiri (employee_id === user.profileId ATAU created_by === user.profileId)
 * - Tulis audit_logs
 */
export async function approveCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!["OWNER", "FINANCE", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Anda tidak memiliki kewenangan untuk menyetujui pengajuan kasbon.");
  }

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("id, number, status, organization_id, employee_id, created_by, amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  if (existing.status !== "SUBMITTED" && existing.status !== "DRAFT") {
    throw new Error("Kasbon harus berstatus Draft atau Diajukan sebelum disetujui.");
  }

  // ATURAN: Larang approve pengajuan sendiri
  const actorProfileId = user.profileId || user.id;
  if (
    existing.employee_id === actorProfileId ||
    existing.created_by === actorProfileId ||
    existing.created_by === user.id
  ) {
    throw new Error("Anda tidak dapat menyetujui pengajuan kasbon yang Anda ajukan sendiri.");
  }

  const { error } = await supabase
    .from("cash_advances")
    .update({
      status: "APPROVED",
      approved_by: actorProfileId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "APPROVE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: id,
    metadata: { number: existing.number, amount: existing.amount },
  });

  revalidatePath("/cash-advances");
  return { success: true };
}

/**
 * Pencairan Kasbon:
 * - Memeriksa akun kas
 * - Mengupdate disbursed_amount
 * - Tulis audit_logs
 */
export async function disburseCashAdvance(id: string, cash_account_id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  if (!["OWNER", "FINANCE"].includes(user.role)) {
    throw new Error("Hanya Bagian Keuangan atau Owner yang dapat mencairkan kasbon.");
  }

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("id, number, status, organization_id, amount")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  if (existing.status !== "APPROVED") {
    throw new Error("Kasbon harus disetujui terlebih dahulu sebelum dicairkan.");
  }

  // Validasi akun kas aktif
  const { data: account } = await supabase
    .from("cash_accounts")
    .select("id, name")
    .eq("id", cash_account_id)
    .eq("organization_id", user.organizationId)
    .eq("is_active", true)
    .single();

  if (!account) {
    throw new Error("Rekening kas tidak valid atau tidak aktif.");
  }

  const actorProfileId = user.profileId || user.id;

  const { error } = await supabase
    .from("cash_advances")
    .update({
      status: "DISBURSED",
      disbursed_amount: existing.amount,
      cash_account_id,
      disbursed_by: actorProfileId,
      disbursed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "DISBURSE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: id,
    metadata: {
      number: existing.number,
      amount: existing.amount,
      cash_account_id,
      account_name: account.name,
    },
  });

  revalidatePath("/cash-advances");
  revalidatePath("/cash-accounts");
  return { success: true };
}

/**
 * Pelunasan Kasbon (Settlement):
 * Kebutuhan Bisnis:
 * - Metode pelunasan: Tunai (CASH), Cicilan (INSTALLMENT), Potong Gaji (PAYROLL_DEDUCTION), Bukti Nota (EXPENSE)
 * - Otomatis transisi: DISBURSED -> PARTIALLY_SETTLED -> SETTLED
 * - Tulis audit_logs
 */
export async function settleCashAdvanceRecord(rawInput: SettleAdvanceInput) {
  const user = await requireAuthUser();
  const input = SettleAdvanceSchema.parse(rawInput);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("id, number, status, organization_id, amount, disbursed_amount, settled_amount, returned_amount")
    .eq("id", input.cash_advance_id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  if (existing.status !== "DISBURSED" && existing.status !== "PARTIALLY_SETTLED") {
    throw new Error("Hanya kasbon yang sudah dicairkan atau belum lunas yang dapat diproses pelunasannya.");
  }

  const disbursed = parseFloat(existing.disbursed_amount || existing.amount || "0") || 0;
  const currentSettled = parseFloat(existing.settled_amount || "0") || 0;
  const currentReturned = parseFloat(existing.returned_amount || "0") || 0;
  const currentOpenBalance = Math.max(0, disbursed - currentSettled - currentReturned);

  if (input.amount > currentOpenBalance) {
    throw new Error(
      `Nominal pelunasan (Rp ${input.amount.toLocaleString("id-ID")}) melebihi sisa kasbon yang belum lunas (Rp ${currentOpenBalance.toLocaleString("id-ID")}).`
    );
  }

  const actorProfileId = user.profileId || user.id;
  const isReturnCash = input.settlement_method === "CASH";

  // 1. Simpan baris pelunasan ke advance_settlements
  const { data: settlementRecord, error: settleErr } = await supabase
    .from("advance_settlements")
    .insert({
      cash_advance_id: input.cash_advance_id,
      date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
      description: input.description,
      amount: input.amount,
      type: isReturnCash ? "RETURN" : "EXPENSE",
      settlement_method: input.settlement_method,
      expense_id: input.expense_id || null,
      notes: input.notes || null,
      created_by: actorProfileId,
    })
    .select()
    .single();

  if (settleErr) {
    throw new Error(settleErr.message);
  }

  // 2. Hitung akumulasi baru
  const newSettledAmount = isReturnCash ? currentSettled : currentSettled + input.amount;
  const newReturnedAmount = isReturnCash ? currentReturned + input.amount : currentReturned;
  const totalAccounted = newSettledAmount + newReturnedAmount;

  let newStatus: CashAdvanceStatus = "PARTIALLY_SETTLED";
  if (totalAccounted >= disbursed) {
    newStatus = "SETTLED";
  }

  // 3. Update status dan nominal di cash_advances
  const { error: updateErr } = await supabase
    .from("cash_advances")
    .update({
      status: newStatus,
      settled_amount: newSettledAmount,
      returned_amount: newReturnedAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.cash_advance_id);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  // 4. Catat Audit Log
  await logAudit(user, {
    action: "SETTLE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: input.cash_advance_id,
    metadata: {
      number: existing.number,
      settlement_amount: input.amount,
      method: input.settlement_method,
      new_status: newStatus,
      remaining_open: Math.max(0, disbursed - totalAccounted),
    },
  });

  revalidatePath("/cash-advances");
  return {
    success: true,
    settlement: settlementRecord,
    newStatus,
  };
}

export async function deleteCashAdvance(id: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("cash_advances")
    .select("number, organization_id")
    .eq("id", id)
    .single();

  if (!existing || existing.organization_id !== user.organizationId) {
    throw new Error("Data kasbon tidak ditemukan.");
  }

  const { error } = await supabase
    .from("cash_advances")
    .delete()
    .eq("id", id)
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit(user, {
    action: "DELETE_CASH_ADVANCE",
    entityType: "CASH_ADVANCE",
    entityId: id,
    metadata: { number: existing.number },
  });

  revalidatePath("/cash-advances");
  return { success: true };
}

/**
 * REKAPITULASI KASBON SEMUA ORANG (Karyawan & Mandor):
 * Kebutuhan Bisnis:
 * - Menampilkan Plafon, Total Kasbon Dicairkan, Total Diselesaikan, Open Balance, Sisa Plafon
 * - Menghitung status batas plafon (Aman / Mendekati Limit / Melebihi)
 * - Digunakan untuk tampilan tabel rekap & export Excel
 */
export async function getCashAdvanceRecap(): Promise<AdvanceRecapItem[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 1. Ambil semua kasbon yang relevan
  const { data: advanceRows, error } = await supabase
    .from("cash_advances")
    .select("id, number, advance_type, recipient_id, employee_id, mandor_name, project_id, amount, disbursed_amount, settled_amount, returned_amount, status")
    .eq("organization_id", user.organizationId);

  if (error) {
    throw new Error(`Gagal memuat kasbon untuk rekapitulasi: ${error.message}`);
  }

  // 2. Ambil master recipients dan profiles untuk memastikan semua orang terdaftar muncul
  const { data: recipientRows, error: recipientsError } = await supabase
    .from("advance_recipients")
    .select("id, name, type, max_advance_amount, project_id")
    .eq("organization_id", user.organizationId)
    .eq("is_active", true);
  if (recipientsError) {
    throw new Error(`Gagal memuat penerima kasbon: ${recipientsError.message}`);
  }

  const employeeIds = Array.from(
    new Set((advanceRows || []).map((advance) => advance.employee_id).filter(Boolean))
  ) as string[];
  const projectIds = Array.from(
    new Set([
      ...(advanceRows || []).map((advance) => advance.project_id),
      ...(recipientRows || []).map((recipient) => recipient.project_id),
    ].filter(Boolean))
  ) as string[];
  const [{ data: employees, error: employeesError }, { data: projects, error: projectsError }] =
    await Promise.all([
      employeeIds.length
        ? supabase
            .from("profiles")
            .select("id, full_name, email, max_advance_amount")
            .in("id", employeeIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? supabase
            .from("projects")
            .select("id, name, code, labor_advance_limit")
            .eq("organization_id", user.organizationId)
            .in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (employeesError) throw new Error(employeesError.message);
  if (projectsError) throw new Error(projectsError.message);

  const employeesById = new Map((employees || []).map((employee) => [employee.id, employee]));
  const projectsById = new Map((projects || []).map((project) => [project.id, project]));
  const registeredRecipients = (recipientRows || []).map((recipient) => ({
    ...recipient,
    project: recipient.project_id ? projectsById.get(recipient.project_id) : null,
  }));
  const advances = (advanceRows || []).map((advance) => ({
    ...advance,
    employee: advance.employee_id ? employeesById.get(advance.employee_id) : null,
    project: advance.project_id ? projectsById.get(advance.project_id) : null,
  }));

  const recapMap = new Map<string, AdvanceRecapItem>();

  // Inisialisasi dari master recipients
  (registeredRecipients || []).forEach((r: any) => {
    recapMap.set(r.id, {
      id: r.id,
      name: r.name,
      type: (r.type as any) || "EMPLOYEE",
      projectName: r.project?.name || null,
      maxAdvanceAmount: parseFloat(r.max_advance_amount || "5000000") || 5000000,
      totalDisbursed: 0,
      totalSettled: 0,
      openBalance: 0,
      remainingLimit: parseFloat(r.max_advance_amount || "5000000") || 5000000,
      activeCount: 0,
      statusLimit: "AMAN",
    });
  });

  // Agregasi dari transaksi kasbon
  advances.forEach((ca: any) => {
    const isMandor = ca.advance_type === "MANDOR";
    const key = ca.recipient_id || ca.employee_id || ca.mandor_name || "Lainnya";

    const disb = parseFloat(ca.disbursed_amount || ca.amount || "0") || 0;
    const setl = (parseFloat(ca.settled_amount || "0") || 0) + (parseFloat(ca.returned_amount || "0") || 0);
    const open = Math.max(0, disb - setl);
    const isActive = ca.status === "DISBURSED" || ca.status === "PARTIALLY_SETTLED";

    if (!recapMap.has(key)) {
      const displayName = isMandor
        ? ca.mandor_name || `Mandor (${ca.project?.name || "Proyek"})`
        : ca.employee?.full_name || ca.employee?.email || "Karyawan";

      const maxLimit = isMandor
        ? parseFloat(ca.project?.labor_advance_limit || "0") || 0
        : parseFloat(ca.employee?.max_advance_amount || "5000000") || 5000000;

      recapMap.set(key, {
        id: key,
        name: displayName,
        type: isMandor ? "MANDOR" : "EMPLOYEE",
        projectName: ca.project?.name || null,
        maxAdvanceAmount: maxLimit,
        totalDisbursed: 0,
        totalSettled: 0,
        openBalance: 0,
        remainingLimit: maxLimit,
        activeCount: 0,
        statusLimit: "AMAN",
      });
    }

    const item = recapMap.get(key)!;
    item.totalDisbursed += disb;
    item.totalSettled += setl;
    item.openBalance += open;
    if (isActive) item.activeCount += 1;
  });

  // Finalisasi Sisa Plafon & Status Limit
  const recapList = Array.from(recapMap.values()).map((item) => {
    const remaining = Math.max(0, item.maxAdvanceAmount - item.openBalance);
    item.remainingLimit = remaining;

    if (item.maxAdvanceAmount > 0) {
      const usagePercent = (item.openBalance / item.maxAdvanceAmount) * 100;
      if (usagePercent > 100) {
        item.statusLimit = "MELEBIHI_LIMIT";
      } else if (usagePercent >= 80) {
        item.statusLimit = "MENDEKATI_LIMIT";
      } else {
        item.statusLimit = "AMAN";
      }
    } else {
      item.statusLimit = "AMAN";
    }

    return item;
  });

  // Urutkan berdasarkan open balance terbesar
  return recapList.sort((a, b) => b.openBalance - a.openBalance);
}
