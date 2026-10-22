"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";
import { ParsedRow, ParsedImportResult } from "@/lib/import/excelParser";

export interface ImportBatchSummary {
  id: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
}

export async function executeImportBatch(input: {
  fileName: string;
  rows: ParsedRow[];
}) {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 1. Buat record batch di import_batches
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

  // 2. Cari akun kas BCA operasional
  const { data: bca } = await supabase
    .from("cash_accounts")
    .select("id")
    .eq("organization_id", user.organizationId)
    .ilike("name", "%BCA%")
    .maybeSingle();

  const cashAccountId = bca?.id || null;

  // 3. Cache proyek dan klien yang ada di organisasi
  const { data: existingProjects } = await supabase
    .from("projects")
    .select("id, name, code")
    .eq("organization_id", user.organizationId);

  const projectMap = new Map<string, string>(); // sheet/project name -> id
  (existingProjects || []).forEach((p: any) => {
    projectMap.set(p.name.toLowerCase().trim(), p.id);
    if (p.code) projectMap.set(p.code.toLowerCase().trim(), p.id);
  });

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

    // Aturan: jenis SETORAN_PROYEK dilewati (tidak disimpan)
    if (row.isSkipped || row.jenis === "SETORAN_PROYEK") {
      successCount++;
      continue;
    }

    try {
      // Idempoten lewat external_ref = sheet_asal + "_" + baris_excel
      const extRef = `${row.sheetAsal}_${row.barisExcel}`;

      // Resolusi Project ID jika transaksi terkait proyek
      let resolvedProjectId: string | null = null;
      if (row.buku === "PROYEK") {
        const cleanProjName = row.sheetAsal.trim();
        const lowerProj = cleanProjName.toLowerCase();

        if (projectMap.has(lowerProj)) {
          resolvedProjectId = projectMap.get(lowerProj)!;
        } else {
          // Cari atau buat klien
          const clientName = cleanProjName.includes(" - ") ? cleanProjName.split(" - ")[1].trim() : cleanProjName;
          const { data: newClient } = await supabase
            .from("clients")
            .insert({
              organization_id: user.organizationId,
              name: clientName,
            })
            .select("id")
            .single();

          const code = cleanProjName.includes(" - ") ? cleanProjName.split(" - ")[0].trim() : cleanProjName.slice(0, 8).toUpperCase();

          const { data: newProject } = await supabase
            .from("projects")
            .insert({
              organization_id: user.organizationId,
              name: cleanProjName,
              code,
              client_id: newClient?.id || null,
              type: "ARCHITECTURE",
              status: "ACTIVE",
            })
            .select("id")
            .single();

          if (newProject) {
            resolvedProjectId = newProject.id;
            projectMap.set(lowerProj, newProject.id);
          }
        }
      }

      if (row.jenis === "TERMIN_KLIEN") {
        // Cek idempoten di project_revenues
        const { data: existingRevenue } = await supabase
          .from("project_revenues")
          .select("id")
          .eq("external_ref", extRef)
          .maybeSingle();

        if (!existingRevenue) {
          if (!resolvedProjectId) {
            throw new Error(`Proyek untuk termin klien '${row.sheetAsal}' tidak ditemukan.`);
          }

          await supabase.from("project_revenues").insert({
            organization_id: user.organizationId,
            project_id: resolvedProjectId,
            cash_account_id: cashAccountId,
            date: new Date(row.date).toISOString(),
            amount: row.debit,
            description: row.description,
            source: "IMPORT_EXCEL",
            external_ref: extRef,
          });
        }
      } else if (row.jenis === "MODAL_AWAL") {
        // Modal awal kas 2025: update opening_balance jika belum ada
        if (cashAccountId) {
          await supabase
            .from("cash_accounts")
            .update({
              opening_balance: row.debit,
              opening_date: new Date(row.date).toISOString(),
            })
            .eq("id", cashAccountId);
        }
      } else {
        // PENGELUARAN_PROYEK, PENGELUARAN_KANTOR, BUNGA_BANK
        const { data: existingExpense } = await supabase
          .from("expenses")
          .select("id")
          .eq("external_ref", extRef)
          .maybeSingle();

        if (!existingExpense) {
          const randNum = String(Math.floor(1000 + Math.random() * 9000));
          const expNum = `EXP-IMP-${row.barisExcel}-${randNum}`;
          const finalCategory = row.needsCategory ? "Perlu dikategorikan" : row.category;
          const finalAmount = row.kredit > 0 ? row.kredit : row.amount;

          await supabase.from("expenses").insert({
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
        }
      }

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
  revalidatePath("/projects");

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
