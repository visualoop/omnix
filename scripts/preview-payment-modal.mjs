import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

const mpesa = `<svg width="26" height="26" viewBox="0 0 40 40"><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FC52E"/><stop offset="1" stop-color="#3FA323"/></linearGradient></defs><rect width="40" height="40" rx="9" fill="url(#mg)"/><path d="M9 27 V16.5 C9 14.6 10.4 13.2 12.3 13.2 C13.8 13.2 15 14 15.5 15.2 C16 14 17.2 13.2 18.7 13.2 C20.6 13.2 22 14.6 22 16.5 V27 H18.7 V17.3 C18.7 16.7 18.3 16.3 17.7 16.3 C17.1 16.3 16.7 16.7 16.7 17.3 V27 H14.3 V17.3 C14.3 16.7 13.9 16.3 13.3 16.3 C12.7 16.3 12.3 16.7 12.3 17.3 V27 Z" fill="#fff"/><circle cx="27.5" cy="24.5" r="2.6" fill="#E2231A"/></svg>`;
const cash = `<svg width="26" height="26" viewBox="0 0 40 40"><rect x="3" y="10" width="34" height="20" rx="3" fill="#1F8B3A"/><circle cx="20" cy="20" r="5.5" fill="#fff"/><text x="20" y="22.4" text-anchor="middle" font-family="Inter" font-weight="800" font-size="5.5" fill="#1F8B3A">KES</text></svg>`;
const paystack = `<svg width="26" height="26" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#011B33"/><g fill="#13B7F5"><rect x="9" y="11" width="22" height="3.4" rx="1.2"/><rect x="9" y="17" width="16" height="3.4" rx="1.2"/><rect x="9" y="23" width="22" height="3.4" rx="1.2"/><rect x="9" y="29" width="9" height="3.4" rx="1.2"/></g></svg>`;
const card = `<svg width="26" height="17" viewBox="0 0 40 26"><rect width="40" height="26" rx="4" fill="#222a40"/><rect x="5" y="8" width="7" height="5.4" rx="1.1" fill="#D4A24C"/><rect x="5" y="18" width="9" height="2" rx="1" fill="#9BA4C7"/><rect x="16" y="18" width="9" height="2" rx="1" fill="#9BA4C7"/></svg>`;

const methodBtn = (icon, name, selected, tintBg, tintRing, tintText) => `
  <button style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;text-align:left;
    border:${selected ? '2px solid transparent' : '1px solid #e7e5e4'};
    ${selected ? `background:${tintBg};box-shadow:0 0 0 2px ${tintRing};` : 'background:#fff;'}">
    ${icon}<span style="font-size:14px;font-weight:500;color:${selected ? tintText : '#1c1917'};">${name}</span>
  </button>`;

const html = `<!doctype html><html><head><style>
  body { margin:0; font-family:Inter,system-ui,sans-serif; background:#f5f5f4; display:flex; gap:24px; padding:24px; }
  .modal { width:440px; background:#fff; border-radius:16px; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.15); }
  .lbl { font-size:10px; font-weight:500; text-transform:uppercase; letter-spacing:0.18em; color:#78716c; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .mono { font-family:ui-monospace,monospace; font-variant-numeric:tabular-nums; }
</style></head><body>
  <div class="modal">
    <div style="font-size:14px;font-weight:600;margin-bottom:16px;">Payment</div>
    <div style="border-bottom:1px solid #e7e5e4;padding-bottom:16px;">
      <div class="grid2">
        <div><div class="lbl">Total due</div><div class="mono" style="font-size:24px;font-weight:700;">5,000.00</div></div>
        <div style="text-align:right;"><div class="lbl">Remaining</div><div class="mono" style="font-size:24px;font-weight:700;">3,000.00</div></div>
      </div>
      <div style="margin-top:12px;height:6px;border-radius:99px;background:rgba(0,0,0,0.08);overflow:hidden;">
        <div style="height:100%;width:40%;background:#22c55e;border-radius:99px;"></div>
      </div>
    </div>
    <div style="padding:16px 0;">
      <div class="lbl" style="margin-bottom:8px;">Pay with</div>
      <div class="grid2" style="margin-bottom:16px;">
        ${methodBtn(cash, "Cash", false)}
        ${methodBtn(mpesa, "M-Pesa", true, "rgba(79,197,46,0.1)", "rgba(79,197,46,0.4)", "#2E7D1B")}
        ${methodBtn(paystack, "Paystack", false)}
        ${methodBtn(card, "Card", false)}
      </div>
      <div class="lbl">Amount (KES)</div>
      <div style="height:56px;border:1px solid #e7e5e4;border-radius:8px;display:flex;align-items:center;padding:0 12px;margin-top:6px;">
        <span class="mono" style="font-size:24px;">3,000.00</span>
      </div>
      <div class="lbl" style="margin-top:16px;">Reference / Transaction code</div>
      <div style="height:44px;border:1px solid #e7e5e4;border-radius:8px;display:flex;align-items:center;padding:0 12px;margin-top:6px;color:#a8a29e;" class="mono">e.g. SLK7A9B2C1</div>
      <div class="lbl" style="margin-top:16px;margin-bottom:8px;">Paid so far</div>
      <div style="display:flex;align-items:center;gap:10px;border:1px solid #e7e5e4;border-radius:8px;padding:8px 12px;">
        ${cash}<div style="flex:1;"><div style="font-size:14px;font-weight:500;">Cash</div></div>
        <span class="mono" style="font-weight:600;">2,000.00</span>
        <span style="color:#a8a29e;font-size:18px;">×</span>
      </div>
    </div>
    <div style="border-top:1px solid #e7e5e4;padding-top:16px;">
      <button style="width:100%;height:48px;border-radius:8px;background:#2563eb;color:#fff;font-size:16px;font-weight:500;border:none;">Add payment · 3,000.00</button>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 520, height: 720 } });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(outDir, "payment-modal.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("Wrote", out);
