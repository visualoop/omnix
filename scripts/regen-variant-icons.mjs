#!/usr/bin/env node
/**
 * Generate desktop and Android icon sets from the Omnix master SVG.
 *
 * Every variant owns a complete reviewed resource tree under
 * `src-tauri/icons/variants/{variant}`. The active variant selected by
 * `VITE_OMNIX_VARIANT` (default: pro) is copied to both Tauri's Android icon
 * source and the committed generated Android project, so `tauri android init`
 * and ordinary builds use the same deterministic artwork.
 *
 * Run: node scripts/regen-variant-icons.mjs (or `pnpm icons`)
 */

import { Resvg } from "@resvg/resvg-js";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICONS_DIR = resolve(ROOT, "src-tauri/icons");
const SOURCE_SVG = resolve(ICONS_DIR, "source.svg");
const ICNS_FALLBACK = resolve(ICONS_DIR, "icon.icns");
const ACTIVE_ANDROID_DIR = resolve(ICONS_DIR, "android");
const GENERATED_ANDROID_RES_DIR = resolve(ROOT, "src-tauri/gen/android/app/src/main/res");

/** Keep in sync with src/lib/variant.ts. */
const VARIANTS = {
  pro:         { dark: "#0F172A", mid: "#1E3A8A", light: "#1E40AF" },
  dawa:        { dark: "#064E3B", mid: "#059669", light: "#34D399" },
  retail:      { dark: "#451A03", mid: "#B45309", light: "#D97706" },
  hospitality: { dark: "#7F1D1D", mid: "#DC2626", light: "#F87171" },
  hardware:    { dark: "#1E3A8A", mid: "#2563EB", light: "#60A5FA" },
  salon:       { dark: "#831843", mid: "#EC4899", light: "#F9A8D4" },
};

const SIZES = [32, 64, 128, 256];
const ICO_FRAMES = [16, 32, 48, 64, 128, 256];
const ANDROID_DENSITIES = [
  { directory: "mipmap-mdpi", launcher: 48, foreground: 108 },
  { directory: "mipmap-hdpi", launcher: 72, foreground: 162 },
  { directory: "mipmap-xhdpi", launcher: 96, foreground: 216 },
  { directory: "mipmap-xxhdpi", launcher: 144, foreground: 324 },
  { directory: "mipmap-xxxhdpi", launcher: 192, foreground: 432 },
];
const ANDROID_XML_FILES = [
  "mipmap-anydpi-v26/ic_launcher.xml",
  "values/ic_launcher_background.xml",
];
const ANDROID_PNG_NAMES = ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"];

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function recolourSvg(svg, accent) {
  return svg
    .replace(/stop-color="#0F172A"/i, `stop-color="${accent.dark}"`)
    .replace(/stop-color="#1E3A8A"/i, `stop-color="${accent.mid}"`)
    .replace(/stop-color="#1E40AF"/i, `stop-color="${accent.light}"`);
}

function roundSvg(svg) {
  return svg
    .replace(
      '<rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>',
      '<circle cx="256" cy="256" r="256" fill="url(#bg)"/>',
    )
    .replace(
      '<rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="url(#shine)"/>',
      '<circle cx="256" cy="256" r="256" fill="url(#shine)"/>',
    );
}

function foregroundSvg(svg) {
  const markStart = svg.indexOf('<g fill="#FFFFFF">');
  const markEnd = svg.lastIndexOf("</svg>");
  if (markStart === -1 || markEnd === -1 || markStart >= markEnd) {
    throw new Error("Could not extract the Omnix mark from source.svg");
  }
  const mark = svg.slice(markStart, markEnd).trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(71.68 71.68) scale(0.72)">${mark}</g>
</svg>`;
}

function renderPng(svgString, size) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

function buildIco(frames) {
  const headerSize = 6;
  const entrySize = 16;
  const directory = Buffer.alloc(headerSize);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(frames.length, 4);

  const entries = [];
  let offset = headerSize + entrySize * frames.length;
  for (const frame of frames) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(frame.size === 256 ? 0 : frame.size, 0);
    entry.writeUInt8(frame.size === 256 ? 0 : frame.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(frame.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += frame.png.length;
  }

  return Buffer.concat([directory, ...entries, ...frames.map((frame) => frame.png)]);
}

function androidResourceFiles() {
  return [
    ...ANDROID_DENSITIES.flatMap(({ directory }) =>
      ANDROID_PNG_NAMES.map((name) => `${directory}/${name}`),
    ),
    ...ANDROID_XML_FILES,
  ];
}

function generateAndroidResources(outDir, squareSvg, circleSvg, accent) {
  rmSync(outDir, { recursive: true, force: true });
  for (const { directory, launcher, foreground } of ANDROID_DENSITIES) {
    const densityDir = resolve(outDir, directory);
    ensureDir(densityDir);
    writeFileSync(resolve(densityDir, "ic_launcher.png"), renderPng(squareSvg, launcher));
    writeFileSync(resolve(densityDir, "ic_launcher_round.png"), renderPng(circleSvg, launcher));
    writeFileSync(resolve(densityDir, "ic_launcher_foreground.png"), renderPng(foregroundSvg(squareSvg), foreground));
  }

  ensureDir(resolve(outDir, "mipmap-anydpi-v26"));
  writeFileSync(
    resolve(outDir, "mipmap-anydpi-v26/ic_launcher.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <background android:drawable="@color/ic_launcher_background"/>
</adaptive-icon>
`,
  );
  ensureDir(resolve(outDir, "values"));
  writeFileSync(
    resolve(outDir, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">${accent.mid}</color>
</resources>
`,
  );
}

function copyAndroidResources(sourceDir, targetDir, replaceTarget) {
  if (replaceTarget) rmSync(targetDir, { recursive: true, force: true });
  for (const relativePath of androidResourceFiles()) {
    const output = resolve(targetDir, relativePath);
    ensureDir(dirname(output));
    copyFileSync(resolve(sourceDir, relativePath), output);
  }
}

const masterSvg = readFileSync(SOURCE_SVG, "utf8");
for (const [variant, accent] of Object.entries(VARIANTS)) {
  const outDir = resolve(ICONS_DIR, "variants", variant);
  ensureDir(outDir);
  const recolouredSvg = recolourSvg(masterSvg, accent);

  for (const size of SIZES) {
    writeFileSync(resolve(outDir, `${size}x${size}.png`), renderPng(recolouredSvg, size));
  }
  writeFileSync(resolve(outDir, "128x128@2x.png"), renderPng(recolouredSvg, 256));
  const icoFrames = ICO_FRAMES.map((size) => ({ size, png: renderPng(recolouredSvg, size) }));
  writeFileSync(resolve(outDir, "icon.ico"), buildIco(icoFrames));
  if (existsSync(ICNS_FALLBACK)) copyFileSync(ICNS_FALLBACK, resolve(outDir, "icon.icns"));

  generateAndroidResources(resolve(outDir, "android"), recolouredSvg, roundSvg(recolouredSvg), accent);
  console.log(`✓ ${variant.padEnd(12)} desktop + Android launcher resources`);
}

const activeVariant = process.env.VITE_OMNIX_VARIANT || "pro";
if (!Object.hasOwn(VARIANTS, activeVariant)) {
  throw new Error(`Unknown VITE_OMNIX_VARIANT '${activeVariant}'. Expected one of: ${Object.keys(VARIANTS).join(", ")}`);
}
const reviewedAndroidDir = resolve(ICONS_DIR, "variants", activeVariant, "android");
copyAndroidResources(reviewedAndroidDir, ACTIVE_ANDROID_DIR, true);
copyAndroidResources(reviewedAndroidDir, GENERATED_ANDROID_RES_DIR, false);

// Tauri's generated template may leave these stock resources behind. They are
// not used by our adaptive icon and retaining them makes regressions ambiguous.
rmSync(resolve(GENERATED_ANDROID_RES_DIR, "drawable-v24/ic_launcher_foreground.xml"), { force: true });
rmSync(resolve(GENERATED_ANDROID_RES_DIR, "drawable/ic_launcher_background.xml"), { force: true });

console.log(`\nActive Android launcher: ${activeVariant}`);
console.log("All variant icon sets generated under src-tauri/icons/variants/");
