/**
 * Resolve the modules a licence unlocks.
 *
 * The DB schema stores `modules: string[]` on every licence row, but
 * older rows (pre v0.16.x trial inserts, hand-imported keys, admin
 * promotions) were created before the column was populated and ended
 * up with `modules: []`. When the desktop receives `entitlements.modules
 * = []` it falls back to `["core"]`, which then makes RequireRole's
 * module gate reject every trade-specific page ("Retail isn't on your
 * licence yet").
 *
 * Single source of truth: if the stored modules array has anything in
 * it, trust it. Otherwise derive from `variant` — Pro unlocks all four
 * trades, every trade unlocks itself.
 *
 * This lets us heal old licence rows server-side without a one-off
 * migration script. Whenever it fires we also know the row needs a
 * later UPDATE to backfill — see `licensing/repair-modules.ts`.
 */
export type Variant = 'pro' | 'dawa' | 'retail' | 'hospitality' | 'hardware'

const TRADES: ReadonlyArray<Exclude<Variant, 'pro'>> = ['dawa', 'retail', 'hospitality', 'hardware']

export function modulesForVariant(variant: string | null | undefined): string[] {
  const v = (variant ?? '').toLowerCase() as Variant | ''
  if (v === 'pro') return [...TRADES]
  if (v === 'dawa' || v === 'retail' || v === 'hospitality' || v === 'hardware') return [v]
  return []
}

/**
 * Effective modules for a licence row. Prefer the stored array;
 * fall back to variant-derived defaults when the stored value is
 * missing or empty.
 */
export function effectiveModules(lic: { modules?: unknown; variant?: string | null }): string[] {
  const stored = Array.isArray(lic.modules) ? (lic.modules as unknown[]).filter((m): m is string => typeof m === 'string') : []
  if (stored.length > 0) return stored
  return modulesForVariant(lic.variant)
}
