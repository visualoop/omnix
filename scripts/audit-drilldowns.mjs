#!/usr/bin/env node
/**
 * audit-drilldowns.mjs — find list rendering that doesn't wire clicks to
 * a detail route. When a user creates an "Area" or a "Room" or a "Brand"
 * or a "Category" and lists them, clicking a row should navigate to a
 * detail view. If nothing happens on click, the row is a dead end.
 *
 * Heuristic: look for <tr key={x.id}> or <li key={x.id}> or map((x) => (
 *   <div key={x.id}> in list pages that don't have `onClick={...}` or
 *   `navigate(`/... /${x.id}`)` or `to="/..."/${x.id}"` in the tag.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES = join(__dirname, "..", "src", "pages");

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.tsx?$/.test(e)) files.push(p);
  }
  return files;
}

const files = walk(PAGES);
const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for <tr key={x.id}> or <li key={x.id}> — the row-level render
    const rowMatch = line.match(/<(?:tr|li|div|button)[^>]*\bkey=\{([\w.]+)\.id\}/);
    if (!rowMatch) continue;
    // Check the next 4 lines for onClick / navigate / to= / href=
    let hasNav = /onClick=|onSelect=|to=|href=|navigate\(/.test(line);
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (/onClick=|onSelect=|to=|href=|navigate\(/.test(lines[j])) hasNav = true;
      if (/<\/(?:tr|li|div|button)>/.test(lines[j])) break;
    }
    if (!hasNav) {
      findings.push({ file: file.replace(PAGES + "/", ""), line: i + 1, snippet: line.trim().slice(0, 90) });
    }
  }
}

console.log(`\naudit-drilldowns — scan of ${files.length} pages\n`);
console.log(`Found ${findings.length} list rows without click handlers.\n`);

// Group by file
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

for (const [file, entries] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${file}  (${entries.length})`);
  for (const e of entries.slice(0, 5)) {
    console.log(`    L${e.line}  ${e.snippet}`);
  }
  if (entries.length > 5) console.log(`    …${entries.length - 5} more`);
}

process.exit(findings.length ? 0 : 0);
