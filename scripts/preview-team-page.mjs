import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const members = [
  { name: "Justin Kariuki", role: "Founder · Engineering", bio: "Builds the desktop app and the licensing core. Nairobi." },
  { name: "Amina Hassan", role: "Product · Pharmacy", bio: "Shapes the Dawa module with practising pharmacists." },
  { name: "Brian Otieno", role: "Support · Onboarding", bio: "Gets shops live on M-Pesa + eTIMS in a day." },
];

const card = (m) => `
  <li style="display:flex;flex-direction:column;">
    <div style="aspect-ratio:3/2;border-radius:12px;background:#f0eee9;border:1px solid #e7e5e4;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:44px;color:#b8b2a7;">${m.name.split(' ').map(w=>w[0]).join('')}</div>
    <div style="margin-top:16px;">
      <h3 style="font-family:Georgia,serif;font-size:18px;font-weight:500;margin:0;color:#1c1917;">${m.name}</h3>
      <p style="font-family:ui-monospace,monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#78716c;margin:4px 0 0;">${m.role}</p>
      <p style="font-size:14px;line-height:1.6;color:#57534e;margin:12px 0 0;">${m.bio}</p>
    </div>
  </li>`;

const html = `<!doctype html><html><head><style>
  body { margin:0; font-family:Inter,system-ui,sans-serif; background:#faf9f7; }
  .hero { padding:64px 48px 32px; }
  .eyebrow { font-family:ui-monospace,monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.18em; color:#a87f4a; }
  h1 { font-family:Georgia,serif; font-size:48px; font-weight:300; margin:16px 0 0; color:#1c1917; }
  h1 em { font-style:italic; }
  .lede { font-size:17px; color:#57534e; max-width:560px; margin:16px 0 0; }
  .grid { list-style:none; padding:0 48px 64px; margin:0; display:grid; grid-template-columns:repeat(3,1fr); gap:32px; }
</style></head><body>
  <div class="hero">
    <span class="eyebrow">Team</span>
    <h1>The people <em>behind Omnix.</em></h1>
    <p class="lede">A small team in Nairobi building the POS Kenyan businesses actually want — M-Pesa, eTIMS, offline-first.</p>
  </div>
  <ul class="grid">${members.map(card).join('')}</ul>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(outDir, "team-page.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("Wrote", out);
