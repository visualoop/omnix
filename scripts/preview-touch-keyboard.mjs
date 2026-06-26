import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

// Render simple-keyboard with our omnix-kbd skin from CDN to confirm the
// look matches the editorial chrome.
const html = `<!doctype html><html><head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/simple-keyboard@3/build/css/index.css">
  <style>
    :root { --border:0 0% 89%; --card:0 0% 100%; --foreground:0 0% 9%; --muted:0 0% 96%; --accent:0 0% 94%; --primary:221 83% 53%; --primary-foreground:0 0% 100%; }
    body { margin:0; font-family:Inter,system-ui,sans-serif; background:#f5f5f4; height:100vh; }
    .field { margin:24px; padding:14px; border:1px solid #e7e5e4; border-radius:8px; font-size:15px; color:#1c1917; background:#fff; }
    .panel { position:fixed; bottom:0; left:0; right:0; border-top:1px solid hsl(var(--border)); background:rgba(255,255,255,0.95); padding:8px; }
    .simple-keyboard { background:transparent; font-family:inherit; padding:0; }
    .simple-keyboard .hg-row { gap:6px; margin-bottom:6px; }
    .simple-keyboard .hg-button { height:52px; border-radius:8px; border:1px solid hsl(var(--border)); background:hsl(var(--card)); color:hsl(var(--foreground)); box-shadow:none; font-size:18px; font-weight:500; }
    .simple-keyboard .hg-button.hg-functionBtn { background:hsl(var(--muted)); font-size:14px; }
    .simple-keyboard .hg-button[data-skbtn="{enter}"] { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
  </style></head><body>
  <div class="field">Customer name: John Mwangi|</div>
  <div class="panel"><div id="kbd"></div></div>
  <script src="https://cdn.jsdelivr.net/npm/simple-keyboard@3/build/index.modern.js"></script>
  <script>
    const Keyboard = window.SimpleKeyboard.default;
    new Keyboard("#kbd", {
      mergeDisplay:true,
      display:{ "{bksp}":"⌫","{enter}":"return","{shift}":"⇧","{space}":"space","{numbers}":"123" },
      layout:{ default:[ "q w e r t y u i o p", "a s d f g h j k l", "{shift} z x c v b n m {bksp}", "{numbers} {space} {enter}" ] }
    });
  </script>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 420 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const out = join(outDir, "touch-keyboard.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("Wrote", out);
