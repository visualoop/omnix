/**
 * Toast notification settings.
 *
 * Stored in localStorage so they apply globally without DB round-trips.
 * Simple wrapper around `sonner` toast primitives that respects user prefs.
 */
import { toast as sonnerToast, type ExternalToast } from "sonner";

const KEY = "omnix-toast-settings";

export interface ToastSettings {
  enabled: boolean;
  sound: boolean;
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  duration: number; // milliseconds
}

const DEFAULTS: ToastSettings = {
  enabled: true,
  sound: false,
  position: "bottom-right",
  duration: 4000,
};

export function getToastSettings(): ToastSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setToastSettings(s: Partial<ToastSettings>): void {
  const merged = { ...getToastSettings(), ...s };
  localStorage.setItem(KEY, JSON.stringify(merged));
  // Trigger a custom event so the Toaster can re-mount with new position
  window.dispatchEvent(new CustomEvent("toast-settings-changed", { detail: merged }));
}

function playBeep(success = true) {
  if (!getToastSettings().sound) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 220;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

/** Drop-in replacement for `toast` that respects settings. */
export const toast = {
  success(msg: string, opts?: ExternalToast) {
    if (!getToastSettings().enabled) return;
    playBeep(true);
    return sonnerToast.success(msg, { duration: getToastSettings().duration, ...opts });
  },
  error(msg: string, opts?: ExternalToast) {
    if (!getToastSettings().enabled) return;
    playBeep(false);
    return sonnerToast.error(msg, { duration: getToastSettings().duration, ...opts });
  },
  info(msg: string, opts?: ExternalToast) {
    if (!getToastSettings().enabled) return;
    return sonnerToast(msg, { duration: getToastSettings().duration, ...opts });
  },
  message(msg: string, opts?: ExternalToast) {
    if (!getToastSettings().enabled) return;
    return sonnerToast(msg, { duration: getToastSettings().duration, ...opts });
  },
};
