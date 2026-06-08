import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Same-origin request normaliser for Payload cookie auth.
 *
 * Payload v3's auth() requires an Origin header to trust the auth-cookie,
 * but browsers DON'T send Origin on top-level GET navigations (URL bar,
 * link clicks, page reloads). Without Origin, payload.auth() returns null
 * even when the cookie is valid → server-rendered pages think the user
 * is logged out and redirect to /login.
 *
 * The fix is well-bounded: when a request comes in with NO Origin header
 * and a Host that matches a trusted domain (the deployment URL or its
 * www counterpart), we inject Origin = `https://<host>` so Payload sees
 * a same-origin request. Cross-origin requests (with their own Origin
 * header) are left untouched and continue to be CSRF-checked.
 */

const TRUSTED_HOSTS = new Set([
  'omnix.co.ke',
  'www.omnix.co.ke',
  'localhost:3000',
  '127.0.0.1:3000',
])

export function middleware(request: NextRequest) {
  const originHeader = request.headers.get('origin')
  if (originHeader) {
    // Browser already sent Origin — respect it (CSRF check applies as normal).
    return NextResponse.next()
  }

  const host = request.headers.get('host')
  if (!host || !TRUSTED_HOSTS.has(host)) {
    // Unknown host — don't synthesize an origin (fail closed for safety).
    return NextResponse.next()
  }

  // Same-origin GET / page navigation. Synthesize the Origin so Payload's
  // auth-cookie strategy will accept the cookie.
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  const synthesizedOrigin = `${protocol}://${host}`

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('origin', synthesizedOrigin)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  // Run on every route except Next.js internals + static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico)$).*)',
  ],
}
