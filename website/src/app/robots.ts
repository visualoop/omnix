import type { MetadataRoute } from 'next'
import { BRAND_DOMAIN } from '@/lib/brand'

/**
 * robots.txt.
 *
 * Allows the canonical public site (products, guides, locations, docs, blog,
 * legal) and disallows every private / app / operational family:
 *
 *   /admin, /dashboard        operator + customer consoles
 *   /(auth) routes            /login, /signup, /forgot-password, /verify-email,
 *                             /accept-invitation
 *   /onboarding               post-signup wizard
 *   /buy                      checkout (protected installer + payment flow)
 *   /api/                     all API + protected downloads
 *   /region-unavailable       geo-block interstitial
 *
 * It intentionally does NOT disallow /_next/ (crawlers need the CSS/JS chunks
 * to render pages) nor any published guide/location/doc path. The sitemap is
 * advertised for discovery of the canonical set.
 *
 * One API path is explicitly allowed: /api/og. It generates the Open Graph
 * social-card image referenced by page metadata, so social crawlers must be
 * able to fetch it. The more-specific Allow wins over the broad `/api/`
 * Disallow (longest-match), so every other API path stays blocked.
 */
export default function robots(): MetadataRoute.Robots {
  const base = `https://${BRAND_DOMAIN}`
  return {
    rules: [
      {
        userAgent: '*',
        // '/api/og' is allowed alongside the site root; the /api/ Disallow
        // below still blocks all other API paths.
        allow: ['/', '/api/og'],
        disallow: [
          '/admin',
          '/dashboard',
          '/onboarding',
          '/login',
          '/signup',
          '/forgot-password',
          '/verify-email',
          '/accept-invitation',
          '/buy',
          '/api/',
          '/region-unavailable',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
