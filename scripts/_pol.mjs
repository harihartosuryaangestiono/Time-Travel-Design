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

const pol = await prisma.$queryRawUnsafe(`
  SELECT tablename, policyname, cmd FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('expenses','clients','projects','cash_accounts','audit_logs','project_revenues','import_batches','import_errors')
  ORDER BY tablename, cmd
`);
const byTable = {};
for (const p of pol) {
  byTable[p.tablename] = byTable[p.tablename] || [];
  byTable[p.tablename].push(`${p.cmd} :: ${p.policyname}`);
}
console.log(JSON.stringify(byTable, null, 1));

const proj = await prisma.$queryRawUnsafe(
  `SELECT id, name, code, client_id FROM projects ORDER BY name`
);
console.log("\nPROJECTS:", proj.map((p) => `${p.code} | ${p.name}`).join("\n"));

const cli = await prisma.$queryRawUnsafe(`SELECT id, name FROM clients ORDER BY name`);
console.log("\nCLIENTS:", cli.map((c) => c.name).join(", "));

await prisma.$disconnect();
