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
