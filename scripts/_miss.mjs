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
const p = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ""));
      cur = "";
    } else cur += c;
  }
  result.push(cur.trim().replace(/^"|"$/g, ""));
  return result;
}

const csv = fs
  .readFileSync("data/import/transaksi_2026.csv", "utf8")
  .replace(/^﻿/, "")
  .trim();
const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]);
const idx = (n) => header.indexOf(n);

const csvRows = lines.slice(1).map(parseCsvLine).filter((c) => !c.every((x) => x === ""));

const db = await p.$queryRawUnsafe(
  `SELECT external_ref, date, amount FROM expenses WHERE external_ref IS NOT NULL LIMIT 3`
);
console.log("sample DB expense (extRef, date, amount):", JSON.stringify(db, null, 1));

const dbRev = await p.$queryRawUnsafe(
  `SELECT external_ref, date, amount FROM project_revenues LIMIT 2`
);
console.log("sample DB revenue:", JSON.stringify(dbRev, null, 1));

const dbSet = new Set(
  (
    await p.$queryRawUnsafe(
      `SELECT external_ref FROM expenses WHERE external_ref IS NOT NULL UNION SELECT external_ref FROM project_revenues WHERE external_ref IS NOT NULL`
    )
  ).map((r) => r.external_ref)
);

const missing = {};
csvRows.forEach((c) => {
  const ext = `${c[idx("sheet")]}_${c[idx("row")]}`;
  if (dbSet.has(ext)) return;
  const type = c[idx("type")];
  missing[type] = (missing[type] || 0) + 1;
});
console.log("\nBaris CSV yang BELUM ada di DB, per jenis:", missing);
console.log("Total belum ada:", Object.values(missing).reduce((a, b) => a + b, 0));

await p.$disconnect();
