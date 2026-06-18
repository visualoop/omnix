import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/**
 * The dev server runs on port 3000 (or whatever PORT is set to) and is
 * proxied through code-server at https://<port>.blyss.co.ke.
 *
 * Next.js 16 rejects cross-origin dev requests by default. We allow:
 *   - localhost / 127.0.0.1 (direct access)
 *   - *.blyss.co.ke (the code-server proxy)
 *   - the explicit NEXT_PUBLIC_SITE_URL for tunnels we set ourselves
 */
const allowedDevOrigins: string[] = [
  'localhost',
  '127.0.0.1',
  '*.blyss.co.ke',
]

const explicit = process.env.NEXT_PUBLIC_SITE_URL
if (explicit) {
  try {
    const u = new URL(explicit)
    if (!allowedDevOrigins.includes(u.host)) allowedDevOrigins.push(u.host)
  } catch {
    /* ignore — user provided invalid URL */
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    remotePatterns: [
      // Cloudflare R2 in production
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'r2.omnix.co.ke' },
      { protocol: 'https', hostname: 'media.omnix.co.ke' },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
  // Security headers — applied to every response.
  // CSP is intentionally permissive on connect-src/img-src for our own
  // R2 bucket + Paystack; everything else is locked down.
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    // unsafe-eval is required by Next.js HMR in dev; production drops it.
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline' https://js.paystack.co https://api.paystack.co https://www.googletagmanager.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://api.paystack.co"
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.paystack.co https://checkout.paystack.com https://omnix.co.ke https://media.omnix.co.ke https://www.google-analytics.com",
      "frame-src https://checkout.paystack.com https://standard.paystack.co https://*.paystack.co https://*.paystack.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self' https://studio.blyss.co.ke https://*.vercel.app", // allow embed in studio + Vercel previews
      "upgrade-insecure-requests",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // No X-Frame-Options — it's legacy, only allows DENY/SAMEORIGIN
          // (no allow-list). frame-ancestors in the CSP above is the
          // modern equivalent and supports per-origin allow-lists.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.paystack.co")' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
