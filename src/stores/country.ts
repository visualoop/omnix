/**
 * Active business country — the single source of truth for locale and base
 * currency. Country is persisted globally, never on a branch. Once the
 * business has transactional history, changing country (and therefore base
 * currency) is blocked because historical amounts cannot be re-denominated.
 */
import { create } from "zustand";
import { query, execute } from "@/lib/db";
import { getCountry, type CountryCode, type CountryProfile } from "@/lib/countries";

interface CountryState {
  /** ISO-3166-1 alpha-2 — null until first load completes. */
  code: CountryCode | null;
  /** ISO-4217 base currency derived only from `code`, never from a branch. */
  currencyCode: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  set: (code: CountryCode) => Promise<void>;
  /** Convenient accessor that does not break before load completes. */
  profile: () => CountryProfile | null;
}

const SETTING_KEY = "country_code";
const CURRENCY_SETTING_KEY = "business_currency";
const LS_KEY = "omnix.country_code";

const TRANSACTION_TABLES = [
  "sales",
  "sale_returns",
  "purchase_orders",
  "goods_receipts",
  "expenses",
  "bank_transactions",
  "customer_payments",
  "supplier_payments",
  "invoices",
  "payroll_runs",
] as const;

function validProfile(code: CountryCode | null | undefined): CountryProfile | null {
  return code ? getCountry(code) : null;
}

function hydrateFromCache(): CountryCode | null {
  try {
    const value = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    return validProfile(value)?.code ?? null;
  } catch {
    return null;
  }
}

function cacheCountry(code: CountryCode): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, code);
  } catch {
    // localStorage is a cross-window fast path only; SQLite remains canonical.
  }
}

async function hasBusinessTransactions(): Promise<boolean> {
  const names = TRANSACTION_TABLES.map((name) => `'${name}'`).join(", ");
  const existing = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${names})`,
  );
  const allowed = new Set<string>(TRANSACTION_TABLES);
  for (const { name } of existing) {
    if (!allowed.has(name)) continue;
    const rows = await query<{ present: number }>(`SELECT 1 AS present FROM ${name} LIMIT 1`);
    if (rows.length > 0) return true;
  }
  return false;
}

async function readPersistedCountry(): Promise<CountryCode | null> {
  const rows = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?1 LIMIT 1`,
    [SETTING_KEY],
  );
  return validProfile(rows[0]?.value)?.code ?? null;
}

async function persistCountry(profile: CountryProfile, applyCountryTaxDefaults = false): Promise<void> {
  if (applyCountryTaxDefaults) {
    await execute(
      `INSERT INTO settings (key, value, category)
         VALUES (?1, ?2, 'locale'), (?3, ?4, 'locale'),
                ('tax.default_rate', ?5, 'tax'), ('tax.label', ?6, 'tax')
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         category = excluded.category,
         updated_at = datetime('now')`,
      [
        SETTING_KEY,
        profile.code,
        CURRENCY_SETTING_KEY,
        profile.currencyCode,
        String(profile.defaultTaxRate),
        profile.taxLabel,
      ],
    );
    return;
  }
  await execute(
    `INSERT INTO settings (key, value, category)
       VALUES (?1, ?2, 'locale'), (?3, ?4, 'locale')
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       category = excluded.category,
       updated_at = datetime('now')`,
    [SETTING_KEY, profile.code, CURRENCY_SETTING_KEY, profile.currencyCode],
  );
}

const cachedCode = hydrateFromCache();
const cachedProfile = validProfile(cachedCode);

export const useCountry = create<CountryState>((set, get) => ({
  code: cachedCode,
  currencyCode: cachedProfile?.currencyCode ?? null,
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const rows = await query<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (?1, ?2)`,
        [SETTING_KEY, CURRENCY_SETTING_KEY],
      );
      const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      const profile = validProfile(values[SETTING_KEY]) ?? cachedProfile ?? getCountry("KE");
      if (!profile) throw new Error("Default country profile is unavailable");

      // Country is canonical. Repair a missing/stale currency cache without
      // ever consulting the active branch.
      if (values[CURRENCY_SETTING_KEY] !== profile.currencyCode) {
        await persistCountry(profile);
      }
      cacheCountry(profile.code);
      set({ code: profile.code, currencyCode: profile.currencyCode, loaded: true });
    } catch {
      const profile = cachedProfile ?? getCountry("KE");
      if (!profile) return;
      cacheCountry(profile.code);
      set({ code: profile.code, currencyCode: profile.currencyCode, loaded: true });
    }
  },

  set: async (code) => {
    const next = validProfile(code);
    if (!next) throw new Error(`Unsupported country code: ${code}`);

    const persisted = await readPersistedCountry();
    const current = persisted ?? get().code;
    if (current && current !== next.code && await hasBusinessTransactions()) {
      const currentProfile = validProfile(current);
      throw new Error(
        `Country cannot be changed after transactions exist. This business remains ${currentProfile?.name ?? current} (${currentProfile?.currencyCode ?? "base currency"}).`,
      );
    }

    // Persist before publishing to UI/cache so a failed write cannot create a
    // country that disappears or changes currency after restart.
    await persistCountry(next, true);
    cacheCountry(next.code);
    set({ code: next.code, currencyCode: next.currencyCode, loaded: true });
  },

  profile: () => validProfile(get().code),
}));

/** React hook giving the active country profile. Auto-loads on first read. */
export function useActiveCountry() {
  const code = useCountry((state) => state.code);
  const currencyCode = useCountry((state) => state.currencyCode);
  const loaded = useCountry((state) => state.loaded);
  if (!loaded) useCountry.getState().load().catch(() => {});
  return { code, currencyCode, profile: validProfile(code), loaded };
}

/** Base currency is business-scoped and deliberately independent of branches. */
export function getBusinessCurrencyCode(): string {
  const state = useCountry.getState();
  return state.currencyCode ?? validProfile(state.code)?.currencyCode ?? "USD";
}
