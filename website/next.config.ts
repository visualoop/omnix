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
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
