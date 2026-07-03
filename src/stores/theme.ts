/**
 * theme.ts — combined theme store.
 *
 * Two independent axes:
 *   • `palette`  — the theme name (classic, cream, nordic, sepia, slate, meadow).
 *                  Sets data-theme on <html>. CSS blocks in index.css match.
 *   • `mode`     — light / dark / system. Sets the .dark class on <html>.
 *                  "system" follows the OS colour scheme.
 *
 * Persisted to localStorage under `omnix-theme` (legacy key) for mode and
 * `omnix.palette` for palette so both survive reload.
 */
import { create } from "zustand";

export const THEMES = [
  { id: "classic", name: "Classic",  description: "Warm off-white • slate dark. The default." },
  { id: "cream",   name: "Cream",    description: "Notion-editorial. Best for long-session reading." },
  { id: "nordic",  name: "Nordic",   description: "Cool bluish snow + polar-night dark." },
  { id: "sepia",   name: "Sepia",    description: "Parchment + walnut. E-reader vibe." },
  { id: "slate",   name: "Slate",    description: "Pure neutral grey. No hue tint." },
  { id: "meadow",  name: "Meadow",   description: "Mint paper + forest dark. Calm." },
] as const;

export type PaletteId = typeof THEMES[number]["id"];
export type Mode = "light" | "dark" | "system";

interface ThemeState {
  /** Legacy: "light" | "dark" | "system". Keep this name so existing
   *  callers keep working — but it now describes light/dark mode only. */
  theme: Mode;
  palette: PaletteId;
  setTheme: (t: Mode) => void;
  setPalette: (p: PaletteId) => void;
}

const readLocal = <T,>(key: string, fallback: T): T => {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readLocal<Mode>("omnix-theme", "system"),
  palette: readLocal<PaletteId>("omnix.palette", "classic"),
  setTheme: (theme) => {
    try { localStorage.setItem("omnix-theme", theme); } catch { /* noop */ }
    applyMode(theme);
    set({ theme });
  },
  setPalette: (palette) => {
    try { localStorage.setItem("omnix.palette", palette); } catch { /* noop */ }
    applyPalette(palette);
    set({ palette });
  },
}));

export function applyMode(mode: Mode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (mode === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(dark ? "dark" : "light");
  } else {
    root.classList.add(mode);
  }
}

export function applyPalette(palette: PaletteId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", palette);
}

/**
 * Call once during app bootstrap so persisted preferences apply BEFORE
 * React first paint. Prevents flash of default theme.
 */
export function bootstrapTheme(): void {
  applyMode(readLocal<Mode>("omnix-theme", "system"));
  applyPalette(readLocal<PaletteId>("omnix.palette", "classic"));
  // Follow OS-level colour scheme changes if the user is on "system".
  if (typeof window !== "undefined" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = readLocal<Mode>("omnix-theme", "system");
      if (current === "system") applyMode("system");
    });
  }
}

// Kick off on module load — belt and suspenders alongside main.tsx bootstrap.
if (typeof window !== "undefined") {
  applyMode(readLocal<Mode>("omnix-theme", "system"));
  applyPalette(readLocal<PaletteId>("omnix.palette", "classic"));
}
