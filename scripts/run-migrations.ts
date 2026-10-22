import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function runSqlFile(filePath: string) {
  console.log(`Menjalankan migrasi: ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, "utf-8");
  
  // Pisahkan statement berdasarkan semicolon sederhana
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    if (!statement) continue;
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Statement skipped or failed: ${statement.slice(0, 40)}... ->`, errorMsg);
    }
  }
  console.log(`✅ Selesai: ${path.basename(filePath)}`);
}

async function main() {
  const migrations = [
    "20261022_fase2_kasbon_reimbursement.sql",
    "20261022_fase2b_excel_import.sql",
  ];

  for (const m of migrations) {
    const p = path.join(process.cwd(), "supabase", "migrations", m);
    if (fs.existsSync(p)) {
      await runSqlFile(p);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Migration runner error:", e);
  process.exit(1);
});
