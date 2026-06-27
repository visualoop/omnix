/**
 * Customer-facing display window helper.
 *
 * Opens a second Tauri WebView positioned for the customer-facing screen.
 * Cart state syncs automatically because both windows share the same SQLite
 * database and zustand-persist localStorage. The cart store uses storage events
 * to live-sync across windows.
 */
import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";

const DISPLAY_LABEL = "customer-display";
const QUEUE_LABEL = "customer-display-queue";

export async function openCustomerDisplay(): Promise<void> {
  // Check if already open
  const existing = await getAllWebviewWindows();
  const found = existing.find((w) => w.label === DISPLAY_LABEL);
  if (found) {
    await found.setFocus();
    return;
  }

  const win = new WebviewWindow(DISPLAY_LABEL, {
    url: "/customer-display",
    title: "Customer Display",
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    decorations: true,
    resizable: true,
    fullscreen: false,
    center: false,
    // Position to the right of primary display by default — user can drag to second monitor
    x: 200,
    y: 100,
  });

  return new Promise((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (e) => reject(e));
  });
}

/** Open the queue-board variant — for hospitality, this shows live KOT
 *  status (PREPARING / READY columns) across all active orders, sized
 *  for a wall-mounted screen. */
export async function openCustomerDisplayQueue(): Promise<void> {
  const existing = await getAllWebviewWindows();
  const found = existing.find((w) => w.label === QUEUE_LABEL);
  if (found) { await found.setFocus(); return; }
  const win = new WebviewWindow(QUEUE_LABEL, {
    url: "/customer-display/queue",
    title: "Order board",
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    decorations: true,
    resizable: true,
    fullscreen: false,
    center: false,
    x: 240,
    y: 140,
  });
  return new Promise((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (e) => reject(e));
  });
}

export async function closeCustomerDisplayQueue(): Promise<void> {
  const existing = await getAllWebviewWindows();
  const found = existing.find((w) => w.label === QUEUE_LABEL);
  if (found) await found.close();
}

export async function closeCustomerDisplay(): Promise<void> {
  const existing = await getAllWebviewWindows();
  const found = existing.find((w) => w.label === DISPLAY_LABEL);
  if (found) await found.close();
}

export async function isCustomerDisplayOpen(): Promise<boolean> {
  const existing = await getAllWebviewWindows();
  return existing.some((w) => w.label === DISPLAY_LABEL);
}

/**
 * Toggle full-screen on the customer display (typically you want it fullscreen
 * on the second monitor for an unobstructed customer view).
 */
export async function toggleDisplayFullscreen(): Promise<void> {
  const existing = await getAllWebviewWindows();
  const found = existing.find((w) => w.label === DISPLAY_LABEL);
  if (!found) return;
  const fs = await found.isFullscreen();
  await found.setFullscreen(!fs);
}
