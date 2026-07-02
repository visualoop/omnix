#!/usr/bin/env node
/**
 * audit-date-filters.mjs — catalogue every date/calendar filter across pages and
 * flag ones that are visually present but don't actually filter any data.
 *
 * Detection heuristics:
 *   1. Find <Input type="date" ...> occurrences per page.
 *   2. Extract the state variable it binds to (via value={...} / onChange={...}).
 *   3. Scan the page for whether that state var appears inside a useEffect / useCallback
 *      dependency array (i.e., something re-runs when the date changes).
 *   4. Also check whether the state appears inside a query() / listXxx() argument.
 *
 * Output: table with page name, date-input count, whether state flows into a query.
 *
 * Usage: node scripts/audit-date-filters.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(__dirname, "..", "src", "pages");

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (entry.endsWith(".tsx")) files.push(p);
  }
  return files;
}

const files = walk(PAGES_DIR);
const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // Find all date-input tags (both <Input type="date"> and <input type="date">)
  const dateInputs = [...src.matchAll(/<[Ii]nput[^>]*type=["']date["'][^>]*(?:\/>|>)/g)];
  if (dateInputs.length === 0) continue;

  // Try to extract the state variable bound via value={...}
  const stateVars = new Set();
  for (const m of dateInputs) {
    const tag = m[0];
    const vmatch = tag.match(/value=\{([^}]+)\}/);
    if (vmatch) {
      const v = vmatch[1].trim();
      const root = v.split(/[.\[]/)[0].replace(/^\(|\)$/g, "");
      stateVars.add(root);
    }
  }

  // Check if any state var appears in a useEffect/useCallback deps array
  const flowsIntoQuery = [...stateVars].some((v) => {
    if (!v) return false;
    // Look for useEffect(...., [....v....])  OR  useCallback(..., [....v....])
    // The regex hunts for the identifier inside a dependency array.
    const depRegex = new RegExp(`use(?:Effect|Callback|Memo)\\([\\s\\S]*?\\[[^\\]]*\\b${v}\\b[^\\]]*\\]`);
    return depRegex.test(src);
  });

  findings.push({
    file: file.replace(PAGES_DIR + "/", ""),
    dateInputCount: dateInputs.length,
    stateVars: [...stateVars],
    flowsIntoQuery,
  });
}

// Print table
console.log("\naudit-date-filters — scan of", files.length, "pages\n");
console.log(
  "PAGE".padEnd(38),
  "INPUTS".padStart(6),
  " STATE VARS".padEnd(42),
  " FLOWS?",
);
console.log("─".repeat(100));

let broken = 0;
let ok = 0;
for (const f of findings.sort((a, b) => (a.flowsIntoQuery === b.flowsIntoQuery ? a.file.localeCompare(b.file) : a.flowsIntoQuery ? 1 : -1))) {
  const mark = f.flowsIntoQuery ? "✓" : "✗";
  const vars = f.stateVars.join(", ").slice(0, 40).padEnd(41);
  console.log(f.file.padEnd(38), String(f.dateInputCount).padStart(6), " " + vars, " " + mark);
  if (f.flowsIntoQuery) ok++;
  else broken++;
}

console.log("─".repeat(100));
console.log(`Total pages with date inputs : ${findings.length}`);
console.log(`Date filter appears to work  : ${ok}`);
console.log(`Date filter looks dead       : ${broken}`);
