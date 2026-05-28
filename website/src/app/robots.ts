import type { MetadataRoute } from 'next'
import { BRAND_DOMAIN } from '@/lib/brand'

export default function robots(): MetadataRoute.Robots {
  const base = `https://${BRAND_DOMAIN}`
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard', '/buy', '/api', '/_next'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
