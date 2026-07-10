/**
 * Phone helpers — normalize local Kenyan numbers to the international digit
 * form WhatsApp's wa.me links require (no '+', no spaces).
 *
 *   0712 345 678   → 254712345678
 *   +254 712 …     → 254712…
 *   712345678      → 254712345678
 *
 * Returns null when there aren't enough digits to be a real number.
 */
export function toIntlDigits(raw: string | null | undefined, defaultCountry = "254"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) return digits.length >= 8 ? digits : null;
  if (digits.startsWith(defaultCountry)) {
    // already international
  } else if (digits.startsWith("0")) {
    digits = defaultCountry + digits.slice(1);
  } else if (digits.length <= 9) {
    // bare subscriber number (7XX…/1XX…)
    digits = defaultCountry + digits;
  }
  return digits.length >= 8 ? digits : null;
}
