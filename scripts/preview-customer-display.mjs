import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

// Omnix hex-ring mark (simplified inline copy for preview only).
const omnixMark = `<svg width="36" height="36" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0F172A"/><stop offset="55%" stop-color="#1E3A8A"/><stop offset="100%" stop-color="#1E40AF"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#bg)"/><g fill="#fff"><circle cx="256" cy="120" r="38"/><circle cx="392" cy="190" r="38"/><circle cx="392" cy="330" r="38"/><circle cx="256" cy="400" r="38"/><circle cx="120" cy="330" r="38"/><circle cx="120" cy="190" r="38"/></g><circle cx="256" cy="256" r="42" fill="#fff"/></svg>`;

const brandBlock = (label) => `
  <div style="display:flex;align-items:center;gap:12px;">
    ${omnixMark}
    <div style="line-height:1.25;">
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span style="font-weight:600;font-size:18px;letter-spacing:-0.01em;color:#fff;">Omnix</span>
        <span style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;color:#a8a29e;">${label}</span>
      </div>
      <div style="font-size:11px;color:#78716c;">POS • Inventory • Accounting</div>
      <div style="font-size:11px;font-family:ui-monospace,monospace;color:#78716c;">www.blyss.co.ke</div>
    </div>
  </div>`;

const businessBadge = (name) => `
  <div style="line-height:1.25;">
    <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:#78716c;">Welcome to</div>
    <div style="font-size:16px;font-weight:600;color:#fff;">${name}</div>
  </div>`;

const html = `<!doctype html><html><head><style>
  body { margin:0; font-family:Inter,system-ui,sans-serif; background:#0c0a09; }
  .frame { position:relative; height:360px; margin:24px; border-radius:16px; overflow:hidden;
    background:#1c1917; border:1px solid #292524; }
  .top { position:absolute; top:0; left:0; right:0; padding:20px;
    background:linear-gradient(to bottom, rgba(12,10,9,0.8), transparent); }
  .bottom { position:absolute; bottom:0; left:0; right:0; padding:20px;
    background:linear-gradient(to top, rgba(12,10,9,0.95), transparent);
    display:flex; align-items:flex-end; justify-content:space-between; }
  .center { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    color:#57534e; font-size:13px; }
  .clock { font-family:ui-monospace,monospace; color:#a8a29e; font-size:14px; }
</style></head><body>
  <div class="frame">
    <div class="top">${businessBadge("Afya Bora Chemist")}</div>
    <div class="center">— idle: video playlist plays here —</div>
    <div class="bottom">${brandBlock("Dawa Pharmacy")}<span class="clock">14:32</span></div>
  </div>
  <div class="frame">
    <div class="top">${businessBadge("Mama Njeri Hardware")}</div>
    <div class="center">— live sale: cart + totals here —</div>
    <div class="bottom">${brandBlock("Hardware")}<span class="clock">14:33</span></div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 840 } });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(outDir, "customer-display-branding.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("Wrote", out);
