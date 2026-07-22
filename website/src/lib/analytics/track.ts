/**
 * Conversion + page-view emitters.
 *
 * Everything here is a no-op unless a Google tag is actually loaded (which only
 * happens after explicit consent — see `consent-store.ts`). `window.gtag`
 * existing is the single runtime gate: before opt-in it is undefined, so every
 * call returns early.
 *
 * The payloads are intentionally closed. `trackConversion` accepts a fixed
 * event name and a fixed, optional set of dimensions (product / locale /
 * surface), each validated against a known list before it is sent. There is no
 * free-form record and no way to pass a name, email, phone, business name,
 * reference, amount, or URL through this surface. `sendPageView` reports only a
 * normalised, allowlisted path — a locale plus a known public route, or a fixed
 * template leaf for authored detail pages — and its origin+path. It never sends
 * the raw pathname, a slug, the query string, the hash, the document title, the
 * referrer, or the full URL. Unknown localized paths collapse to
 * `/<locale>/not-found`; non-localized paths send nothing at all.
 */
import { COUNTRY_LOCALES, LANGUAGE_LOCALES } from '@/i18n/routing'

type GtagFn = (...args: unknown[]) => void

interface GtagWindow extends Window {
  dataLayer?: unknown[]
  gtag?: GtagFn
}

/** The closed set of conversion events this site is allowed to report. */
export type ConversionEvent =
  | 'generate_lead'
  | 'whatsapp_click'
  | 'video_start'
  | 'begin_checkout'

export const CONVERSION_EVENTS: readonly ConversionEvent[] = [
  'generate_lead',
  'whatsapp_click',
  'video_start',
  'begin_checkout',
]
const CONVERSION_EVENT_SET = new Set<string>(CONVERSION_EVENTS)

/** The five public product surfaces. Matches the module-demo product set. */
export type ConversionProduct =
  | 'pharmacy'
  | 'retail'
  | 'hospitality'
  | 'hardware'
  | 'salon'

export const CONVERSION_PRODUCTS: readonly ConversionProduct[] = [
  'pharmacy',
  'retail',
  'hospitality',
  'hardware',
  'salon',
]
const CONVERSION_PRODUCT_SET = new Set<string>(CONVERSION_PRODUCTS)

/** Country locale from the known routing list (ke, us, gb, …). */
export type ConversionLocale = (typeof COUNTRY_LOCALES)[number]
const CONVERSION_LOCALE_SET = new Set<string>(COUNTRY_LOCALES as readonly string[])

/** Fixed surface enum — where the action happened, never a free string. */
export type ConversionSurface =
  | 'demo_form'
  | 'whatsapp_widget'
  | 'module_demo'
  | 'pricing'
  | 'product_page'

export const CONVERSION_SURFACES: readonly ConversionSurface[] = [
  'demo_form',
  'whatsapp_widget',
  'module_demo',
  'pricing',
  'product_page',
]
const CONVERSION_SURFACE_SET = new Set<string>(CONVERSION_SURFACES)

export interface ConversionDimensions {
  product?: ConversionProduct
  locale?: ConversionLocale
  surface?: ConversionSurface
}

function gtagOrNull(): GtagFn | null {
  if (typeof window === 'undefined') return null
  const w = window as GtagWindow
  return typeof w.gtag === 'function' ? w.gtag : null
}

/** True only when a Google tag is loaded (i.e. consent was granted). */
export function isAnalyticsReady(): boolean {
  return gtagOrNull() !== null
}

/**
 * Report one of the fixed conversion events. No-ops unless a tag is loaded.
 *
 * Only the recognised, closed dimensions survive; anything unexpected is
 * dropped before the event is sent. The resulting payload can therefore never
 * carry personal data — by construction it is a subset of three enum values.
 */
export function trackConversion(
  event: ConversionEvent,
  dimensions: ConversionDimensions = {},
): void {
  const gtag = gtagOrNull()
  if (!gtag) return
  if (!CONVERSION_EVENT_SET.has(event)) return

  const params: Record<string, string> = {}
  if (dimensions.product && CONVERSION_PRODUCT_SET.has(dimensions.product)) {
    params.product = dimensions.product
  }
  if (dimensions.locale && CONVERSION_LOCALE_SET.has(dimensions.locale)) {
    params.locale = dimensions.locale
  }
  if (dimensions.surface && CONVERSION_SURFACE_SET.has(dimensions.surface)) {
    params.surface = dimensions.surface
  }

  gtag('event', event, params)
}

/** Strip any query/hash and guarantee a leading slash. Defensive. */
export function pathOnly(pathname: string): string {
  const withoutHash = pathname.split('#')[0] ?? ''
  const withoutQuery = withoutHash.split('?')[0] ?? ''
  if (!withoutQuery) return '/'
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
}

/**
 * The closed allowlist of localized public marketing routes (the suffix after
 * the locale segment). A page_view can only ever be reported for a locale plus
 * one of these exact routes — nothing else leaves the browser. The list is
 * hand-maintained on purpose: a new private, checkout, auth, dashboard, or
 * admin route can never silently widen what is sent to Google.
 */
const PUBLIC_ROUTE_SUFFIXES: readonly string[] = [
  'about',
  'ai',
  'blog',
  'changelog',
  'contact',
  'dawa',
  'developers',
  'docs',
  'downloads',
  'etims',
  'guides',
  'hardware',
  'hospitality',
  'locations',
  'migration',
  'modules',
  'mpesa',
  'partners',
  'payroll-pack',
  'pharmacy',
  'pricing',
  'privacy',
  'pro',
  'refund-policy',
  'retail',
  'roadmap',
  'salon',
  'security',
  'sha',
  'support',
  'team',
  'terms',
]
const PUBLIC_ROUTE_SET = new Set<string>(PUBLIC_ROUTE_SUFFIXES)

/**
 * Dynamic authored families. Their detail pages are slug-addressed, so the slug
 * — which is authored freely and could be attacked with a PII-looking value —
 * is never reported. Each family collapses to a fixed template leaf instead
 * (e.g. `/ke/blog/<slug>` → `/ke/blog/article`).
 */
const DYNAMIC_ROUTE_TEMPLATES: Readonly<Record<string, string>> = {
  blog: 'article',
  docs: 'article',
  guides: 'article',
  locations: 'place',
  modules: 'detail',
}

/** Every valid locale prefix (country + language codes). */
const KNOWN_LOCALES = new Set<string>([
  ...COUNTRY_LOCALES,
  ...LANGUAGE_LOCALES,
] as readonly string[])

/**
 * Normalise a client pathname to a safe, closed page-view path.
 *
 * Returns, in order of match:
 *   - `/<locale>` for the localized home,
 *   - `/<locale>/<route>` for an exact known public route,
 *   - `/<locale>/<family>/<template>` for an authored detail family — the fixed
 *     template leaf, never the slug,
 *   - `/<locale>/not-found` for any other localized path — never the attempted
 *     path, so a PII-looking or arbitrary segment can never be reported,
 *   - `null` for a non-localized path, in which case no event is sent at all.
 *
 * It never returns the raw pathname, a slug, a query string, or a hash.
 */
export function normalizePublicPath(pathname: string): string | null {
  const path = pathOnly(pathname)
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null // '/' — no locale segment

  const locale = segments[0]
  if (!KNOWN_LOCALES.has(locale)) return null // non-localized → no event

  const rest = segments.slice(1)
  if (rest.length === 0) return `/${locale}` // localized home

  if (rest.length === 1) {
    return PUBLIC_ROUTE_SET.has(rest[0])
      ? `/${locale}/${rest[0]}`
      : `/${locale}/not-found`
  }

  if (rest.length === 2) {
    const template = DYNAMIC_ROUTE_TEMPLATES[rest[0]]
    return template ? `/${locale}/${rest[0]}/${template}` : `/${locale}/not-found`
  }

  return `/${locale}/not-found`
}

/**
 * Send a manual GA4 page_view for a client route.
 *
 * The pathname is run through the closed {@link normalizePublicPath} allowlist
 * first, so only a normalised path can ever be sent: origin+path
 * (page_location) and path (page_path). The document title is deliberately
 * omitted — it is a free-form surface that could carry reflected content, and
 * dropping it is simpler than trying to prove it safe. If the path does not
 * normalise (a non-localized path), no event is sent. No-ops unless a tag is
 * loaded. The raw pathname is never transmitted.
 */
export function sendPageView(pathname: string): void {
  const gtag = gtagOrNull()
  if (!gtag) return
  const path = normalizePublicPath(pathname)
  if (!path) return
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : ''
  gtag('event', 'page_view', {
    page_location: `${origin}${path}`,
    page_path: path,
  })
}
