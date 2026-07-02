/**
 * Minimal i18n framework — no external dep, no framework rewrite.
 *
 * Uses a flat key-value catalog per locale. The app loads the active locale
 * once from settings ('app.locale' key), then all `t('some.key')` calls read
 * from the catalog. Missing keys fall back to English.
 *
 * Starting locales: 'en', 'sw' (Swahili). Adding more = one more JSON module.
 *
 * Rules:
 *   - Only UI-visible strings go through t(). SQL, code identifiers, log
 *     messages stay in English.
 *   - Interpolation via {name} placeholders: t('greeting', { name: 'Mary' }).
 *   - Pluralisation not modelled yet; add if we ever need Arabic.
 */
type Catalog = Record<string, string>;

const EN: Catalog = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.no_results": "No results",
  "common.search": "Search",
  "nav.pos": "Point of sale",
  "nav.inventory": "Inventory",
  "nav.customers": "Customers",
  "nav.suppliers": "Suppliers",
  "nav.reports": "Reports",
  "nav.settings": "Settings",
  "pos.checkout": "Checkout",
  "pos.customer": "Customer",
  "pos.total": "Total",
  "pos.paid": "Paid",
  "pos.balance": "Balance due",
  "inventory.stock": "Stock",
  "inventory.reorder": "Reorder",
  "inventory.expiring": "Expiring soon",
};

const SW: Catalog = {
  "common.save": "Hifadhi",
  "common.cancel": "Ghairi",
  "common.delete": "Futa",
  "common.edit": "Hariri",
  "common.close": "Funga",
  "common.confirm": "Thibitisha",
  "common.loading": "Inapakia…",
  "common.error": "Kuna hitilafu",
  "common.no_results": "Hakuna matokeo",
  "common.search": "Tafuta",
  "nav.pos": "Mauzo",
  "nav.inventory": "Bidhaa",
  "nav.customers": "Wateja",
  "nav.suppliers": "Wasambazaji",
  "nav.reports": "Ripoti",
  "nav.settings": "Mipangilio",
  "pos.checkout": "Malipo",
  "pos.customer": "Mteja",
  "pos.total": "Jumla",
  "pos.paid": "Imelipwa",
  "pos.balance": "Salio",
  "inventory.stock": "Hisa",
  "inventory.reorder": "Agiza tena",
  "inventory.expiring": "Zinaisha karibuni",
};

const CATALOGS: Record<string, Catalog> = { en: EN, sw: SW };

let activeLocale: string = "en";

export function setLocale(locale: string): void {
  if (CATALOGS[locale]) activeLocale = locale;
}

export function getLocale(): string {
  return activeLocale;
}

export function availableLocales(): Array<{ code: string; name: string }> {
  return [
    { code: "en", name: "English" },
    { code: "sw", name: "Kiswahili" },
  ];
}

/**
 * Translate. Returns the English fallback (or the key itself) if missing.
 *
 * Usage:
 *   t('common.save')
 *   t('greeting', { name: 'Mary' })
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const cat = CATALOGS[activeLocale] ?? EN;
  let s = cat[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/**
 * Load the persisted locale from settings on boot.
 * Call once from useAuthStore or AppContent.
 */
export async function loadPersistedLocale(): Promise<void> {
  try {
    const { query } = await import("./db");
    const rows = await query<{ value: string }>(
      `SELECT value FROM settings WHERE key = 'app.locale' LIMIT 1`,
    );
    if (rows[0]?.value) setLocale(rows[0].value);
  } catch { /* ignore */ }
}

export async function persistLocale(locale: string): Promise<void> {
  try {
    const { execute } = await import("./db");
    setLocale(locale);
    await execute(
      `INSERT INTO settings (key, value, category) VALUES ('app.locale', ?1, 'app')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [locale],
    );
  } catch { /* ignore */ }
}
