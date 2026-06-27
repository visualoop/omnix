import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 720 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3210/ke", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);
// Open the mobile menu (the hamburger has aria-label "Open menu")
await page.locator('button[aria-label="Open menu"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, "mobile-menu-top.png") });
// Scroll the menu container to the bottom
await page.evaluate(() => {
  const el = document.querySelector('div.fixed.inset-x-0[class*="top-"]');
  if (el) el.scrollTo({ top: 9999, behavior: 'instant' });
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "mobile-menu-bottom.png") });
await browser.close();
console.log("done");
