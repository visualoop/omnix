/**
 * Active intl locale string — passed to `Intl.NumberFormat`,
 * `Date#toLocaleString`, etc.
 *
 * Reads from the Zustand country store at call time so it follows
 * whatever country the user picked during setup. Default 'en' for
 * cold boot before the store hydrates.
 *
 * Replaces the previously hardcoded `"en-KE"` literal scattered
 * across ~50 pages and services. After this swap every date / time /
 * number on the screen formats to the visitor's locale automatically.
 */
import { useCountry } from "@/stores/country";
import { getCountry } from "@/lib/countries";

export function intlLocale(): string {
  const code = useCountry.getState().code;
  if (!code) return "en";
  return getCountry(code)?.intlLocale ?? "en";
}
