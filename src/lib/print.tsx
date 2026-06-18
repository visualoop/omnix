import { intlLocale } from "@/lib/intl";
/**
 * Print/Export utilities for reports.
 *
 * Uses native browser print (Ctrl+P) which lets the user "Save as PDF" in
 * the print dialog. This avoids bundling a heavy PDF library while giving
 * professional, paginated output. Print CSS is applied automatically.
 */

const PRINT_CSS = `
  @page { size: A4; margin: 12mm 10mm; }
  @media print {
    /* Defeat the app shell's h-screen + overflow-hidden — those clip
       printed content to one viewport, producing blank pages 2+. */
    html, body, #root {
      height: auto !important;
      overflow: visible !important;
      background: white !important;
    }
    body * {
      /* Strip viewport-locked sizing on shell wrappers. Per-element
         overrides below restore <table>/<pre> behavior where useful. */
      max-height: none !important;
    }
    .h-screen, .w-screen,
    [class*="h-[calc(100vh"], [class*="h-[100vh"] {
      height: auto !important;
      width: auto !important;
    }
    .overflow-hidden, .overflow-auto, .overflow-y-auto, .overflow-x-auto {
      overflow: visible !important;
    }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print, .print-hide { display: none !important; }
    .print-only { display: block !important; }
    aside, header, nav, .topbar { display: none !important; }
    main { padding: 0 !important; overflow: visible !important; }
    .page-break { page-break-before: always; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    /* Force readable text on dark themes */
    body, main, [data-print-area] {
      color: #111 !important;
      background: white !important;
    }
  }
  .print-only { display: none; }
  .print-header {
    display: none;
  }
  @media print {
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8mm;
      margin-bottom: 8mm;
      border-bottom: 2px solid #000;
    }
    .print-header h1 { font-size: 16pt; margin: 0; }
    .print-header .meta { font-size: 9pt; color: #555; text-align: right; }
  }
`;

let injected = false;

export function ensurePrintCss() {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.id = "omnix-print-css";
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
}

/** Trigger the browser print dialog — user can save as PDF. */
export function printPage(title?: string) {
  ensurePrintCss();
  const previous = document.title;
  if (title) document.title = title;
  window.print();
  if (title) {
    setTimeout(() => { document.title = previous; }, 1000);
  }
}

/** Add a print-only header (logo + business + date) to a page.
 *  Hidden on screen via .print-header CSS, shown on print. */
export function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="print-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="meta">{subtitle}</div>}
      </div>
      <div className="meta">
        Generated {new Date().toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}
      </div>
    </div>
  );
}
