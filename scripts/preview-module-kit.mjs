/**
 * Visual QA for the module UI kit — renders the masthead + KPI tiles in all
 * four module accents (teal/amber/orange/rose) so I can eyeball the identity
 * system before wiring it into pages. Uses Tailwind CDN to mirror the classes.
 *
 * Run: node scripts/preview-module-kit.mjs
 * Output: scripts/.preview/module-kit.png   (dev aid, gitignored)
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const modules = [
  { eyebrow: "Dawa · Pharmacy", title: "Prescriptions", rule: "bg-teal-600", text: "text-teal-700", sub: "Dispense, label, and track every script.", stats: [["Scripts today", "18"], ["Awaiting dispense", "4"], ["Expiring (90d)", "12", "danger"]] },
  { eyebrow: "Retail", title: "Retail Dashboard", rule: "bg-amber-600", text: "text-amber-700", sub: "Brand performance, laybys, shrinkage.", stats: [["Revenue", "KES 248,500"], ["Orders", "132"], ["Layby owed", "KES 41,200"]] },
  { eyebrow: "Hardware", title: "Quotations", rule: "bg-orange-600", text: "text-orange-700", sub: "Quote contractors; convert to sales.", stats: [["Open quotes", "9"], ["Receivables", "KES 612,000"], ["Overdue 90+", "KES 88,000", "danger"]] },
  { eyebrow: "Hospitality", title: "Floor", rule: "bg-rose-600", text: "text-rose-700", sub: "Tables, kitchen, folios in one view.", stats: [["Covers", "64"], ["Open tabs", "11"], ["Avg ticket", "KES 1,840"]] },
];

const tile = ([label, value, tone]) => `
  <div class="relative overflow-hidden rounded-md border border-neutral-200 bg-white p-4">
    <span class="absolute inset-x-0 top-0 h-0.5 ${tone === "danger" ? "bg-red-500" : "RULE"}"></span>
    <span class="text-[11px] uppercase tracking-wide text-neutral-500">${label}</span>
    <p class="text-2xl font-semibold mt-2 font-mono tabular-nums ${tone === "danger" ? "text-red-600" : "text-neutral-900"}">${value}</p>
  </div>`;

const section = (m) => `
  <div class="mb-10">
    <div class="flex items-stretch gap-3 mb-5">
      <span class="w-1 rounded-full ${m.rule}"></span>
      <div>
        <div class="text-[11px] font-medium uppercase tracking-[0.14em] ${m.text}">${m.eyebrow}</div>
        <h1 class="text-[22px] leading-tight font-semibold tracking-tight mt-0.5">${m.title}</h1>
        <p class="text-sm text-neutral-500 mt-1">${m.sub}</p>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-3">${m.stats.map(tile).join("").replaceAll("RULE", m.rule)}</div>
  </div>`;

const html = `<!doctype html><html><head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body{font-family:Inter,system-ui,sans-serif}</style>
</head><body class="bg-neutral-50 p-10 max-w-3xl mx-auto">
  ${modules.map(section).join("")}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, "module-kit.png"), fullPage: true });
await browser.close();
console.log("wrote", join(outDir, "module-kit.png"));
