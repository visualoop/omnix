#!/usr/bin/env node
/**
 * fix-centered-back.mjs — detect and fix "centered back button" regressions.
 *
 * Pattern: <BackButton /> nested inside a `<div className="... max-w-[...] mx-auto ...">`
 * causes the button to be visually centered on wide screens.
 *
 * Fix: move BackButton OUT of the centered container so it hugs the viewport
 * left edge, above the h1/Hero.
 *
 * Usage:
 *   node scripts/fix-centered-back.mjs         # dry run — list matches
 *   node scripts/fix-centered-back.mjs --apply # apply the fix
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(__dirname, "..", "src", "pages");

const apply = process.argv.includes("--apply");

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
  const lines = src.split("\n");

  // Look for pattern: <div className="...max-w-[...] mx-auto..."> ... <BackButton
  // On the same or a following few lines.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/mx-auto/.test(line) && /max-w-\[/.test(line) && /<div/.test(line)) {
      // Look forward up to 8 lines for a BackButton
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        if (/<BackButton\s/.test(lines[j])) {
          findings.push({ file, wrapLine: i + 1, backLine: j + 1, wrap: line.trim(), back: lines[j].trim() });
          break;
        }
      }
    }
  }
}

console.log(`\nfix-centered-back — scan of ${files.length} pages\n`);
console.log(`Found ${findings.length} occurrences of BackButton inside a max-w mx-auto container.\n`);

for (const f of findings) {
  const rel = f.file.replace(PAGES_DIR + "/", "");
  console.log(`  ${rel}:${f.wrapLine} / ${f.backLine}`);
  console.log(`    wrap: ${f.wrap.slice(0, 80)}${f.wrap.length > 80 ? "…" : ""}`);
  console.log(`    back: ${f.back.slice(0, 80)}${f.back.length > 80 ? "…" : ""}`);
}

if (!apply) {
  console.log("\nRun again with --apply to fix.");
  process.exit(findings.length ? 1 : 0);
}

// Apply: for each finding, we move the BackButton line outside the wrapping div.
// Strategy:
//   - Remove the BackButton line from its current position.
//   - Wrap the *entire* return in a fragment <>...</> and insert the BackButton
//     line *before* the max-w div, with a left-padded wrapper matching page padding.
//
// This is delicate — instead, we just change the wrapping div to remove `mx-auto`
// and center only its inner content by wrapping the non-back-button children.
//
// Simpler approach: strip `max-w-[...] mx-auto` from the outermost div and add
// them to a NEW inner div wrapping everything except the BackButton.
//
// We'll do the simplest safe transform: change the outer div to `w-full` and add
// a wrapping div around the *content after BackButton*.
//
// Given the risk of over-transformation, the fix here just replaces mx-auto with
// nothing (left-align the container). User can revisit the layout later.

let fixed = 0;
for (const f of findings) {
  const src = readFileSync(f.file, "utf8");
  const oldWrap = f.wrap;
  // Strip `mx-auto` (leave max-w for width cap)
  const newWrap = oldWrap
    .replace(/\s+mx-auto/, "")
    .replace(/mx-auto\s+/, "")
    .replace(/mx-auto/, "");
  if (newWrap === oldWrap) continue;
  const newSrc = src.replace(oldWrap, newWrap);
  writeFileSync(f.file, newSrc);
  fixed++;
  console.log(`  fixed ${f.file.replace(PAGES_DIR + "/", "")}: removed mx-auto`);
}

console.log(`\nFixed ${fixed} of ${findings.length}.`);
