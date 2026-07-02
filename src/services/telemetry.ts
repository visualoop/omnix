/**
 * Crash telemetry — minimal Sentry-shaped client.
 *
 * Design:
 *   - Zero external SDK dependency. Just a fetch POST to our telemetry
 *     endpoint on omnix.co.ke. Adding @sentry/tauri later is a swap-in.
 *   - Opt-out via settings key 'telemetry.enabled' = 'false'.
 *   - PII scrubbed: we never send email, phone, license key, or DB rows.
 *     Only stack trace, version, machine fingerprint (hashed).
 *   - Rate-limited: max 20 reports/hour per install.
 */
import { query } from "@/lib/db";

const ENDPOINT = "https://omnix.co.ke/api/telemetry/crash";
const RATE_KEY = "telemetry.rate.hour";

async function isEnabled(): Promise<boolean> {
  try {
    const rows = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'telemetry.enabled' LIMIT 1`,
    );
    return rows[0]?.value !== "false";
  } catch {
    return true; // default on
  }
}

interface RateWindow {
  hour: string;
  count: number;
}

async function underRateLimit(): Promise<boolean> {
  try {
    const rows = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?1 LIMIT 1`,
      [RATE_KEY],
    );
    const hourNow = new Date().toISOString().slice(0, 13);
    let win: RateWindow = { hour: hourNow, count: 0 };
    if (rows[0]) {
      try { win = JSON.parse(rows[0].value); } catch { /* ignore */ }
    }
    if (win.hour !== hourNow) win = { hour: hourNow, count: 0 };
    return win.count < 20;
  } catch {
    return true;
  }
}

async function bumpRateLimit(): Promise<void> {
  try {
    const { execute } = await import("@/lib/db");
    const hourNow = new Date().toISOString().slice(0, 13);
    const rows = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?1 LIMIT 1`,
      [RATE_KEY],
    );
    let win: RateWindow = { hour: hourNow, count: 0 };
    if (rows[0]) {
      try { win = JSON.parse(rows[0].value); } catch { /* ignore */ }
    }
    if (win.hour !== hourNow) win = { hour: hourNow, count: 0 };
    win.count++;
    await execute(
      `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'telemetry')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [RATE_KEY, JSON.stringify(win)],
    );
  } catch {
    /* ignore */
  }
}

/** Scrub obvious PII from a message / stack. */
function scrub(text: string): string {
  return text
    .replace(/\+?254\d{9}/g, "<phone>")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "<email>")
    .replace(/OMNIX-[A-Z]+-[A-Z0-9-]+/g, "<licence>")
    .replace(/\d{6,}/g, "<num>");
}

/**
 * Report an error. Non-blocking, best-effort.
 * Callers: catch handlers on money-touching paths, top-level error boundary.
 */
export async function reportError(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!(await isEnabled())) return;
  if (!(await underRateLimit())) return;
  await bumpRateLimit();

  const stack = err instanceof Error ? err.stack || err.message : String(err);
  const version = (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0");

  const payload = {
    kind: "error",
    version,
    ts: new Date().toISOString(),
    message: scrub(err instanceof Error ? err.message : String(err)),
    stack: scrub(stack),
    context: scrubContext(context ?? {}),
  };

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Fire-and-forget — never block user flow on telemetry.
    });
  } catch {
    /* ignore */
  }
}

function scrubContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "string") out[k] = scrub(v);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    // Skip objects / arrays to keep payload tiny + PII-safe.
  }
  return out;
}

declare const __APP_VERSION__: string;

/**
 * Wire this into a React ErrorBoundary + window.onerror + window.onunhandledrejection.
 * Call once from AppContent().
 */
export function installGlobalHandlers(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    reportError(e.error ?? e.message).catch(() => {});
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportError(e.reason).catch(() => {});
  });
}
