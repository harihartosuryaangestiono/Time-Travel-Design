"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";
import { ParsedRow } from "@/lib/import/excelParser";
import { normalizeExpenseCategory, type ExpenseBook } from "@/lib/accounting/expenseCategories";

export interface ImportBatchSummary {
  id: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export async function startImportBatch(input: {
  fileName: string;
  totalRows: number;
}) {
  if (!Number.isInteger(input.totalRows) || input.totalRows < 1) {
    throw new Error("Jumlah baris impor tidak valid.");
  }

  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .insert({
      organization_id: user.organizationId,
      type: "EXCEL_TRANSACTIONS",
      file_name: input.fileName,
      total_rows: input.totalRows,
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

  return { batchId: batch.id };
}

export async function executeImportBatchRows(input: {
  batchId: string;
  rows: ParsedRow[];
}) {
  if (input.rows.length < 1 || input.rows.length > 10) {
    throw new Error("Setiap permintaan impor harus berisi 1 sampai 10 baris.");
  }

  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .select("id, success_rows, error_rows, status")
    .eq("id", input.batchId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (batchErr || !batch) {
    throw new Error(`Gagal memuat batch impor: ${batchErr?.message || "Batch tidak ditemukan."}`);
  }
  if (batch.status !== "PROCESSING") {
    throw new Error("Batch impor ini sudah tidak dalam status pemrosesan.");
  }

  const { data: bca, error: cashAccountErr } = await supabase
    .from("cash_accounts")
    .select("id")
    .eq("organization_id", user.organizationId)
    .ilike("name", "%BCA%")
    .maybeSingle();

  if (cashAccountErr) {
    throw new Error(`Gagal memuat akun kas: ${cashAccountErr.message}`);
  }

  const cashAccountId = bca?.id || null;

  const { data: existingProjects, error: projectsErr } = await supabase
    .from("projects")
    .select("id, name, code")
    .eq("organization_id", user.organizationId);

  if (projectsErr) {
    throw new Error(`Gagal memuat daftar proyek: ${projectsErr.message}`);
  }

  const projectMap = new Map<string, string>();
  (existingProjects || []).forEach((p) => {
    projectMap.set(p.name.toLowerCase().trim(), p.id);
    if (p.code) projectMap.set(p.code.toLowerCase().trim(), p.id);
  });

  let successCount = 0;
  let errorCount = 0;
  const errorsToInsert: {
    batch_id: string;
    row_number: number;
    error_message: string;
    raw_data: ParsedRow;
  }[] = [];

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

    // Aturan: jenis SETORAN_PROYEK dilewati (tidak disimpan)
    if (row.isSkipped || row.jenis === "SETORAN_PROYEK") {
      successCount++;
      continue;
    }

    try {
      const extRef = row.externalRef;

      let resolvedProjectId: string | null = null;
      if (row.buku === "PROYEK") {
        const cleanProjName = row.sheetAsal.trim();
        const lowerProj = cleanProjName.toLowerCase();

        if (projectMap.has(lowerProj)) {
          resolvedProjectId = projectMap.get(lowerProj)!;
        } else {
          const clientName = cleanProjName.includes(" - ") ? cleanProjName.split(" - ")[1].trim() : cleanProjName;
          const { data: newClient, error: clientErr } = await supabase
            .from("clients")
            .insert({
              organization_id: user.organizationId,
              name: clientName,
            })
            .select("id")
            .single();

          if (clientErr || !newClient) {
            throw new Error(`Gagal membuat klien: ${clientErr?.message || "Data klien tidak tersedia."}`);
          }

          const code = cleanProjName.includes(" - ") ? cleanProjName.split(" - ")[0].trim() : cleanProjName.slice(0, 8).toUpperCase();

          const { data: newProject, error: projectErr } = await supabase
            .from("projects")
            .insert({
              organization_id: user.organizationId,
              name: cleanProjName,
              code,
              client_id: newClient.id,
              type: "ARCHITECTURE",
              status: "ACTIVE",
            })
            .select("id")
            .single();

          if (projectErr || !newProject) {
            throw new Error(`Gagal membuat proyek: ${projectErr?.message || "Data proyek tidak tersedia."}`);
          }

          resolvedProjectId = newProject.id;
          projectMap.set(lowerProj, newProject.id);
        }
      }

      if (row.jenis === "TERMIN_KLIEN") {
        const { data: existingRevenue, error: revenueLookupErr } = await supabase
          .from("project_revenues")
          .select("id")
          .eq("external_ref", extRef)
          .maybeSingle();

        if (revenueLookupErr) throw revenueLookupErr;

        if (!existingRevenue) {
          if (!resolvedProjectId) {
            throw new Error(`Proyek untuk termin klien '${row.sheetAsal}' tidak ditemukan.`);
          }

          const { error: revenueInsertErr } = await supabase.from("project_revenues").insert({
            organization_id: user.organizationId,
            project_id: resolvedProjectId,
            cash_account_id: cashAccountId,
            date: new Date(row.date).toISOString(),
            amount: row.debit,
            description: row.description,
            source: "IMPORT_EXCEL",
            external_ref: extRef,
          });
          if (revenueInsertErr) throw revenueInsertErr;
        }
      } else if (row.jenis === "MODAL_AWAL") {
        if (cashAccountId) {
          const { error: openingBalanceErr } = await supabase
            .from("cash_accounts")
            .update({
              opening_balance: row.debit,
              opening_date: new Date(row.date).toISOString(),
            })
            .eq("id", cashAccountId);
          if (openingBalanceErr) throw openingBalanceErr;
        }
      } else {
        const isProjectExpense = row.jenis === "PENGELUARAN_PROYEK";
        const isGeneralExpense = row.jenis === "PENGELUARAN_KANTOR" || row.jenis === "BUNGA_BANK";
        if (isProjectExpense && row.buku !== "PROYEK") {
          throw new Error("Pengeluaran proyek harus menggunakan Buku Kecil dan mencantumkan proyek.");
        }
        if (isGeneralExpense && row.buku === "PROYEK") {
          throw new Error("Pengeluaran umum harus menggunakan Buku Besar tanpa proyek.");
        }
        if ((isProjectExpense || isGeneralExpense) && row.needsCategory) {
          throw new Error("Kategori wajib diisi sebelum pengeluaran diimpor.");
        }

        const { data: existingExpense, error: expenseLookupErr } = await supabase
          .from("expenses")
          .select("id")
          .eq("external_ref", extRef)
          .maybeSingle();

        if (expenseLookupErr) throw expenseLookupErr;

        if (!existingExpense) {
          const randNum = String(Math.floor(1000 + Math.random() * 9000));
          const expNum = `EXP-IMP-${row.barisExcel}-${randNum}`;
          const expenseBook: ExpenseBook = resolvedProjectId ? "PROJECT" : "GENERAL";
          const finalCategory = normalizeExpenseCategory(row.category, expenseBook);
          if (!finalCategory) {
            throw new Error(
              `Kategori '${row.category || "-"}' tidak sesuai dengan ${
                expenseBook === "PROJECT" ? "Buku Kecil" : "Buku Besar"
              }.`
            );
          }
          const finalAmount = row.kredit > 0 ? row.kredit : row.amount;

          const { error: expenseInsertErr } = await supabase.from("expenses").insert({
            organization_id: user.organizationId,
            number: expNum,
            date: new Date(row.date).toISOString(),
            merchant: row.description.slice(0, 50),
            description: row.description,
            amount: finalAmount,
            tax_amount: 0,
            total_amount: finalAmount,
            cash_account_id: cashAccountId,
            project_id: resolvedProjectId,
            category: finalCategory,
            status: "APPROVED",
            needs_category: row.needsCategory,
            source: "IMPORT_EXCEL",
            external_ref: extRef,
            submitted_by: user.profileId || user.id,
          });
          if (expenseInsertErr) throw expenseInsertErr;
        }
      }

      successCount++;
    } catch (err) {
      errorCount++;
      errorsToInsert.push({
        batch_id: batch.id,
        row_number: row.rowNumber,
        error_message: getErrorMessage(err, "Gagal menyimpan baris transaksi"),
        raw_data: row,
      });
    }
  }

  if (errorsToInsert.length > 0) {
    const { error: insertErrorsErr } = await supabase.from("import_errors").insert(errorsToInsert);
    if (insertErrorsErr) {
      throw new Error(`Gagal menyimpan detail baris error: ${insertErrorsErr.message}`);
    }
  }

  const { error: updateBatchErr } = await supabase
    .from("import_batches")
    .update({
      success_rows: (batch.success_rows || 0) + successCount,
      error_rows: (batch.error_rows || 0) + errorCount,
    })
    .eq("id", batch.id);

  if (updateBatchErr) {
    throw new Error(`Gagal memperbarui ringkasan batch impor: ${updateBatchErr.message}`);
  }

  return { successRows: successCount, errorRows: errorCount };
}

export async function finishImportBatch(batchId: string) {
  const user = await requireAuthUser();
  const supabase = await createClient();
  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .select("id, file_name, success_rows, error_rows, status")
    .eq("id", batchId)
    .eq("organization_id", user.organizationId)
    .maybeSingle();

  if (batchErr || !batch) {
    throw new Error(`Gagal memuat batch impor: ${batchErr?.message || "Batch tidak ditemukan."}`);
  }
  if (batch.status !== "PROCESSING") {
    throw new Error("Batch impor ini sudah tidak dalam status pemrosesan.");
  }

  const { error: updateErr } = await supabase
    .from("import_batches")
    .update({
      status: batch.error_rows === 0 ? "COMPLETED" : "COMPLETED_WITH_ERRORS",
    })
    .eq("id", batch.id);

  if (updateErr) {
    throw new Error(`Gagal menyelesaikan batch impor: ${updateErr.message}`);
  }

  await logAudit(user, {
    action: "EXECUTE_UI_IMPORT",
    entityType: "IMPORT_BATCH",
    entityId: batch.id,
    metadata: {
      fileName: batch.file_name,
      successRows: batch.success_rows,
      errorRows: batch.error_rows,
    },
  });

  revalidatePath("/settings/import");
  revalidatePath("/cash-book");
  revalidatePath("/reports/rekapitulasi");
  revalidatePath("/projects");

  return {
    batchId: batch.id,
    successRows: batch.success_rows || 0,
    errorRows: batch.error_rows || 0,
  };
}

export async function getImportBatches(): Promise<ImportBatchSummary[]> {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("import_batches")
    .select("id, file_name, total_rows, success_rows, error_rows, status, created_at")
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Gagal memuat riwayat impor: ${error.message}`);
  }

  return (data || []).map((b) => ({
    id: b.id,
    file_name: b.file_name,
    total_rows: b.total_rows || 0,
    success_rows: b.success_rows || 0,
    error_rows: b.error_rows || 0,
    status: b.status || "COMPLETED",
    created_at: b.created_at ? new Date(b.created_at).toISOString().split("T")[0] : "",
  }));
}
