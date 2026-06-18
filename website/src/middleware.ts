import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { currencyForCountry, type SupportedCurrency } from '@/lib/currency'

/**
 * Two roles in one middleware pass:
 *
 *   1. Same-origin request normaliser for Payload cookie auth.
 *      Payload v3's auth() requires an Origin header to trust the
 *      auth-cookie. Browsers don't send Origin on top-level GETs, so
 *      we synthesize it for trusted hosts.
 *
 *   2. Geo + currency cookie persistence.
 *      Vercel exposes the visitor's country in `req.geo`. We map it to
 *      a Paystack-supported currency (KES / USD / NGN / GHS / ZAR) and
 *      stash it in the `omnix_currency` cookie so server components
 *      can render localized prices without re-doing the lookup on
 *      every request.
 */

const TRUSTED_HOSTS = new Set([
  'omnix.co.ke',
  'www.omnix.co.ke',
  'localhost:3000',
  '127.0.0.1:3000',
])

const CURRENCY_COOKIE = 'omnix_currency'
const COUNTRY_COOKIE = 'omnix_country'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function middleware(request: NextRequest) {
  // ── (1) Origin synthesis for Payload cookie auth ───────────────
  const originHeader = request.headers.get('origin')
  const host = request.headers.get('host')

  let response: NextResponse
  if (originHeader || !host || !TRUSTED_HOSTS.has(host)) {
    response = NextResponse.next()
  } else {
    const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
    const synthesizedOrigin = `${protocol}://${host}`
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('origin', synthesizedOrigin)
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ── (2) Country + currency persistence ─────────────────────────
  // Skip on API + static. Only set cookies on full-page navigations.
  const path = request.nextUrl.pathname
  const isPageNav = !path.startsWith('/api/') && !path.startsWith('/_next/')

  if (isPageNav && !request.cookies.get(CURRENCY_COOKIE)) {
    // Vercel's geo header (typed as an extension on NextRequest)
    const geo = (request as unknown as { geo?: { country?: string } }).geo
    const country = geo?.country ?? request.headers.get('x-vercel-ip-country') ?? ''
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
  // Run on every route except Next.js internals + static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico)$).*)',
  ],
}
