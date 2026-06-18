import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
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

  // ── (2) Origin synthesis for Payload cookie auth ──────────────
  const originHeader = request.headers.get('origin')
  const host = request.headers.get('host')

  let response: NextResponse
  if (isNonLocalizedPath(request.nextUrl.pathname)) {
    // Non-localized routes (api, admin, dashboard, buy) skip next-intl
    // entirely. Just do origin synthesis + cookie persistence.
    if (originHeader || !host || !TRUSTED_HOSTS.has(host)) {
      response = NextResponse.next()
    } else {
      const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
      const synthesizedOrigin = `${protocol}://${host}`
      const requestHeaders = new Headers(request.headers)
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
