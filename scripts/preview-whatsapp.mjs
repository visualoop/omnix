import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const wa = `<svg viewBox="0 0 32 32" width="32" height="32" fill="currentColor"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.9 1 1-4.8-.2-.4C5.5 18.3 5 16.7 5 15c0-6.1 5-11 11-11s11 4.9 11 11-4.9 10.8-11 10.8z"/></svg>`;

const html = `<!doctype html><html><head><style>
  body { margin:0; font-family:Inter,system-ui,sans-serif; background:#faf9f7; height:600px; position:relative; }
  .hint { padding:40px; color:#78716c; }
  .wrap { position:fixed; bottom:20px; right:20px; }
  .panel { margin-bottom:12px; width:330px; border-radius:16px; overflow:hidden; border:1px solid rgba(0,0,0,0.1); box-shadow:0 20px 50px rgba(0,0,0,0.25); background:#fff; }
  .hdr { display:flex; align-items:center; gap:12px; background:#075E54; color:#fff; padding:12px 16px; }
  .av { display:grid; place-items:center; width:40px; height:40px; border-radius:99px; background:rgba(255,255,255,0.15); }
  .thread { background:#ECE5DD; padding:16px 12px; min-height:120px; }
  .bubble { max-width:85%; border-radius:8px; border-top-left-radius:0; background:#fff; padding:8px 12px; font-size:13px; color:#292524; box-shadow:0 1px 1px rgba(0,0,0,0.08); }
  .composer { display:flex; align-items:center; gap:8px; border-top:1px solid rgba(0,0,0,0.05); padding:8px; }
  .composer input { flex:1; border-radius:99px; border:1px solid #e7e5e4; background:#fafaf9; padding:8px 16px; font-size:13px; }
  .send { display:grid; place-items:center; width:40px; height:40px; border-radius:99px; background:#25D366; color:#fff; }
  .fab { display:grid; place-items:center; width:56px; height:56px; border-radius:99px; background:#25D366; color:#fff; box-shadow:0 10px 30px rgba(0,0,0,0.25); margin-left:auto; }
</style></head><body>
  <div class="hint">Marketing page content…</div>
  <div class="wrap">
    <div class="panel">
      <div class="hdr"><div class="av">${wa}</div><div style="line-height:1.2"><div style="font-size:14px;font-weight:600;">Omnix</div><div style="font-size:11px;opacity:0.8;">Typically replies in minutes</div></div><div style="margin-left:auto;opacity:0.8;">✕</div></div>
      <div class="thread"><div class="bubble">Hi! 👋 Ask us anything about Omnix — pricing, M-Pesa setup, eTIMS, or a demo. We usually reply within minutes.</div></div>
      <div class="composer"><input placeholder="Type a message…" value="How do I set up M-Pesa?"><div class="send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></div></div>
    </div>
    <div class="fab">${wa}</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(outDir, "whatsapp-widget.png");
await page.screenshot({ path: out });
await browser.close();
console.log("Wrote", out);
