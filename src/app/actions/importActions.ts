"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";

export interface PreviewRow {
  rowNumber: number;
  date: string;
  description: string;
  category: string;
  type: "DEBIT" | "KREDIT";
  amount: number;
  projectName?: string;
  isValid: boolean;
  validationError?: string;
}

export interface ImportBatchSummary {
  id: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
}

export async function validateImportRows(rawRows: Array<{
  date?: string;
  description?: string;
  category?: string;
  debit?: number | string;
  kredit?: number | string;
  project?: string;
}>): Promise<{
  rows: PreviewRow[];
  totalValid: number;
  totalInvalid: number;
  totalDebit: number;
  totalKredit: number;
}> {
  let totalValid = 0;
  let totalInvalid = 0;
  let totalDebit = 0;
  let totalKredit = 0;

  const rows: PreviewRow[] = rawRows.map((r, idx) => {
    const rowNumber = idx + 1;
    const desc = (r.description || "").trim();
    const dateStr = (r.date || "").trim();
    const cat = (r.category || "").trim();
    const debit = typeof r.debit === "number" ? r.debit : parseFloat(String(r.debit || 0)) || 0;
    const kredit = typeof r.kredit === "number" ? r.kredit : parseFloat(String(r.kredit || 0)) || 0;

    let isValid = true;
    let validationError = "";

    if (!desc) {
      isValid = false;
      validationError = "Keterangan transaksi kosong.";
    } else if (debit <= 0 && kredit <= 0) {
      isValid = false;
      validationError = "Nominal debit/kredit harus lebih dari 0.";
    } else if (!dateStr) {
      isValid = false;
      validationError = "Tanggal transaksi kosong.";
    } else if (!cat) {
      isValid = false;
      validationError = "Kategori pengeluaran belum dipilih.";
    }

    const type = debit > 0 ? "DEBIT" : "KREDIT";
    const amount = debit > 0 ? debit : kredit;

    if (isValid) {
      totalValid++;
      if (debit > 0) totalDebit += debit;
      if (kredit > 0) totalKredit += kredit;
    } else {
      totalInvalid++;
    }

    return {
      rowNumber,
      date: dateStr || new Date().toISOString().split("T")[0],
      description: desc,
      category: cat || "Perlu dikategorikan",
      type,
      amount,
      projectName: r.project?.trim(),
      isValid,
      validationError: validationError || undefined,
    };
  });

  return {
    rows,
    totalValid,
    totalInvalid,
    totalDebit,
    totalKredit,
  };
}

export async function executeImportBatch(input: {
  fileName: string;
  rows: PreviewRow[];
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 1. Buat record batch
  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .insert({
      organization_id: user.organizationId,
      type: "EXCEL_TRANSACTIONS",
      file_name: input.fileName,
      total_rows: input.rows.length,
      success_rows: 0,
      error_rows: 0,
      status: "PROCESSING",
      created_by: user.profileId || user.id,
    })
    .select()
    .single();

  if (batchErr || !batch) {
    throw new Error(`Gagal membuat batch impor: ${batchErr?.message}`);
  }

  // Cari akun kas BCA
  const { data: bca } = await supabase
    .from("cash_accounts")
    .select("id")
    .eq("organization_id", user.organizationId)
    .ilike("name", "%BCA%")
    .maybeSingle();

  const cashAccountId = bca?.id || null;

  let successCount = 0;
  let errorCount = 0;
  const errorsToInsert: any[] = [];

  for (const row of input.rows) {
    if (!row.isValid) {
      errorCount++;
      errorsToInsert.push({
        batch_id: batch.id,
        row_number: row.rowNumber,
        error_message: row.validationError || "Baris tidak valid",
        raw_data: row,
      });
      continue;
    }

    try {
      const extRef = `UI_IMPORT_${batch.id}_${row.rowNumber}`;
      const randNum = String(Math.floor(1000 + Math.random() * 9000));
      const expNum = `EXP-IMP-${row.rowNumber}-${randNum}`;

      // Simpan pengeluaran
      await supabase.from("expenses").insert({
        organization_id: user.organizationId,
        number: expNum,
        date: new Date(row.date).toISOString(),
        merchant: row.description.slice(0, 50),
        description: row.description,
        amount: row.amount,
        tax_amount: 0,
        total_amount: row.amount,
        cash_account_id: cashAccountId,
        category: row.category,
        status: "APPROVED",
        needs_category: row.category === "Perlu dikategorikan",
        source: "IMPORT_EXCEL",
        external_ref: extRef,
        submitted_by: user.profileId || user.id,
      });

      successCount++;
    } catch (err: any) {
      errorCount++;
      errorsToInsert.push({
        batch_id: batch.id,
        row_number: row.rowNumber,
        error_message: err?.message || "Gagal menyimpan baris transaksi",
        raw_data: row,
      });
    }
  }

  // Simpan error rows jika ada
  if (errorsToInsert.length > 0) {
    await supabase.from("import_errors").insert(errorsToInsert);
  }

  // Update status batch
  await supabase
    .from("import_batches")
    .update({
      status: errorCount === 0 ? "COMPLETED" : "COMPLETED_WITH_ERRORS",
      success_rows: successCount,
      error_rows: errorCount,
    })
    .eq("id", batch.id);

  // Catat Audit Log
  await logAudit(user, {
    action: "EXECUTE_UI_IMPORT",
    entityType: "IMPORT_BATCH",
    entityId: batch.id,
    metadata: {
      fileName: input.fileName,
      successRows: successCount,
      errorRows: errorCount,
    },
  });

  revalidatePath("/settings/import");
  revalidatePath("/cash-book");
  revalidatePath("/reports/rekapitulasi");

  return {
    batchId: batch.id,
    successRows: successCount,
    errorRows: errorCount,
  };
}

export async function getImportBatches(): Promise<ImportBatchSummary[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("import_batches")
    .select("id, file_name, total_rows, success_rows, error_rows, status, created_at")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []).map((b: any) => ({
    id: b.id,
    file_name: b.file_name,
    total_rows: b.total_rows || 0,
    success_rows: b.success_rows || 0,
    error_rows: b.error_rows || 0,
    status: b.status || "COMPLETED",
    created_at: b.created_at ? new Date(b.created_at).toISOString().split("T")[0] : "",
  }));
}
