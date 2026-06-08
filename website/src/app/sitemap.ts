import type { MetadataRoute } from 'next'
import { BRAND_DOMAIN } from '@/lib/brand'
import { POSTS_SEED } from '@/lib/blog-seed'
import { DOCS_SEED } from '@/lib/docs-seed'
import { MODULES_SEED } from '@/lib/modules-seed'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `https://${BRAND_DOMAIN}`
  const now = new Date().toISOString()

  const staticPaths: MetadataRoute.Sitemap = [
    '',
    '/pricing',
    '/modules',
    '/pro',
    '/dawa',
    '/retail',
    '/hospitality',
    '/hardware',
    '/downloads',
    '/changelog',
    '/about',
    '/contact',
    '/support',
    '/blog',
    '/docs',
    '/privacy',
    '/terms',
    '/refund-policy',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? ('daily' as const) : ('weekly' as const),
    priority: path === '' ? 1.0 : 0.7,
  }))

  const modulesPaths: MetadataRoute.Sitemap = MODULES_SEED.map((m) => ({
    url: `${base}/modules/${m.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const blogPaths: MetadataRoute.Sitemap = POSTS_SEED.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.publishedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  const docsPaths: MetadataRoute.Sitemap = DOCS_SEED.map((d) => ({
    url: `${base}/docs/${d.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [...staticPaths, ...modulesPaths, ...blogPaths, ...docsPaths]
}
