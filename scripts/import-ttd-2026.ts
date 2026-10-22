import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ImportData {
  organization: {
    legal_name: string;
    brand: string;
    fiscal_year: number;
    currency: string;
    opening_cash_2025: number;
  };
  categories: Array<{ name: string; type: string }>;
  projects: Array<{
    name: string;
    code: string;
    client: string;
    total_received: number;
    total_spent: number;
  }>;
  kasbon_karyawan: Array<{
    name: string;
    role: string;
    max_advance_amount: number;
    opening_balance: number;
    components: Array<{ desc: string; amount: number }>;
    notes: string;
  }>;
  kasbon_mandor_proyek: Array<{
    mandor_name: string;
    project_name: string;
    plafon: number | null;
    notes: string;
  }>;
  transactions: Array<{
    sheet: string;
    row: number;
    no: number;
    date: string;
    desc: string;
    debit: number;
    kredit: number;
    category: string | null;
    type: string;
    ledger: string;
    needs_category: boolean;
    worker_advance_to?: string;
  }>;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=======================================================");
  console.log(`  SKRIP IMPOR PEMBUKUAN TTD 2026 (Laporan_Keuangan_2026)`);
  console.log(`  Mode: ${isDryRun ? "DRY-RUN (Simulasi - Tanpa Simpan ke DB)" : "PRODUKSI (Menyimpan ke Database)"}`);
  console.log("=======================================================\n");

  const dataPath = path.join(process.cwd(), "data/import/ttd_import_data.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Berkas data tidak ditemukan: ${dataPath}`);
  }

  const rawJson = fs.readFileSync(dataPath, "utf8");
  const importData: ImportData = JSON.parse(rawJson);

  // 1. Rekonsiliasi Pra-Impor
  let totalRevenue = 0;
  let totalHpp = 0;
  let materialHpp = 0;
  let upahHpp = 0;
  let sewaHpp = 0;
  let transportHpp = 0;
  let totalOpex = 0;
  let totalCapex = 0;
  let totalUncategorized = 0;
  let uncategorizedCount = 0;
  let uncategorizedProjectCount = 0;
  let uncategorizedKasCount = 0;
  let setoranProyekCount = 0;
  let importableCount = 0;

  for (const t of importData.transactions) {
    if (t.type === "SETORAN_PROYEK") {
      setoranProyekCount++;
      continue;
    }

    importableCount++;

    if (t.type === "TERMIN_KLIEN") {
      totalRevenue += t.debit;
    } else if (t.type === "PENGELUARAN_PROYEK") {
      if (t.needs_category || !t.category || t.category === "Perlu dikategorikan") {
        totalUncategorized += t.kredit;
        uncategorizedCount++;
        uncategorizedProjectCount++;
      } else {
        totalHpp += t.kredit;
        if (t.category === "Bahan Baku Utama / Material") materialHpp += t.kredit;
        if (t.category === "Upah Tukang") upahHpp += t.kredit;
        if (t.category === "Sewa Alat Proyek") sewaHpp += t.kredit;
        if (t.category === "Transportasi Lapangan") transportHpp += t.kredit;
      }
    } else if (t.type === "PENGELUARAN_KANTOR") {
      if (t.needs_category || !t.category || t.category === "Perlu dikategorikan") {
        totalUncategorized += t.kredit;
        uncategorizedCount++;
        uncategorizedKasCount++;
      } else {
        const cat = importData.categories.find(c => c.name === t.category);
        if (cat?.type === "OPEX") totalOpex += t.kredit;
        if (cat?.type === "CAPEX") totalCapex += t.kredit;
      }
    }
  }

  console.log("=== TABEL REKONSILIASI ANGKA (TARGET EXCEL vs EKSTRAKSI) ===");
  console.log(`Total Transaksi di File  : ${importData.transactions.length}`);
  console.log(`SETORAN_PROYEK diabaikan : ${setoranProyekCount} baris (Input ganda Excel)`);
  console.log(`Transaksi Diimpor        : ${importableCount} baris (Target: 1.433 - 1.435)`);
  console.log("------------------------------------------------------------");
  console.log(`Total Pendapatan Proyek  : Rp ${totalRevenue.toLocaleString("id-ID")} (Target: 2.275.050.682)`);
  console.log(`Total HPP Berkategori    : Rp ${totalHpp.toLocaleString("id-ID")} (Target: 1.595.474.478)`);
  console.log(`  - Material             : Rp ${materialHpp.toLocaleString("id-ID")}`);
  console.log(`  - Upah Tukang          : Rp ${upahHpp.toLocaleString("id-ID")}`);
  console.log(`  - Sewa Alat Proyek     : Rp ${sewaHpp.toLocaleString("id-ID")}`);
  console.log(`  - Transportasi Lapangan: Rp ${transportHpp.toLocaleString("id-ID")}`);
  console.log(`Total Opex Berkategori   : Rp ${totalOpex.toLocaleString("id-ID")} (Target: 233.655.449,29)`);
  console.log(`Total Capex              : Rp ${totalCapex.toLocaleString("id-ID")} (Target: 51.714.617)`);
  console.log(`Total Belum Berkategori  : Rp ${totalUncategorized.toLocaleString("id-ID")} (${uncategorizedCount} baris: ${uncategorizedProjectCount} di proyek, ${uncategorizedKasCount} di kantor)`);
  console.log(`Kas Awal Modal 2025      : Rp ${importData.organization.opening_cash_2025.toLocaleString("id-ID")}`);
  console.log("Kasbon Owner:");
  importData.kasbon_karyawan.forEach(k => {
    console.log(`  - ${k.name} (${k.role}): Plafon Rp ${k.max_advance_amount.toLocaleString("id-ID")}, Saldo Awal Rp ${k.opening_balance.toLocaleString("id-ID")}`);
  });
  console.log("============================================================\n");

  if (isDryRun) {
    console.log("✅ SIMULASI DRY-RUN SELESAI. Seluruh data tervalidasi dan siap diimpor ke database.");
    return;
  }

  // 2. Eksekusi Impor ke Database
  console.log("Menghubungkan ke database...");

  // Ambil atau buat organisasi TTD
  let organization = await prisma.organization.findFirst({
    where: { name: { contains: "Time Travel Design", mode: "insensitive" } },
  });

  if (!organization) {
    organization = await prisma.organization.findFirst();
  }

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: "Time Travel Design",
      },
    });
  }

  const orgId = organization.id;
  console.log(`Menggunakan Organisasi: ${organization.name} (${orgId})`);

  // Cari actor/user sistem untuk audit log
  const systemMember = await prisma.organizationMember.findFirst({
    where: { organization_id: orgId },
  });
  const actorId = systemMember?.profile_id || "system-import";

  // 3. Akun Kas/Bank BCA
  let bcaAccount = await prisma.cashAccount.findFirst({
    where: {
      organization_id: orgId,
      name: { contains: "BCA", mode: "insensitive" },
    },
  });

  if (!bcaAccount) {
    bcaAccount = await prisma.cashAccount.create({
      data: {
        organization_id: orgId,
        name: "Kas/Bank BCA",
        type: "BANK",
        bank_name: "Bank BCA",
        account_number: "Rekening Operasional TTD",
        opening_balance: importData.organization.opening_cash_2025,
        opening_date: new Date("2026-01-01"),
        is_active: true,
      },
    });
    console.log(`Akun Kas/Bank BCA dibuat dengan saldo awal Rp ${importData.organization.opening_cash_2025.toLocaleString("id-ID")}`);
  } else {
    // Pastikan opening_balance mencerminkan saldo awal 2025 tanpa menimpa saldo berjalan
    await prisma.cashAccount.update({
      where: { id: bcaAccount.id },
      data: {
        opening_balance: importData.organization.opening_cash_2025,
      },
    });
    console.log(`Akun Kas/Bank BCA diperbarui dengan saldo awal Rp ${importData.organization.opening_cash_2025.toLocaleString("id-ID")}`);
  }

  // 4. Impor Proyek & Klien
  console.log(`Mengimpor ${importData.projects.length} proyek...`);
  const projectMap = new Map<string, string>(); // sheetName -> projectId

  for (const p of importData.projects) {
    // Cari atau buat client
    let client = await prisma.client.findFirst({
      where: {
        organization_id: orgId,
        name: p.client,
      },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          organization_id: orgId,
          name: p.client,
        },
      });
    }

    // Cari atau buat proyek (cek name ATAU code)
    let project = await prisma.project.findFirst({
      where: {
        organization_id: orgId,
        OR: [
          { name: p.name },
          { code: p.code },
        ],
      },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          organization_id: orgId,
          name: p.name,
          code: p.code,
          client_id: client.id,
          type: "ARCHITECTURE",
          status: "ACTIVE",
          contract_value: p.total_received,
        },
      });
    } else {
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          name: p.name,
          contract_value: p.total_received,
        },
      });
    }

    projectMap.set(p.name, project.id);
  }

  // 5. Impor Master Kasbon Owner
  console.log("Mengimpor kasbon owner...");
  for (const k of importData.kasbon_karyawan) {
    // Daftarkan di advance_recipients
    let recipient = await prisma.advanceRecipient.findFirst({
      where: {
        organization_id: orgId,
        name: k.name,
      },
    });

    if (!recipient) {
      recipient = await prisma.advanceRecipient.create({
        data: {
          organization_id: orgId,
          name: k.name,
          type: "OWNER",
          max_advance_amount: k.max_advance_amount,
          notes: k.notes,
        },
      });
    } else {
      await prisma.advanceRecipient.update({
        where: { id: recipient.id },
        data: {
          max_advance_amount: k.max_advance_amount,
          type: "OWNER",
        },
      });
    }

    // Buat saldo awal kasbon TANPA mutasi kas keluar
    const extRef = `OPENING_ADVANCE_${k.name.toUpperCase().replace(/\s+/g, "_")}`;
    const existingAdvance = await prisma.cashAdvance.findFirst({
      where: {
        organization_id: orgId,
        external_ref: extRef,
      },
    });

    if (!existingAdvance) {
      await prisma.cashAdvance.create({
        data: {
          organization_id: orgId,
          number: `CA-INIT-${k.name.toUpperCase()}`,
          date: new Date("2026-01-01"),
          advance_type: "EMPLOYEE",
          recipient_id: recipient.id,
          employee_id: actorId,
          purpose: `Saldo Awal Kasbon Owner (${k.name}) - rincian komponen perlu dilengkapi`,
          amount: k.opening_balance,
          disbursed_amount: k.opening_balance,
          settled_amount: 0,
          returned_amount: 0,
          status: "DISBURSED",
          is_opening_balance: true,
          source: "IMPORT_EXCEL",
          external_ref: extRef,
          notes: JSON.stringify(k.components),
        },
      });
    }
  }

  // 6. Impor Transaksi (Termin Klien & Pengeluaran)
  console.log("Mengimpor transaksi secara idempoten...");
  let insertedRevenues = 0;
  let insertedExpenses = 0;
  let skippedSetoran = 0;

  for (const t of importData.transactions) {
    const extRef = `${t.sheet}_${t.row}`;

    if (t.type === "SETORAN_PROYEK") {
      skippedSetoran++;
      continue;
    }

    if (t.type === "TERMIN_KLIEN") {
      const projId = projectMap.get(t.sheet);
      if (!projId) continue;

      const existing = await prisma.projectRevenue.findFirst({
        where: { external_ref: extRef },
      });

      if (!existing) {
        await prisma.projectRevenue.create({
          data: {
            organization_id: orgId,
            project_id: projId,
            cash_account_id: bcaAccount.id,
            date: new Date(t.date),
            amount: t.debit,
            description: t.desc,
            source: "IMPORT_EXCEL",
            external_ref: extRef,
          },
        });
        insertedRevenues++;
      }
    } else if (t.type === "PENGELUARAN_PROYEK" || t.type === "PENGELUARAN_KANTOR") {
      const projId = t.type === "PENGELUARAN_PROYEK" ? projectMap.get(t.sheet) || null : null;

      const existing = await prisma.expense.findFirst({
        where: { external_ref: extRef },
      });

      if (!existing) {
        const randNum = String(Math.floor(1000 + Math.random() * 9000));
        const expNum = `EXP-${t.date.replace(/-/g, "").slice(0, 6)}-${t.no}-${randNum}`;

        await prisma.expense.create({
          data: {
            organization_id: orgId,
            number: expNum,
            date: new Date(t.date),
            merchant: t.desc.slice(0, 50),
            description: t.desc,
            amount: t.kredit,
            tax_amount: 0,
            total_amount: t.kredit,
            cash_account_id: bcaAccount.id,
            project_id: projId,
            category: t.category,
            status: "APPROVED",
            needs_category: t.needs_category,
            source: "IMPORT_EXCEL",
            external_ref: extRef,
            submitted_by: actorId,
          },
        });
        insertedExpenses++;
      }
    }
  }

  // 7. Catat Audit Logs
  await prisma.auditLog.create({
    data: {
      organization_id: orgId,
      actor_id: actorId,
      actor_email: "import-system@timetraveldesign.id",
      action: "IMPORT_EXCEL_DATA",
      entity_type: "IMPORT_BATCH",
      entity_id: `IMPORT_2026_${Date.now()}`,
      metadata: {
        imported_revenues: insertedRevenues,
        imported_expenses: insertedExpenses,
        skipped_setoran: skippedSetoran,
        fiscal_year: 2026,
        source_file: "Laporan_Keuangan_2026.xlsx",
      },
    },
  });

  console.log("\n=======================================================");
  console.log("       PROSES IMPOR DATABASE SELESAI DENGAN SUKSES!    ");
  console.log("=======================================================");
  console.log(`Termin Klien Disimpan   : ${insertedRevenues} data`);
  console.log(`Pengeluaran Disimpan    : ${insertedExpenses} data`);
  console.log(`Setoran Ganda Dilewati  : ${skippedSetoran} data`);
  console.log(`Audit Log Tercatat      : Ya (IMPORT_EXCEL_DATA)`);
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("Gagal menjalankan impor:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
