import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
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
    const csp = [
      "default-src 'self'",
      // Next inlines a small bootstrap script per page; 'self' covers our static.
      // Paystack inline.js loads from js.paystack.co; allow it for checkout.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://api.paystack.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://media.omnix.co.ke https://*.r2.cloudflarestorage.com https://www.googletagmanager.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.paystack.co https://omnix.co.ke https://media.omnix.co.ke",
      "frame-src https://standard.paystack.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'", // we never embed in others' iframes
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
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.paystack.co")' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
