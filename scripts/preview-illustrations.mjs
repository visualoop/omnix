import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const S = (inner) => `<svg width="52" height="52" viewBox="0 0 48 48" fill="none" stroke="#C77B3F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const marks = {
  platform: `<rect x="8" y="26" width="32" height="14" rx="2"/><path d="M13 26l4-7h14l4 7"/><path d="M18 12h12l3 7H15z" opacity="0.55"/><path d="M8 33h32" opacity="0.4"/><circle cx="14" cy="33" r="1.2"/><circle cx="19" cy="33" r="1.2"/>`,
  ai: `<path d="M9 10h30a2 2 0 012 2v17a2 2 0 01-2 2H20l-7 6v-6h-4a2 2 0 01-2-2V12a2 2 0 012-2z"/><path d="M24 16l1.6 4.4L30 22l-4.4 1.6L24 28l-1.6-4.4L18 22l4.4-1.6z"/>`,
  mpesa: `<rect x="15" y="6" width="18" height="36" rx="3"/><path d="M15 35h18" opacity="0.4"/><circle cx="24" cy="38.5" r="1"/><path d="M20 24l3-3 3 3 3-4"/><path d="M29 17v3h-3"/>`,
  offline: `<circle cx="24" cy="24" r="16"/><path d="M24 14v8l5 3"/><path d="M14 14l20 20" opacity="0.55"/>`,
  updates: `<path d="M37 24a13 13 0 10-3.8 9.2"/><path d="M37 16v8h-8"/><path d="M24 19v10m0 0l-3.5-3.5M24 29l3.5-3.5" opacity="0.7"/>`,
  sync: `<rect x="5" y="13" width="16" height="12" rx="1.5"/><rect x="27" y="23" width="16" height="12" rx="1.5"/><path d="M21 17h6a3 3 0 013 3v3"/><path d="M27 29h-6a3 3 0 01-3-3v-3" opacity="0.6"/>`,
  inventory: `<rect x="9" y="22" width="13" height="13" rx="1.5"/><rect x="26" y="22" width="13" height="13" rx="1.5"/><rect x="17.5" y="9" width="13" height="13" rx="1.5"/><path d="M9 28.5h13M26 28.5h13M17.5 15.5h13" opacity="0.4"/>`,
  analytics: `<path d="M9 39V9" opacity="0.5"/><path d="M9 39h30" opacity="0.5"/><rect x="15" y="27" width="5" height="10"/><rect x="24" y="21" width="5" height="16"/><rect x="33" y="15" width="5" height="22"/><path d="M14 24l8-6 7 4 8-9" opacity="0.7"/>`,
  security: `<path d="M24 6l14 5v9c0 9-6 15.5-14 18-8-2.5-14-9-14-18v-9z"/><path d="M18 23l4.5 4.5L31 19"/>`,
  etims: `<path d="M14 6h20v34l-4-3-3 3-3-3-3 3-3-3-4 3z"/><path d="M19 15h10M19 21h10M19 27h6" opacity="0.55"/><circle cx="31" cy="29" r="5"/><path d="M29 29l1.5 1.5L34 27"/>`,
  purchasing: `<path d="M6 14h20v18H6z"/><path d="M26 20h8l6 6v6H26z"/><circle cx="14" cy="36" r="3"/><circle cx="33" cy="36" r="3"/>`,
  accounting: `<rect x="10" y="7" width="28" height="34" rx="2"/><path d="M16 16h16M16 23h16M16 30h10" opacity="0.55"/><path d="M30 33l2.5 2.5L37 31"/>`,
  pharmacy: `<rect x="13" y="18" width="22" height="13" rx="6.5" transform="rotate(45 24 24)"/><path d="M19 19l10 10" opacity="0.5"/>`,
  retail: `<path d="M9 16h30l-2 6H11z"/><path d="M12 22v17h24V22"/><path d="M19 39V28h10v11" opacity="0.6"/><path d="M9 16l2-7h26l2 7" opacity="0.5"/>`,
  hospitality: `<path d="M16 6v14a3 3 0 01-6 0V6M13 6v34"/><path d="M33 6c-3 0-5 3-5 8s2 7 5 7 5-2 5-7-2-8-5-8zM33 21v19"/>`,
  hardware: `<path d="M30 12a7 7 0 00-9.5 8.5L8 33l4 4 12.5-12.5A7 7 0 0033 15l-4 4-3-3z"/>`,
};
const cells = Object.entries(marks).map(([name, inner]) =>
  `<div class="cell"><div>${S(inner)}</div><div class="lbl">${name}</div></div>`).join("");
const html = `<!doctype html><html><head><style>
  body{margin:0;background:#0B0907;font-family:system-ui}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:32px;width:680px;margin:0 auto;box-sizing:border-box}
  .cell{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 8px;border:1px solid #2C2620;border-radius:10px;background:#15110D}
  .lbl{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#9A8E78}
</style></head><body><div class="grid">${cells}</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 700 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "illustrations.png"), fullPage: true });
await browser.close();
console.log("done");
