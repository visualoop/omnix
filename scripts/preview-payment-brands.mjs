/**
 * One-off visual QA: render the payment-brand SVGs into a single PNG
 * so I can eyeball fidelity before wiring them into the modal.
 *
 * Run: node scripts/preview-payment-brands.mjs
 * Output: scripts/.preview/payment-brands.png
 *
 * Not part of the build — just a dev aid.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, ".preview");
mkdirSync(outDir, { recursive: true });

// Inline copies of the SVG markup (kept in sync with payment-brands.tsx
// by hand — this is only a dev preview, not the source of truth).
const svgs = {
  "M-Pesa": `<svg width="56" height="56" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FC52E"/><stop offset="1" stop-color="#3FA323"/></linearGradient></defs><rect width="40" height="40" rx="9" fill="url(#g)"/><path d="M9 27 V16.5 C9 14.6 10.4 13.2 12.3 13.2 C13.8 13.2 15 14 15.5 15.2 C16 14 17.2 13.2 18.7 13.2 C20.6 13.2 22 14.6 22 16.5 V27 H18.7 V17.3 C18.7 16.7 18.3 16.3 17.7 16.3 C17.1 16.3 16.7 16.7 16.7 17.3 V27 H14.3 V17.3 C14.3 16.7 13.9 16.3 13.3 16.3 C12.7 16.3 12.3 16.7 12.3 17.3 V27 Z" fill="#fff"/><circle cx="27.5" cy="24.5" r="2.6" fill="#E2231A"/></svg>`,
  "Paystack": `<svg width="56" height="56" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#011B33"/><g fill="#13B7F5"><rect x="9" y="11" width="22" height="3.4" rx="1.2"/><rect x="9" y="17" width="16" height="3.4" rx="1.2"/><rect x="9" y="23" width="22" height="3.4" rx="1.2"/><rect x="9" y="29" width="9" height="3.4" rx="1.2"/></g></svg>`,
  "Visa": `<svg width="56" height="36" viewBox="0 0 40 26"><rect width="40" height="26" rx="4" fill="#1A1F71"/><text x="20" y="17.5" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-style="italic" font-size="13" letter-spacing="0.5" fill="#fff">VISA</text><rect x="5" y="20.5" width="30" height="1.8" fill="#F7B600" rx="0.9"/></svg>`,
  "Mastercard": `<svg width="56" height="36" viewBox="0 0 40 26"><defs><radialGradient id="o" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FF8A00"/><stop offset="1" stop-color="#FF5F00"/></radialGradient></defs><rect width="40" height="26" rx="4" fill="#16140F"/><circle cx="16.5" cy="13" r="7.5" fill="#EB001B"/><circle cx="23.5" cy="13" r="7.5" fill="#F79E1B"/><path d="M20 7.2 a7.5 7.5 0 0 1 0 11.6 a7.5 7.5 0 0 1 0 -11.6 Z" fill="url(#o)"/></svg>`,
  "Cash": `<svg width="56" height="56" viewBox="0 0 40 40"><rect x="3" y="10" width="34" height="20" rx="3" fill="#1F8B3A"/><rect x="3" y="10" width="34" height="20" rx="3" fill="none" stroke="#16702D" stroke-width="0.8"/><circle cx="20" cy="20" r="5.5" fill="#fff"/><text x="20" y="22.4" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="5.5" fill="#1F8B3A">KES</text></svg>`,
  "Card": `<svg width="56" height="36" viewBox="0 0 40 26"><defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A3148"/><stop offset="1" stop-color="#161B2C"/></linearGradient><linearGradient id="chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4D58D"/><stop offset="1" stop-color="#C99A3A"/></linearGradient></defs><rect width="40" height="26" rx="4" fill="url(#c)"/><rect x="5" y="8" width="7" height="5.4" rx="1.1" fill="url(#chip)"/><g stroke="#9BA4C7" stroke-width="1" fill="none" stroke-linecap="round"><path d="M15 9 q2 2 0 4"/><path d="M17.5 7.5 q3.5 3.5 0 7"/></g><rect x="5" y="18" width="9" height="2" rx="1" fill="#9BA4C7"/><rect x="16" y="18" width="9" height="2" rx="1" fill="#9BA4C7" opacity="0.7"/></svg>`,
  "Bank": `<svg width="56" height="56" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#1A2438"/><path d="M20 8 L31 14 H9 Z" fill="#9BA4C7"/><g fill="#9BA4C7"><rect x="10" y="16" width="2.6" height="11"/><rect x="15.5" y="16" width="2.6" height="11"/><rect x="21.9" y="16" width="2.6" height="11"/><rect x="27.4" y="16" width="2.6" height="11"/></g><rect x="8" y="28" width="24" height="2.6" rx="1" fill="#9BA4C7"/></svg>`,
  "Insurance": `<svg width="56" height="56" viewBox="0 0 40 40"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22B0F0"/><stop offset="1" stop-color="#0E84C7"/></linearGradient></defs><path d="M20 5 L32 10 V19 C32 27 26.5 32.8 20 35 C13.5 32.8 8 27 8 19 V10 Z" fill="url(#s)"/><path d="M14 20 L18 24 L26.5 15.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "Credit": `<svg width="56" height="56" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#3A2F1A"/><rect x="9" y="12" width="22" height="16" rx="2" fill="none" stroke="#E2B658" stroke-width="1.6"/><line x1="13" y1="18" x2="27" y2="18" stroke="#E2B658" stroke-width="1.4" stroke-linecap="round"/><line x1="13" y1="22" x2="22" y2="22" stroke="#E2B658" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/></svg>`,
};

const cells = Object.entries(svgs).map(([name, svg]) => `
  <div class="cell">
    <div class="ico">${svg}</div>
    <div class="lbl">${name}</div>
  </div>`).join("");

const html = `<!doctype html><html><head><style>
  body { margin:0; background:#fff; font-family:Inter, system-ui, sans-serif; }
  .grid { display:grid; grid-template-columns:repeat(5,1fr); gap:24px; padding:32px; }
  .cell { display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px; border:1px solid #eee; border-radius:12px; }
  .lbl { font-size:12px; color:#444; }
  .dark { background:#0c0c0e; }
  .dark .cell { border-color:#222; }
  .dark .lbl { color:#bbb; }
</style></head><body>
  <div class="grid">${cells}</div>
  <div class="grid dark">${cells}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 600 } });
await page.setContent(html, { waitUntil: "networkidle" });
const out = join(outDir, "payment-brands.png");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("Wrote", out);
