"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit/auditLogger";

export interface PreviewRow {
  sheetName: string;
  rowNumber: number;
  no?: number;
  date: string;
  description: string;
  category: string;
  type: "TERMIN_KLIEN" | "PENGELUARAN_PROYEK" | "PENGELUARAN_KANTOR" | "SETORAN_PROYEK";
  ledger: "PROYEK" | "KANTOR";
  debit: number;
  kredit: number;
  amount: number;
  projectName?: string;
  needsCategory: boolean;
  workerAdvanceTo?: string;
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
  sheetName?: string;
  rowNumber?: number;
  no?: number;
  date?: string;
  description?: string;
  category?: string;
  debit?: number | string;
  kredit?: number | string;
  type?: string;
  ledger?: string;
  needsCategory?: boolean;
  workerAdvanceTo?: string;
  project?: string;
  projectName?: string;
}>): Promise<{
  rows: PreviewRow[];
  totalValid: number;
  totalInvalid: number;
  totalDebit: number;
  totalKredit: number;
  totalNeedsCategory: number;
}> {
  let totalValid = 0;
  let totalInvalid = 0;
  let totalDebit = 0;
  let totalKredit = 0;
  let totalNeedsCategory = 0;

  const rows: PreviewRow[] = rawRows.map((r, idx) => {
    const rowNumber = r.rowNumber || idx + 1;
    const desc = (r.description || "").trim();
    const dateStr = (r.date || "").trim();
    const cat = (r.category || "").trim();
    const debit = typeof r.debit === "number" ? r.debit : parseFloat(String(r.debit || 0)) || 0;
    const kredit = typeof r.kredit === "number" ? r.kredit : parseFloat(String(r.kredit || 0)) || 0;
    const sheetName = r.sheetName || "Sheet1";
    const projectName = r.projectName || r.project || (sheetName !== "Lapkeu Perusahaan" ? sheetName : undefined);
    const ledger = (r.ledger || (projectName ? "PROYEK" : "KANTOR")) as "PROYEK" | "KANTOR";

    let txType: "TERMIN_KLIEN" | "PENGELUARAN_PROYEK" | "PENGELUARAN_KANTOR" | "SETORAN_PROYEK" = "PENGELUARAN_PROYEK";
    if (r.type === "TERMIN_KLIEN" || r.type === "PENGELUARAN_PROYEK" || r.type === "PENGELUARAN_KANTOR" || r.type === "SETORAN_PROYEK") {
      txType = r.type;
    } else if (debit > 0) {
      txType = ledger === "PROYEK" ? "TERMIN_KLIEN" : "SETORAN_PROYEK";
    } else {
      txType = ledger === "PROYEK" ? "PENGELUARAN_PROYEK" : "PENGELUARAN_KANTOR";
    }

    let isValid = true;
    let validationError = "";

    if (!desc) {
      isValid = false;
      validationError = "Keterangan transaksi kosong.";
    } else if (debit <= 0 && kredit <= 0) {
      isValid = false;
      validationError = "Nominal debit atau kredit harus lebih dari 0.";
    } else if (!dateStr) {
      isValid = false;
      validationError = "Tanggal transaksi kosong.";
    }

    const needsCat = r.needsCategory ?? (!cat || cat === "Perlu dikategorikan");
    if (needsCat && txType !== "TERMIN_KLIEN" && txType !== "SETORAN_PROYEK") {
      totalNeedsCategory++;
    }

    const amount = debit > 0 ? debit : kredit;

    if (isValid) {
      totalValid++;
      if (debit > 0) totalDebit += debit;
      if (kredit > 0) totalKredit += kredit;
    } else {
      totalInvalid++;
    }

    return {
      sheetName,
      rowNumber,
      no: r.no,
      date: dateStr || new Date().toISOString().split("T")[0],
      description: desc,
      category: cat || (txType === "TERMIN_KLIEN" ? "Pendapatan Termin Proyek" : "Perlu dikategorikan"),
      type: txType,
      ledger,
      debit,
      kredit,
      amount,
      projectName,
      needsCategory: needsCat,
      workerAdvanceTo: r.workerAdvanceTo,
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
    totalNeedsCategory,
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

    // Setoran proyek internal dilewati agar tidak terjadi double counting mutasi kas
    if (row.type === "SETORAN_PROYEK") {
      successCount++;
      continue;
    }

    try {
      const extRef = `UI_IMP_${batch.id}_${row.sheetName.replace(/\s+/g, "_")}_${row.rowNumber}`;

      // Resolusi Project ID jika transaksi terkait proyek
      let resolvedProjectId: string | null = null;
      if (row.projectName && row.ledger === "PROYEK") {
        const cleanProjName = row.projectName.trim();
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

      if (row.type === "TERMIN_KLIEN") {
        // Simpan ke project_revenues
        if (!resolvedProjectId) {
          throw new Error(`Proyek untuk termin klien '${row.sheetName}' tidak ditemukan.`);
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
      } else {
        // PENGELUARAN_PROYEK atau PENGELUARAN_KANTOR
        const randNum = String(Math.floor(1000 + Math.random() * 9000));
        const expNum = `EXP-IMP-${row.rowNumber}-${randNum}`;

        await supabase.from("expenses").insert({
          organization_id: user.organizationId,
          number: expNum,
          date: new Date(row.date).toISOString(),
          merchant: row.description.slice(0, 50),
          description: row.description,
          amount: row.kredit,
          tax_amount: 0,
          total_amount: row.kredit,
          cash_account_id: cashAccountId,
          project_id: resolvedProjectId,
          category: row.category,
          status: "APPROVED",
          needs_category: row.needsCategory,
          source: "IMPORT_EXCEL",
          external_ref: extRef,
          submitted_by: user.profileId || user.id,
        });
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
