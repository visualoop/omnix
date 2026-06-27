import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:3210/ke", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
// Scroll to trigger whileInView animations
for (let y = 0; y < 8; y++) {
  await page.evaluate((i) => window.scrollTo(0, i * window.innerHeight), y);
  await page.waitForTimeout(250);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "home-full.png"), fullPage: true });
// Also a viewport hero shot
await page.screenshot({ path: join(outDir, "home-hero.png") });
await browser.close();
console.log("done");
