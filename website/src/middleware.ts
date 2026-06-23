import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing, localeForGeoCountry, COUNTRY_LOCALES, LANGUAGE_LOCALES } from './i18n/routing'
import { currencyForCountry, type SupportedCurrency } from '@/lib/currency'

/**
 * Three roles in one middleware pass (order matters):
 *
 *   1. SANCTIONED region block (CU, IR, KP, SY, BY, RU). Anyone from
 *      one of these IPs gets rewritten to /region-unavailable before
 *      any other logic runs.
 *
 *   2. Origin synthesis for Payload cookie auth.
 *      Browsers don't send Origin on top-level GETs; Payload's CSRF
 *      check rejects the auth-cookie without one. Synthesize Origin
 *      for trusted hosts so dashboard pages render.
 *
 *   3. Geo + currency cookie persistence.
 *      Vercel exposes the visitor's country in `req.geo`. We map it to
 *      a Paystack-supported currency (KES / USD / NGN / GHS / ZAR) and
 *      stash it in the `omnix_currency` cookie so server components
 *      can render localized prices.
 *
 *   4. next-intl locale routing.
 *      Resolves the [locale] segment for any path that gets routed to
 *      app/[locale]/... — invalid locales get rewritten to defaultLocale.
 *      Skipped for /api, /admin, /dashboard, /buy and other non-localized
 *      route groups.
 */

const TRUSTED_HOSTS = new Set([
  'omnix.co.ke',
  'www.omnix.co.ke',
  'localhost:3000',
  '127.0.0.1:3000',
])

const SANCTIONED_COUNTRIES = new Set(['CU', 'IR', 'KP', 'SY', 'BY', 'RU'])

const CURRENCY_COOKIE = 'omnix_currency'
const COUNTRY_COOKIE = 'omnix_country'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const intlMiddleware = createMiddleware(routing)

/** Paths that are NOT localized (no [locale] segment). */
function isNonLocalizedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/buy') ||
    pathname.startsWith('/_next') ||
    // SEO files — must stay at root, never localized.
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/site.webmanifest' ||
    // Auth pages — live under app/(auth) outside [locale]. Without
    // this exclusion the geo-redirect rewrites /login → /ke/login,
    // which doesn't exist and 404s.
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/verify-email') ||
    pathname === '/region-unavailable' ||
    pathname.startsWith('/region-unavailable')
  )
}

export function middleware(request: NextRequest) {
  // ── (1) Sanctioned-country gate ──────────────────────────────
  const geo = (request as unknown as { geo?: { country?: string } }).geo
  const country = geo?.country ?? request.headers.get('x-vercel-ip-country') ?? ''
  if (country && SANCTIONED_COUNTRIES.has(country)) {
    if (!request.nextUrl.pathname.startsWith('/region-unavailable')) {
      return NextResponse.rewrite(new URL('/region-unavailable', request.url))
    }
  }

  // ── (1b) Geo-prefix redirect ─────────────────────────────────
  // Bare URLs (no /xx prefix) get redirected to the user's locale.
  // Order of preference:
  //   1. omnix_routed_locale cookie  — sticks user's last choice
  //   2. x-vercel-ip-country header  — geo
  //   3. defaultLocale ('ke')        — home market
  //
  // /pricing in Kenya  → /ke/pricing
  // /pricing in USA    → /us/pricing
  // /pricing for a returning Nigerian visitor (cookie=ng) → /ng/pricing
  //
  // Auth pages, /api, /admin, /dashboard, /buy, /_next, etc. are in
  // isNonLocalizedPath() and stay bare.
  const pathname = request.nextUrl.pathname
  const firstSeg = pathname.split('/')[1] ?? ''
  const knownLocale = ([...COUNTRY_LOCALES, ...LANGUAGE_LOCALES] as readonly string[]).includes(firstSeg)
  if (
    !isNonLocalizedPath(pathname) &&
    !knownLocale &&
    request.method === 'GET' &&
    !request.headers.get('next-action')
  ) {
    const stickyCookie = request.cookies.get('omnix_routed_locale')?.value
    const target =
      stickyCookie && ([...COUNTRY_LOCALES, ...LANGUAGE_LOCALES] as readonly string[]).includes(stickyCookie)
        ? stickyCookie
        : localeForGeoCountry(country)
    const url = request.nextUrl.clone()
    url.pathname = `/${target}${pathname === '/' ? '' : pathname}`
    const redirect = NextResponse.redirect(url, 308)
    redirect.cookies.set('omnix_routed_locale', target, {
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    })
    return redirect
  }

  // ── (2) Origin synthesis for Payload cookie auth ──────────────
  const originHeader = request.headers.get('origin')
  const host = request.headers.get('host')

  // Make the full request URL (path + search) readable from layouts/pages
  // via headers().get('x-omnix-url'). We can't call request.nextUrl from
  // a layout, so propagating it through a request header lets every layer
  // build a proper /login?next=<full-url> redirect that preserves the
  // ?variant= / ?intent= params the desktop activation flow sends.
  const fullPath = request.nextUrl.pathname + request.nextUrl.search

  let response: NextResponse
  if (isNonLocalizedPath(request.nextUrl.pathname)) {
    // Non-localized routes (api, admin, dashboard, buy) skip next-intl
    // entirely. Just do origin synthesis + cookie persistence.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-omnix-url', fullPath)
    if (originHeader || !host || !TRUSTED_HOSTS.has(host)) {
      response = NextResponse.next({ request: { headers: requestHeaders } })
    } else {
      const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
      const synthesizedOrigin = `${protocol}://${host}`
      requestHeaders.set('origin', synthesizedOrigin)
      response = NextResponse.next({ request: { headers: requestHeaders } })
    }
  } else {
    // Localized routes — pass through next-intl.
    response = intlMiddleware(request)
  }

  // ── (3) Currency cookie ──────────────────────────────────────
  if (!isNonLocalizedPath(request.nextUrl.pathname) && !request.cookies.get(CURRENCY_COOKIE)) {
    const currency: SupportedCurrency = currencyForCountry(country)
    response.cookies.set(CURRENCY_COOKIE, currency, {
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    })
    if (country) {
      response.cookies.set(COUNTRY_COOKIE, country, {
        maxAge: COOKIE_MAX_AGE,
        sameSite: 'lax',
        path: '/',
      })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico)$).*)',
  ],
}
