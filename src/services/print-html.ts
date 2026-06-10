/**
 * Print an HTML document via a hidden iframe.
 *
 * Uses the same technique as receipt.ts — works inside Tauri WebView2
 * (where window.open() is blocked) and in regular browsers without
 * triggering pop-up blockers.
 *
 * The provided HTML must be a complete document (with <html>, <head>,
 * <body> and any inline styles needed for the print).
 */
export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not open print frame.");
  }
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Give the print dialog time to render before tearing down the
      // iframe — some browsers cancel the dialog if the source is
      // removed too soon.
      setTimeout(() => iframe.remove(), 2000);
    }, 100);
  };
}
