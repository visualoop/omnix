/**
 * Active country store — single source of truth for the visitor's
 * region. Loaded from settings.country_code on app boot, persisted
 * back to settings whenever the owner changes it (which only happens
 * during initial setup; later changes require a wipe + restart since
 * historical data is denominated in the original currency).
 */
import { create } from "zustand";
import { query, execute } from "@/lib/db";
import { getCountry, type CountryCode, type CountryProfile } from "@/lib/countries";

interface CountryState {
  /** ISO-3166-1 alpha-2 — null until first load completes. */
  code: CountryCode | null;
  loaded: boolean;
  load: () => Promise<void>;
  set: (code: CountryCode) => Promise<void>;
  /** Convenient accessors that don't break before load completes. */
  profile: () => CountryProfile | null;
}

const SETTING_KEY = "country_code";

export const useCountry = create<CountryState>((set, get) => ({
  code: null,
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const rows = await query<{ value: string }>(
        `SELECT value FROM settings WHERE key = ?1`,
        [SETTING_KEY],
      );
      const code = (rows[0]?.value as CountryCode | undefined) ?? "KE";
      set({ code, loaded: true });
    } catch {
      // Settings table may not exist on cold boot — default to KE.
      set({ code: "KE", loaded: true });
    }
  },

  set: async (code) => {
    set({ code, loaded: true });
    try {
      await execute(
        `INSERT INTO settings (key, value, category) VALUES (?1, ?2, 'locale')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [SETTING_KEY, code],
      );
    } catch {
      // Non-fatal — UI state still reflects the choice. User will
      // re-pick on next launch if persistence fails.
    }
  },

  profile: () => {
    const code = get().code;
    return code ? getCountry(code) : null;
  },
}));

/**
 * React hook giving the active country profile + bound formatters in
 * one call. Auto-loads on first read.
 */
export function useActiveCountry() {
  const code = useCountry((s) => s.code);
  const loaded = useCountry((s) => s.loaded);
  // Trigger lazy load on first hook use
  if (!loaded) useCountry.getState().load().catch(() => {});
  const prof = code ? getCountry(code) : null;
  return { code, profile: prof, loaded };
}
