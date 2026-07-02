/**
 * Shared money formatter.
 *
 * Reads the active country from the Zustand store (no hook required —
 * works at module scope, in non-React utilities, and inside event
 * handlers). When the active country changes (only during setup) any
 * subsequent render will pick up the new currency.
 *
 * Pages used to define their own per-file:
 *   const KES = (n) => "KES " + n.toLocaleString("en-KE", ...)
 *
 * Replace with:
 *   import { money as KES } from "@/lib/money";
 *
 * The two-decimal vs zero-decimal split that pages had locally is
 * absorbed into the country profile (KES uses 0, USD/GBP/INR use 2,
 * etc.). If a page wants explicit decimals, pass a second argument:
 *   money(n, 2)
 */
import { useCountry } from "@/stores/country";
import { formatMoney, formatNumber } from "@/lib/locale";

/** Default — uses country profile's decimals. */
export function money(n: number): string {
  return formatMoney(n, useCountry.getState().code);
}

/** Force decimal count (e.g. invoice line items always at 2dp). */
export function moneyExact(n: number, decimals: number): string {
  const code = useCountry.getState().code;
  return `${formatNumber(n, code, decimals)}`;
}

/** Just the symbol prefix — for input fields. */
export function currencySymbol(): string {
  const code = useCountry.getState().code;
  if (!code) return "$";
  // Re-uses formatMoney(0, code) so symbol matches what figures show
  return formatMoney(0, code).split(" ")[0];
}

/**
 * Compact notation for glanceable KPIs. Turns big numbers into readable
 * K/M/B/T without a currency symbol.
 *
 *   moneyCompact(999)        → "999"
 *   moneyCompact(1_234)      → "1.2K"
 *   moneyCompact(12_340)     → "12.3K"
 *   moneyCompact(123_400)    → "123K"
 *   moneyCompact(1_234_567)  → "1.23M"
 *   moneyCompact(12_345_678) → "12.3M"
 *   moneyCompact(1_200_000_000) → "1.2B"
 *
 * Below 1 000 we show full precision (a shop rarely rings KES 8.5 as "8.5" —
 * they want to see "850"). At ≥ 1M we drop to 2 dp; at ≥ 10M drop to 1 dp;
 * at ≥ 100M drop to 0 dp. Never lies about magnitude.
 */
export function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 1_000) {
    // Below 1 000 — full precision, no decimals for whole numbers.
    const rounded = Math.round(abs);
    return `${sign}${rounded.toLocaleString()}`;
  }
  if (abs < 1_000_000) {
    // Thousands — 1 dp when <10K, integer when ≥10K
    const scaled = abs / 1_000;
    const digits = scaled < 10 ? 1 : 0;
    return `${sign}${scaled.toFixed(digits)}K`;
  }
  if (abs < 1_000_000_000) {
    // Millions — 2 dp <10M, 1 dp <100M, integer at ≥100M
    const scaled = abs / 1_000_000;
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return `${sign}${scaled.toFixed(digits)}M`;
  }
  if (abs < 1_000_000_000_000) {
    const scaled = abs / 1_000_000_000;
    const digits = scaled < 10 ? 2 : 1;
    return `${sign}${scaled.toFixed(digits)}B`;
  }
  const scaled = abs / 1_000_000_000_000;
  return `${sign}${scaled.toFixed(1)}T`;
}

/**
 * Hero-size KES rendering:
 *   - Under 1M → full precision with thousand separators ("245,340")
 *   - 1M+     → compact notation ("1.23M") so the layout never overflows
 *
 * Never includes the currency symbol — pair with the small "KSh" prefix
 * the dashboard + POS heroes already render alongside.
 */
export function moneyHero(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1_000_000) {
    return Math.round(n).toLocaleString();
  }
  return moneyCompact(n);
}

/* ─── Money arithmetic — use at EVERY persist/compare boundary ──────── *
 *
 * Money is stored as REAL (float). Float sums drift over millions of
 * rows and inclusive-tax back-out produces values like 86.2068965…
 * These helpers force a single, consistent 2-decimal discipline so the
 * receipt, the report, and the eTIMS line always agree.
 *
 *   round2(n)   → n rounded to 2 decimal places (the canonical money form)
 *   toCents(n)  → integer cents (exact arithmetic; no float drift)
 *   fromCents(c)→ back to a 2dp number
 *   addMoney/   → exact add/subtract via integer cents
 *   sumMoney(xs)→ exact sum of a list
 */

/** Round a money value to 2 decimal places (half-up, float-safe). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convert a money value to exact integer cents. */
export function toCents(n: number): number {
  return Math.round(n * 100);
}

/** Convert integer cents back to a 2dp money number. */
export function fromCents(c: number): number {
  return Math.round(c) / 100;
}

/** Exact sum of money values (sums in integer cents, returns 2dp number). */
export function sumMoney(values: number[]): number {
  return fromCents(values.reduce((acc, v) => acc + toCents(v), 0));
}

/** Exact a + b in money. */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/** Exact a − b in money. */
export function subMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}
