/**
 * GA4 measurement-ID validation.
 *
 * The public analytics system loads a Google tag ONLY after explicit consent,
 * and only for a measurement ID that matches this exact shape. The regex is the
 * gate that decides whether the analytics component (and its consent notice)
 * renders at all: an unset or malformed `NEXT_PUBLIC_GA_ID` resolves to null, so
 * nothing loads and no banner is shown.
 *
 * A GA4 measurement ID is `G-` followed by uppercase base-36 characters. The
 * pattern is deliberately narrow: no lowercase, no punctuation, no query — so a
 * value read from the environment can be interpolated straight into the tag URL
 * (`.../gtag/js?id=<id>`) without opening an injection surface.
 */

/** `G-` + 4–20 uppercase alphanumerics. Anchored; nothing else allowed. */
export const GA_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/

export function isValidGaId(value: unknown): value is string {
  return typeof value === 'string' && GA_ID_PATTERN.test(value)
}

/**
 * Normalise an environment value into a usable GA id, or null.
 *
 * Trims surrounding whitespace, then validates. Returns null for undefined,
 * empty, or malformed input so every caller can treat "no analytics" as a
 * single, explicit branch.
 */
export function resolveGaId(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim()
  return trimmed && isValidGaId(trimmed) ? trimmed : null
}
