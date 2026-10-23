import fs from "fs";
import { PrismaClient } from "@prisma/client";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const idx = await prisma.$queryRawUnsafe(`
  SELECT tablename, indexname, indexdef FROM pg_indexes
  WHERE schemaname='public'
    AND tablename IN ('expenses','project_revenues','projects','clients','import_batches','import_errors','cash_accounts')
  ORDER BY tablename, indexname
`);
for (const i of idx) console.log(`${i.tablename}: ${i.indexdef}`);

const defs = await prisma.$queryRawUnsafe(`
  SELECT table_name, column_name, column_default FROM information_schema.columns
  WHERE table_schema='public' AND column_name='id' AND column_default IS NOT NULL
  ORDER BY table_name
`);
console.log("\nTABLES WITH id DEFAULT:", defs.map((d) => d.table_name).join(", "));

await prisma.$disconnect();
