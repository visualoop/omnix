import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

// Extract inner-svg from scenes.tsx in the simplest way: read it, then for
// each named scene, slice between '<svg ...>' and '</svg>'.
const src = readFileSync(join(__dirname, "../website/src/components/marketing/illustrations/scenes.tsx"), "utf8");
const scenes = [
  ["PlatformScene", "480 280"],
  ["ReceiptToKraScene", "480 200"],
  ["MigrationScene", "480 220"],
  ["SecurityScene", "480 240"],
];

function extract(name) {
  const idx = src.indexOf(`export function ${name}`);
  const open = src.indexOf("<svg", idx);
  const close = src.indexOf("</svg>", open) + "</svg>".length;
  let svg = src.slice(open, close);
  // Replace JSX attribute spreads + camelCase attrs
  svg = svg.replace(/\{\.\.\.SCENE_PROPS\}/, 'fill="none" stroke="#C77B3F" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"');
  svg = svg.replace(/\{\.\.\.p\}/g, "");
  svg = svg.replace(/strokeWidth=/g, "stroke-width=");
  svg = svg.replace(/strokeLinecap=/g, "stroke-linecap=");
  svg = svg.replace(/strokeLinejoin=/g, "stroke-linejoin=");
  svg = svg.replace(/textAnchor=/g, "text-anchor=");
  svg = svg.replace(/fontFamily=/g, "font-family=");
  svg = svg.replace(/fontSize=/g, "font-size=");
  svg = svg.replace(/letterSpacing=/g, "letter-spacing=");
  return svg;
}

const cells = scenes.map(([n]) => `<div class="cell"><div class="ico">${extract(n)}</div><div class="lbl">${n}</div></div>`).join("");
const html = `<!doctype html><html><head><style>
  body{margin:0;background:#0B0907;font-family:system-ui;color:#9A8E78}
  .wrap{padding:32px;display:grid;gap:24px;max-width:720px;margin:0 auto}
  .cell{border:1px solid #2C2620;background:#15110D;border-radius:10px;padding:20px}
  .ico svg{width:100%;height:auto;display:block;color:#C77B3F}
  .lbl{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#9A8E78;margin-top:10px}
</style></head><body><div class="wrap">${cells}</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, "scenes.png"), fullPage: true });
await browser.close();
console.log("done");
