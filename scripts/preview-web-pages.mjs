import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const slug of ["ai", "security", "migration", "roadmap", ""]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const url = `http://localhost:3210/ke${slug ? "/" + slug : ""}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  for (let y = 0; y < 6; y++) { await page.evaluate((i) => window.scrollTo(0, i * window.innerHeight), y); await page.waitForTimeout(200); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const name = slug || "home";
  await page.screenshot({ path: join(outDir, `web-${name}.png`) });
  await page.close();
  console.log("snap", name);
}
await browser.close();
