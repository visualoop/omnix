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
