#!/usr/bin/env node
/**
 * audit-full-width-back.mjs — find BackButton usages where the button
 * could stretch full width due to a flex/grid parent with align-items:stretch.
 *
 * The fix is either:
 *  - Wrap the BackButton in a `<div className="inline-block">`, or
 *  - Ensure the BackButton itself carries `w-fit`.
 *
 * v0.39.7 added `w-fit` to the BackButton's base class so it'll never
 * stretch again regardless of parent. This audit still flags historical
 * usages so we can spot design regressions if the base class ever changes.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "pages");

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.tsx?$/.test(e)) files.push(p);
  }
  return files;
}

const files = walk(SRC);
const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/<BackButton\s/.test(lines[i])) continue;
    // Look at the previous 4 lines for a flex/grid parent
    for (let j = Math.max(0, i - 6); j < i; j++) {
      const l = lines[j];
      if (/<div[^>]*className="[^"]*\b(flex\s+flex-col|flex\s+flex-row|grid\s+grid-cols)/.test(l)
          && !/items-start|items-center|items-end|justify-start|w-fit|inline-flex|inline-block/.test(l)) {
        findings.push({
          file: file.replace(SRC + "/", ""),
          line: i + 1,
          parent: l.trim().slice(0, 100),
        });
        break;
      }
    }
  }
}

console.log(`\naudit-full-width-back — scan of ${files.length} pages\n`);
console.log(`Found ${findings.length} BackButtons under a stretching flex/grid parent.\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}`);
  console.log(`    parent: ${f.parent}`);
}
console.log(
  `\nNote: BackButton itself carries 'w-fit' since v0.39.7, so runtime`,
  `stretching is prevented even if the parent uses align-items:stretch.`,
);
process.exit(findings.length ? 0 : 0);  // never fail the build
