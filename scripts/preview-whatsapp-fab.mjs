import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const wa = `<svg viewBox="0 0 32 32" width="32" height="32" fill="currentColor"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3z"/></svg>`;
const x = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const fab = (icon) => `<div style="display:grid;place-items:center;width:56px;height:56px;border-radius:99px;background:#25D366;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,0.25);">${icon}</div>`;
const panel = `<div style="margin-bottom:12px;width:330px;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);box-shadow:0 20px 50px rgba(0,0,0,0.25);background:#fff;"><div style="background:#075E54;color:#fff;padding:12px 16px;font-family:Inter;font-size:14px;font-weight:600;">Omnix</div><div style="background:#ECE5DD;height:90px;"></div></div>`;

const frame = (label, inner) => `
  <div style="position:relative;width:480px;height:340px;border:1px dashed #ccc;border-radius:12px;margin:12px;">
    <div style="padding:10px;color:#999;font-family:Inter;font-size:12px;">${label} — note the green button's right edge stays fixed</div>
    <div style="position:absolute;bottom:20px;right:20px;display:flex;flex-direction:column;align-items:flex-end;">${inner}</div>
    <div style="position:absolute;bottom:0;right:20px;width:2px;height:100%;background:rgba(255,0,0,0.25);"></div>
  </div>`;

const html = `<!doctype html><html><head><style>body{margin:0;font-family:Inter,system-ui;background:#faf9f7;display:flex;flex-wrap:wrap;}</style></head><body>
  ${frame("CLOSED", fab(wa))}
  ${frame("OPEN", panel + fab(x))}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1040, height: 380 } });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(outDir, "whatsapp-fab-fixed.png");
await page.screenshot({ path: out });
await browser.close();
console.log("Wrote", out);
