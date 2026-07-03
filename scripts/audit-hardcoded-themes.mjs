#!/usr/bin/env node
/**
 * audit-hardcoded-themes.mjs — find bg / text / border colours that bypass
 * the theme-token system (--background, --foreground, --card, --muted, etc.).
 *
 * Two classes of finding:
 *   1. Hardcoded hex on structural surfaces:
 *      `bg-[#FBFAF6]`, `bg-[#0a0a0a]`, `text-[#111]`, `border-[#eee]`, etc.
 *      These bypass the theme system and won't switch when the user picks
 *      a different theme.
 *   2. Tailwind neutral utilities on structural surfaces:
 *      `bg-white`, `bg-black`, `bg-neutral-50`, `bg-zinc-950`, `bg-slate-100`,
 *      `bg-gray-50`. Same problem — hardcoded to a specific ramp.
 *
 * We EXCLUDE:
 *   - Brand-locked colours (M-Pesa green #4FC52E, Paystack blue #13B7F5,
 *     Daraja green #1F8B3A, etc.) — these MUST stay as brand values.
 *   - Fixed decorative overlays like bg-black/40 for modal backdrops (opacity
 *     variants are usually intentional).
 *   - Small-scale accents inside coloured chips / semantic badges.
 *
 * Output: table + exit code 1 when findings > 0.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

// Colour utilities that shouldn't appear on structural surfaces.
const HEX_PATTERN = /(?:bg|text|border|ring|from|to)-\[#[0-9a-fA-F]{3,8}\]/g;
const NAMED_PATTERN = /(?:bg|text|border|ring)-(?:white|black|neutral|zinc|slate|gray|stone)(?:-\d{2,3})?(?![a-zA-Z0-9-])/g;

// Files / substrings we skip. Brand-locked colour components stay verbatim.
const SKIP_FILES = new Set([
  "src/components/pos/payment-modal.tsx",
  "src/components/pos/daraja-mpesa.tsx",
  "src/components/pos/paystack-mpesa.tsx",
  "src/components/pos/insurance-verify.tsx",
  "src/components/icons/payment-brands.tsx",
]);

// Substrings inside lines we intentionally allow (brand hex, modal backdrops
// with /nn opacity, etc.).
const LINE_ALLOW = [
  /bg-(?:black|white)\/\d{1,3}/,  // bg-black/40, bg-white/10 — decorative
  /text-white(?![-a-zA-Z0-9])/,   // text-white on hero pills / accents
  /border-white\/\d{1,3}/,
  /#4FC52E|#2E7D1B|#7BE35C/,      // M-Pesa green ramp
  /#13B7F5|#0A6F9E|#5FD0FB|#0E84C7/, // Paystack / Daraja blue ramp
  /#1F8B3A|#16702D|#5FC97E/,      // Daraja green ramp
  /bg-emerald|bg-rose|bg-amber|bg-red|bg-green|bg-blue|bg-yellow|bg-purple|bg-pink|bg-indigo|bg-orange|bg-teal|bg-cyan/, // semantic colour badges
];

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(tsx?|jsx?)$/.test(e)) files.push(p);
  }
  return files;
}

const files = walk(SRC);
const findings = [];

for (const file of files) {
  const rel = file.replace(join(SRC, "..") + "/", "");
  if (SKIP_FILES.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (LINE_ALLOW.some((rx) => rx.test(line))) {
      // Line has a known-legit hex/utility — but there might be a different
      // finding elsewhere on the line. Check hex separately.
    }
    // Hex findings
    const hex = line.match(HEX_PATTERN);
    if (hex) {
      for (const h of hex) {
        // Skip brand hex
        if (/#(?:4FC52E|2E7D1B|7BE35C|13B7F5|0A6F9E|5FD0FB|0E84C7|1F8B3A|16702D|5FC97E)/i.test(h)) continue;
        findings.push({ file: rel, line: i + 1, kind: "hex", token: h, ctx: line.trim().slice(0, 90) });
      }
    }
    // Named neutral utilities on structural surfaces
    const named = line.match(NAMED_PATTERN);
    if (named) {
      for (const n of named) {
        // Skip opacity variants (bg-black/40 style are covered by LINE_ALLOW already)
        // Skip text-white / border-white — often on top of a coloured accent surface
        if (/^text-(?:white|black)$/.test(n)) continue;
        if (/^border-white$/.test(n)) continue;
        findings.push({ file: rel, line: i + 1, kind: "named", token: n, ctx: line.trim().slice(0, 90) });
      }
    }
  }
}

console.log(`\naudit-hardcoded-themes — scan of ${files.length} files\n`);
console.log(`Total findings: ${findings.length}\n`);

// Group by file
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

for (const [file, entries] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${file}  (${entries.length})`);
  for (const e of entries.slice(0, 8)) {
    console.log(`    L${e.line}  ${e.token.padEnd(30)}  ${e.ctx}`);
  }
  if (entries.length > 8) console.log(`    …${entries.length - 8} more`);
}

process.exit(findings.length ? 1 : 0);
