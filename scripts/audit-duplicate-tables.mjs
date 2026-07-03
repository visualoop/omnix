#!/usr/bin/env node
/**
 * audit-duplicate-tables.mjs — scans all migrations for
 * `CREATE TABLE IF NOT EXISTS <name>` collisions across files. When two
 * files both create the same table name, the SECOND one is silently
 * ignored because IF NOT EXISTS matches. That's the exact class of bug
 * that broke hardware quotations (018 vs 031 both defined `quotations`).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, "..", "src-tauri", "migrations");

const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
const byTable = new Map(); // table -> Array<file>

for (const f of files) {
  const src = readFileSync(join(MIG_DIR, f), "utf8");
  const matches = [...src.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)];
  for (const m of matches) {
    const t = m[1].toLowerCase();
    if (!byTable.has(t)) byTable.set(t, []);
    byTable.get(t).push(f);
  }
}

let collisions = 0;
console.log("\nDuplicate CREATE TABLE IF NOT EXISTS scan\n");
for (const [table, sources] of [...byTable.entries()].sort()) {
  if (sources.length > 1) {
    collisions++;
    console.log(`  ⚠ ${table.padEnd(28)}  — defined in ${sources.length} files`);
    for (const s of sources) console.log(`      ${s}`);
  }
}

console.log(`\n${collisions} collision(s) across ${files.length} migrations.`);
process.exit(collisions ? 1 : 0);
