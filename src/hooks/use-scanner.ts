/**
 * useScanner — global HID-style barcode-scanner listener.
 *
 * USB barcode scanners in HID mode emit characters at ~1000 chars/sec
 * (gap < 30ms between keys), then end with Enter. Humans type at
 * ~5–10 chars/sec (gap > 100ms). We use the timing gap to tell them
 * apart, buffer the burst, and call `onScan(payload)` when Enter is hit.
 *
 * Properties:
 *   • Active globally — works regardless of which element has focus,
 *     UNLESS that element is a real text input (we let the user type
 *     normally there).
 *   • Min payload length 3 chars filters single-key noise (e.g. someone
 *     hitting Enter in a search box).
 *   • Buffer auto-clears after 100ms of inactivity.
 */
import { useEffect } from "react";

const FAST_KEY_GAP_MS = 30;
const RESET_AFTER_MS = 100;
const MIN_PAYLOAD_LEN = 3;

export interface ScannerOptions {
  /** Disable the listener (e.g. when a modal owns input). */
  enabled?: boolean;
  /** Custom predicate to skip an event (defaults to skip-if-input). */
  skipWhen?: (e: KeyboardEvent) => boolean;
}

function defaultSkip(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useScanner(onScan: (payload: string) => void, opts: ScannerOptions = {}) {
  useEffect(() => {
    if (opts.enabled === false) return;

    let buffer = "";
    let lastTs = -1;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      const payload = buffer;
      buffer = "";
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
      if (payload.length >= MIN_PAYLOAD_LEN) {
        onScan(payload);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // Let typed text into inputs go through unmolested
      const skipFn = opts.skipWhen ?? defaultSkip;
      if (skipFn(e)) {
        // also reset our buffer so a subsequent scan doesn't pick up
        // half a typed string + half a scan
        buffer = "";
        return;
      }

      const now = performance.now();
      const gap = lastTs === -1 ? 0 : now - lastTs;
      lastTs = now;

      // Slow keystroke → not a scan; clear buffer + skip this char so it
      // doesn't pollute the next burst that might follow.
      if (gap > FAST_KEY_GAP_MS && gap < 9999) {
        buffer = "";
        // Allow Enter to flush, but otherwise don't append slow chars
        if (e.key !== "Enter") return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        flush();
        lastTs = -1;
        return;
      }

      // Single printable character → append
      if (e.key.length === 1) {
        buffer += e.key;
        // Auto-reset the buffer if no key arrives within the reset window
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          buffer = "";
          lastTs = -1;
        }, RESET_AFTER_MS);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [onScan, opts.enabled, opts.skipWhen]);
}
