/**
 * use-kds-prefs.ts — persisted preferences for the Kitchen Display Screen.
 *
 * Kitchen tablets are shared devices in a hot, noisy environment. Chefs
 * want fast, chunky text; managers want to filter down to one station;
 * some kitchens want an audio ping on every new ticket. Everyone wants
 * force-dark because bright kitchens have overhead LEDs.
 *
 * Prefs persist to localStorage (per-device) — not to the sqlite settings
 * table, because the KDS is often opened in an incognito browser on a
 * cheap tablet where the sqlite DB isn't available. Falls back to
 * sensible defaults on first load.
 */
import { useCallback, useEffect, useState } from "react";

export type KdsFontSize = "sm" | "md" | "lg" | "xl";
export type KdsColumnMode = "auto" | "2" | "3" | "4";

export interface KdsPrefs {
  stationFilter: string | null;   // null = all stations
  fontSize: KdsFontSize;
  columns: KdsColumnMode;
  audioCue: boolean;
  forceDark: boolean;
}

const DEFAULT_PREFS: KdsPrefs = {
  stationFilter: null,
  fontSize: "md",
  columns: "auto",
  audioCue: true,
  forceDark: false,
};

const STORAGE_KEY = "omnix.kds.prefs";

function load(): KdsPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<KdsPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function save(prefs: KdsPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage full / disabled — just no-op
  }
}

export function useKdsPrefs(): [KdsPrefs, (patch: Partial<KdsPrefs>) => void] {
  const [prefs, setPrefs] = useState<KdsPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(load());
  }, []);

  const update = useCallback((patch: Partial<KdsPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return [prefs, update];
}

/**
 * Tailwind class fragments for each font size — sized for kitchen readability
 * from ~1.5m away.
 */
export const FONT_SIZE_CLS: Record<KdsFontSize, {
  header: string;
  itemName: string;
  itemQty: string;
  notes: string;
  meta: string;
  ticketHeader: string;
}> = {
  sm: {
    header: "text-[13px]",
    itemName: "text-[13.5px]",
    itemQty: "text-[13.5px]",
    notes: "text-[12px]",
    meta: "text-[11px]",
    ticketHeader: "text-[12px]",
  },
  md: {
    header: "text-[15px]",
    itemName: "text-[15.5px]",
    itemQty: "text-[15.5px]",
    notes: "text-[13.5px]",
    meta: "text-[12.5px]",
    ticketHeader: "text-[13px]",
  },
  lg: {
    header: "text-[18px]",
    itemName: "text-[18px]",
    itemQty: "text-[18px]",
    notes: "text-[15px]",
    meta: "text-[14px]",
    ticketHeader: "text-[15px]",
  },
  xl: {
    header: "text-[22px]",
    itemName: "text-[21px]",
    itemQty: "text-[21px]",
    notes: "text-[17px]",
    meta: "text-[16px]",
    ticketHeader: "text-[17px]",
  },
};

/** Two-tone beep used when a new ticket arrives. Web Audio, no assets. */
export function playKdsAudioCue(): void {
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    // First beep — 880Hz
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.frequency.value = 880;
    o1.connect(g1); g1.connect(ctx.destination);
    g1.gain.setValueAtTime(0.001, now);
    g1.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    o1.start(now); o1.stop(now + 0.22);
    // Second beep — 1320Hz, 150ms later
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.frequency.value = 1320;
    o2.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.001, now + 0.15);
    g2.gain.exponentialRampToValueAtTime(0.15, now + 0.17);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    o2.start(now + 0.15); o2.stop(now + 0.40);
    // Auto-close the audio context to release the hardware slot on some browsers
    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 500);
  } catch {
    // silent — audio is a nice-to-have
  }
}
