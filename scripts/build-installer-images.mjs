#!/usr/bin/env node
/**
 * Convert installer brand SVGs to BMP files NSIS expects.
 *
 * NSIS MUI2 needs:
 *   - Header BMP: 150x57  (top banner of inner pages)
 *   - Sidebar BMP: 164x314 (left panel of welcome/finish pages)
 *
 * Outputs to src-tauri/installer/ (referenced from tauri.conf.json).
 *
 * Run: node scripts/build-installer-images.mjs
 *
 * Required deps (added at workspace root): @resvg/resvg-js, jimp
 */

import { Resvg } from "@resvg/resvg-js";
import { Jimp } from "jimp";
import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "src-tauri/installer");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const targets = [
  { svg: "installer-header.svg",  bmp: "header.bmp",  w: 150, h: 57  },
  { svg: "installer-sidebar.svg", bmp: "sidebar.bmp", w: 164, h: 314 },
];

for (const t of targets) {
  const svgPath = resolve(ROOT, "brand", t.svg);
  const svgBuf = readFileSync(svgPath);

  // Render at 2x for sharper output, then downscale
  const resvg = new Resvg(svgBuf, {
    fitTo: { mode: "width", value: t.w * 2 },
    background: "#0F172A",
  });
  const pngBuf = resvg.render().asPng();

  const img = await Jimp.read(pngBuf);
  img.resize({ w: t.w, h: t.h });
  await img.write(resolve(OUT, t.bmp));

  const size = statSync(resolve(OUT, t.bmp)).size;
  console.log(`✓ ${t.bmp.padEnd(12)} ${t.w}x${t.h}  ${(size / 1024).toFixed(1)} KB`);
}
