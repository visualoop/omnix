#!/usr/bin/env node
/**
 * Generate variant icon sets from a single master SVG.
 *
 * Reads `src-tauri/icons/source.svg` (the Pro icon — navy gradient).
 * For every variant (pro|dawa|retail|hospitality|hardware), recolours
 * the SVG gradient stops to that variant's accent and renders:
 *
 *   src-tauri/icons/variants/{variant}/
 *     ├── 32x32.png
 *     ├── 64x64.png
 *     ├── 128x128.png
 *     ├── 128x128@2x.png   (256x256)
 *     ├── 256x256.png
 *     └── icon.ico         (multi-resolution PNG-embedded ICO)
 *
 * The `icon.icns` for each variant is copied from the master for now —
 * macOS isn't shipping in v0.4.0, so a single icns is fine.
 *
 * Run:  node scripts/regen-variant-icons.mjs   (or `pnpm icons`)
 */

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICONS_DIR = resolve(ROOT, "src-tauri/icons");
const SOURCE_SVG = resolve(ICONS_DIR, "source.svg");
const ICNS_FALLBACK = resolve(ICONS_DIR, "icon.icns");

/**
 * Variant accents — keep in sync with src/lib/variant.ts.
 *
 * Each variant gets:
 *  - `dark`  : darker gradient anchor (top-left of icon background)
 *  - `mid`   : middle gradient anchor (the recognisable hue)
 *  - `light` : light gradient anchor (bottom-right, brighter)
 *
 * Pro stays as the original navy gradient (the legacy/v0.3.x icon).
 */
const VARIANTS = {
  pro:         { dark: "#0F172A", mid: "#1E3A8A", light: "#1E40AF" }, // navy
  dawa:        { dark: "#042F2E", mid: "#0F766E", light: "#0D9488" }, // teal
  retail:      { dark: "#451A03", mid: "#B45309", light: "#D97706" }, // amber
  hospitality: { dark: "#022C22", mid: "#047857", light: "#10B981" }, // emerald
  hardware:    { dark: "#431407", mid: "#C2410C", light: "#EA580C" }, // orange
  salon:       { dark: "#3B0764", mid: "#7C3AED", light: "#A855F7" }, // purple
};

const SIZES = [32, 64, 128, 256];
const SIZES_2X = [256]; // emitted as `128x128@2x.png` for Tauri's HiDPI naming convention
const ICO_FRAMES = [16, 32, 48, 64, 128, 256]; // sizes baked into icon.ico

function recolourSvg(svg, accent) {
  // The master gradient lives inside a single linearGradient #bg. Replace its
  // three stops with the variant accents. Anything else in the SVG (the gear
  // teeth + center dot) stays solid white.
  return svg
    .replace(/stop-color="#0F172A"/i, `stop-color="${accent.dark}"`)
    .replace(/stop-color="#1E3A8A"/i, `stop-color="${accent.mid}"`)
    .replace(/stop-color="#1E40AF"/i, `stop-color="${accent.light}"`);
}

function renderPng(svgString, size) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

/**
 * Build a PNG-embedded ICO file from a list of PNG buffers + their dimensions.
 * Modern Windows (Vista+) supports PNG inside ICO directly, so we don't have
 * to convert each frame to a BMP.
 *
 * Layout: 6-byte ICONDIR header + 16-byte ICONDIRENTRY per frame + PNG bodies.
 */
function buildIco(frames) {
  const HEADER_SIZE = 6;
  const ENTRY_SIZE = 16;
  const dir = Buffer.alloc(HEADER_SIZE);
  dir.writeUInt16LE(0, 0);                  // reserved
  dir.writeUInt16LE(1, 2);                  // type = 1 (icon)
  dir.writeUInt16LE(frames.length, 4);      // image count

  const entries = [];
  let offset = HEADER_SIZE + ENTRY_SIZE * frames.length;
  for (const f of frames) {
    const e = Buffer.alloc(ENTRY_SIZE);
    e.writeUInt8(f.size === 256 ? 0 : f.size, 0);   // width  (0 means 256)
    e.writeUInt8(f.size === 256 ? 0 : f.size, 1);   // height (0 means 256)
    e.writeUInt8(0, 2);                              // palette count
    e.writeUInt8(0, 3);                              // reserved
    e.writeUInt16LE(1, 4);                           // colour planes
    e.writeUInt16LE(32, 6);                          // bits per pixel
    e.writeUInt32LE(f.png.length, 8);                // image size
    e.writeUInt32LE(offset, 12);                     // image offset
    entries.push(e);
    offset += f.png.length;
  }

  return Buffer.concat([dir, ...entries, ...frames.map((f) => f.png)]);
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

const masterSvg = readFileSync(SOURCE_SVG, "utf8");

for (const [variant, accent] of Object.entries(VARIANTS)) {
  const outDir = resolve(ICONS_DIR, "variants", variant);
  ensureDir(outDir);

  const recolouredSvg = recolourSvg(masterSvg, accent);

  // Standard sizes
  for (const size of SIZES) {
    const png = renderPng(recolouredSvg, size);
    writeFileSync(resolve(outDir, `${size}x${size}.png`), png);
  }

  // HiDPI names Tauri's bundler expects
  for (const size of SIZES_2X) {
    const png = renderPng(recolouredSvg, size);
    // 256x256 source rendered as 128x128@2x.png (Tauri convention)
    writeFileSync(resolve(outDir, `128x128@2x.png`), png);
  }

  // Multi-resolution .ico
  const icoFrames = ICO_FRAMES.map((s) => ({ size: s, png: renderPng(recolouredSvg, s) }));
  const icoBuf = buildIco(icoFrames);
  writeFileSync(resolve(outDir, "icon.ico"), icoBuf);

  // .icns — macOS not in v0.4.0 scope, copy the master as a placeholder so
  // tauri config schema validation passes when --target macos is requested.
  if (existsSync(ICNS_FALLBACK)) {
    copyFileSync(ICNS_FALLBACK, resolve(outDir, "icon.icns"));
  }

  const sizes = [...SIZES.map((s) => `${s}px`), "128@2x", "ico"].join(", ");
  console.log(`✓ ${variant.padEnd(12)} ${sizes}`);
}

console.log("\nAll variant icon sets generated under src-tauri/icons/variants/");
