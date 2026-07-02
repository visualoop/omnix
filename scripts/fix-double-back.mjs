#!/usr/bin/env node
/**
 * fix-double-back.mjs — Find pages that have BOTH the standardised
 * <BackButton /> and a hand-rolled back-arrow button, then remove the
 * hand-rolled one so only the design-system component remains.
 *
 * The hand-rolled pattern varies, but the common shape is:
 *
 *   <Button variant="ghost" size="sm" onClick={() => navigate("/foo")} ...>
 *     <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
 *   </Button>
 *
 * Some variants:
 *   - "Back to <something>" label
 *   - navigate(-1) instead of navigate("/foo")
 *   - Button size xs / sm
 *   - Different ArrowLeft className
 *
 * Strategy: for each page under src/pages/, if it contains a <BackButton
 * (from @/components/ui/back-button) AND a <Button ...> element that
 * contains "<ArrowLeft" AND either "Back" text or navigate() to a parent,
 * we snip the second one.
 *
 * Usage:
 *   node scripts/fix-double-back.mjs           # report only
 *   node scripts/fix-double-back.mjs --apply   # apply fix
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGES_DIR = "src/pages";

/**
 * Returns { hasBackButton, matches } where `matches` is a list of
 * [start, end] index tuples pointing at the manual back-button blocks.
 */
function findDoubleBack(src) {
  const hasBackButton = /<BackButton[\s/>]/.test(src);
  if (!hasBackButton) return { hasBackButton, matches: [] };

  const matches = [];
  // We look for JSX buttons that:
  //   - Are a <Button ...> ... </Button> pair
  //   - Contain <ArrowLeft (any props)
  //   - Have a text child that includes "Back" as a whole word
  // Regex is chunky but scoped to `<Button` openings + closes.
  const re =
    /<Button\b[\s\S]*?<ArrowLeft\b[\s\S]*?<\/Button>/g;
  for (const m of src.matchAll(re)) {
    const block = m[0];
    // The block must include a "Back" text token — reject full-fledged
    // action buttons that happen to have ArrowLeft (e.g. "Previous step").
    if (/>\s*Back\s*</.test(block) || /\bBack\b(?=\s*(?:to\s|<))/.test(block)) {
      matches.push([m.index, m.index + block.length]);
    }
  }
  return { hasBackButton, matches };
}

/**
 * Snip the given ranges from the source, plus any adjacent whitespace/newline
 * so we don't leave blank rows.
 */
function snip(src, ranges) {
  let out = src;
  // Snip from last to first so indices remain valid.
  for (const [start, end] of ranges.slice().sort((a, b) => b[0] - a[0])) {
    // Extend `start` backwards over leading whitespace on the same line
    let s = start;
    while (s > 0 && (out[s - 1] === " " || out[s - 1] === "\t")) s--;
    // Extend `end` forwards to include the trailing newline
    let e = end;
    while (e < out.length && (out[e] === " " || out[e] === "\t")) e++;
    if (out[e] === "\n") e++;
    out = out.slice(0, s) + out.slice(e);
  }
  return out;
}

const apply = process.argv.includes("--apply");
const files = readdirSync(PAGES_DIR).filter((f) => f.endsWith(".tsx"));

const doubled = [];
for (const name of files) {
  const path = join(PAGES_DIR, name);
  const src = readFileSync(path, "utf8");
  const { hasBackButton, matches } = findDoubleBack(src);
  if (hasBackButton && matches.length > 0) {
    doubled.push({ name, path, matches });
    if (apply) {
      const patched = snip(src, matches);
      writeFileSync(path, patched);
    }
  }
}

console.log(`\nPages with double back buttons: ${doubled.length}`);
for (const d of doubled) {
  console.log(`  ${d.name}  (removed ${d.matches.length} manual back button${d.matches.length > 1 ? "s" : ""})`);
}
if (apply) {
  console.log(`\nPatched.`);
} else {
  console.log(`\nRun with --apply to remove the manual back buttons.`);
}
