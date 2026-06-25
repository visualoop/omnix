/**
 * UI density store + hook.
 *
 * Two modes:
 *   - "comfortable" → default desktop sizing (h-8 inputs, h-9 buttons)
 *   - "touch"       → bumped to ≥44px targets for tablet/touchscreen POS use
 *
 * Resolution order:
 *   1. Explicit user preference (settings.ui.density) — overrides everything
 *   2. Auto-detect: matchMedia('(pointer: coarse)') AND viewport < 1280px → "touch"
 *   3. Fall back to "comfortable"
 *
 * The store also exposes a `setDensity` to flip mode from Settings → Display
 * and a `loadFromSettings()` called once on app boot. The current density
 * is mirrored to `<html data-density="…">` so Tailwind variant selectors
 * can target it via `data-[density=touch]:min-h-11`.
 */
import { create } from "zustand"
import { execute, query } from "@/lib/db"

export type Density = "comfortable" | "touch"

const SETTING_KEY = "ui.density"

interface DensityStore {
  density: Density
  /** Whether the resolution above came from an explicit user toggle. */
  explicit: boolean
  loaded: boolean
  load: () => Promise<void>
  setDensity: (d: Density | "auto") => Promise<void>
}

function detectAuto(): Density {
  if (typeof window === "undefined") return "comfortable"
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false
  const small = window.innerWidth < 1280
  return coarse && small ? "touch" : "comfortable"
}

function applyToDom(d: Density) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.density = d
}

export const useDensityStore = create<DensityStore>((set) => ({
  density: "comfortable",
  explicit: false,
  loaded: false,

  load: async () => {
    let stored: string | null = null
    try {
      const rows = await query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?1",
        [SETTING_KEY],
      )
      stored = rows[0]?.value ?? null
    } catch {
      // settings table cold (first boot); fall through to auto-detect
    }
    let resolved: Density
    let explicit = false
    if (stored === "comfortable" || stored === "touch") {
      resolved = stored
      explicit = true
    } else {
      resolved = detectAuto()
    }
    applyToDom(resolved)
    set({ density: resolved, explicit, loaded: true })

    // Live-respond to pointer-type changes when in auto mode (e.g.
    // user plugs in a mouse while in tablet mode).
    if (!explicit && typeof window !== "undefined") {
      const mq = window.matchMedia("(pointer: coarse)")
      const reactor = () => {
        const next = detectAuto()
        applyToDom(next)
        set({ density: next })
      }
      mq.addEventListener?.("change", reactor)
    }
  },

  setDensity: async (d) => {
    if (d === "auto") {
      try {
        await execute(
          "DELETE FROM settings WHERE key = ?1",
          [SETTING_KEY],
        )
      } catch {
        // ignored — fresh installs may not have the row yet
      }
      const next = detectAuto()
      applyToDom(next)
      set({ density: next, explicit: false })
      return
    }
    try {
      await execute(
        `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'ui')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [SETTING_KEY, d],
      )
    } catch {
      // best-effort persist; UI still reflects the choice in memory
    }
    applyToDom(d)
    set({ density: d, explicit: true })
  },
}))

/** Reactive density value. Memoised by Zustand. */
export function useDensity(): Density {
  return useDensityStore((s) => s.density)
}

/** True when density === "touch" — convenience selector. */
export function useIsTouch(): boolean {
  return useDensityStore((s) => s.density === "touch")
}
