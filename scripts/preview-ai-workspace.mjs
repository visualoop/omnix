/**
 * Visual QA for the /ai workspace layout — static HTML mirror of the page
 * structure (chat column + insights rail + empty-state prompts) so I can
 * eyeball spacing/hierarchy before trusting it in the app. Dev aid only.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const prompts = [
  "What should I focus on this week?",
  "What made the most profit this month?",
  "What should I reorder, and how much?",
  "Which customers have stopped buying?",
  "Why did revenue change this week?",
  "Which products are priced below cost?",
];
const findings = [
  ["bg-red-500", "2 products priced below cost", "Each sale loses money. First: Maziwa 500ml (buy 55, sell 50)."],
  ["bg-amber-500", "Amoxicillin runs out in ~3 days", "Selling ~12/day with 34 left. Suggested order: 180 from Dawa Ltd."],
  ["bg-amber-500", "4 batches expiring within 30 days", "KES 18,400 of stock at risk. Earliest: Panadol in 9 days."],
  ["bg-neutral-400", "9 dead-stock items worth KES 84,200", "Capital tied up in stock idle 60+ days. Biggest: Wall clock."],
];

const html = `<!doctype html><html><head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body{font-family:Inter,system-ui,sans-serif}</style>
</head><body class="bg-white text-neutral-900">
  <div class="flex h-[760px]">
    <!-- chat column -->
    <div class="flex-1 flex flex-col min-w-0">
      <div class="px-6 h-14 flex items-center gap-2 border-b border-neutral-200">
        <div class="rounded-full bg-blue-50 p-1.5"><div class="h-4 w-4 bg-blue-600 rounded-sm"></div></div>
        <div class="leading-tight"><div class="text-sm font-semibold">Omnix AI</div>
          <div class="text-[11px] text-neutral-500">Ask your data · get recommendations · take confirmed actions</div></div>
      </div>
      <div class="flex-1 overflow-y-auto px-6 py-6">
        <div class="max-w-2xl mx-auto">
          <h1 class="text-2xl font-semibold tracking-tight">How can I help run the business?</h1>
          <p class="text-sm text-neutral-500 mt-2">I answer from your live data — sales, stock, customers, suppliers — and can prepare actions for you to approve. Try one:</p>
          <div class="grid sm:grid-cols-2 gap-2 mt-5">
            ${prompts.map((p) => `<button class="text-left text-sm rounded-lg border border-neutral-200 px-3.5 py-3 hover:bg-neutral-50">${p}</button>`).join("")}
          </div>
        </div>
      </div>
      <div class="border-t border-neutral-200 p-4">
        <div class="max-w-2xl mx-auto relative rounded-2xl border border-neutral-200">
          <div class="px-4 py-3 text-sm text-neutral-400">Ask about sales, stock, customers, suppliers…</div>
          <div class="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">↑</div>
        </div>
        <p class="max-w-2xl mx-auto text-[10px] text-neutral-400 mt-2 px-1">Grounded in your live data · actions need your approval · AI may make mistakes</p>
      </div>
    </div>
    <!-- insights rail -->
    <aside class="w-96 flex flex-col border-l border-neutral-200">
      <div class="px-5 h-14 flex items-center border-b border-neutral-200">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">Needs attention</h2>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        ${findings.map(([dot, head, detail]) => `
          <div class="rounded-lg border border-neutral-200 p-3">
            <div class="flex items-start gap-2">
              <span class="mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}"></span>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium leading-snug">${head}</p>
                <p class="text-[12px] text-neutral-500 mt-0.5 leading-snug">${detail}</p>
                <div class="flex items-center gap-3 mt-2">
                  <span class="text-[11px] text-blue-600">✨ Ask</span>
                  <span class="text-[11px] text-neutral-500">Open →</span>
                </div>
              </div>
            </div>
          </div>`).join("")}
      </div>
    </aside>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "ai-workspace.png") });
await browser.close();
console.log("wrote", join(outDir, "ai-workspace.png"));
