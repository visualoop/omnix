/**
 * Idempotent CMS seed for omnix.
 *
 * Populates Modules, BlogPosts, Pages (docs), Settings, and the LandingPage
 * global with the canonical content from src/lib/*-seed.ts. Re-running updates
 * existing rows by slug — no duplicates.
 *
 * Usage:
 *   pnpm seed                     # local
 *   tsx scripts/seed.mts          # CI (DATABASE_URL + PAYLOAD_SECRET in env)
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { MODULES_SEED } from '../src/lib/modules-seed.ts'
import { POSTS_SEED } from '../src/lib/blog-seed.ts'
import { DOCS_SEED } from '../src/lib/docs-seed.ts'

const log = (msg: string) => console.log(`[seed] ${msg}`)

const main = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  // ── Modules ───────────────────────────────────────────────
  for (const m of MODULES_SEED) {
    const existing = await payload.find({
      collection: 'modules',
      where: { slug: { equals: m.slug } },
      limit: 1,
    })
    const data = {
      slug: m.slug,
      moduleId: m.moduleId,
      name: m.name,
      shortName: m.shortName,
      tagline: m.tagline,
      available: m.status,
      priority: m.priority,
    } as never
    if (existing.docs[0]) {
      await payload.update({
        collection: 'modules',
        id: (existing.docs[0] as { id: string | number }).id,
        data,
        overrideAccess: true,
      })
      log(`module updated: ${m.slug}`)
    } else {
      await payload.create({ collection: 'modules', data, overrideAccess: true })
      log(`module created: ${m.slug}`)
    }
  }

  // ── Blog posts ────────────────────────────────────────────
  for (const p of POSTS_SEED) {
    const existing = await payload.find({
      collection: 'blog-posts',
      where: { slug: { equals: p.slug } },
      limit: 1,
    })
    const data = {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      author: p.author,
      publishedAt: p.publishedAt,
      readTime: p.readTime,
      featured: Boolean(p.featured),
      body: p.body,
      status: 'published',
    } as never
    if (existing.docs[0]) {
      await payload.update({
        collection: 'blog-posts',
        id: (existing.docs[0] as { id: string | number }).id,
        data,
        overrideAccess: true,
      })
      log(`post updated: ${p.slug}`)
    } else {
      await payload.create({ collection: 'blog-posts', data, overrideAccess: true })
      log(`post created: ${p.slug}`)
    }
  }

  // ── Docs (stored as Pages with category=docs) ────────────
  for (const d of DOCS_SEED) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: d.slug } },
      limit: 1,
    })
    const data = {
      slug: d.slug,
      title: d.title,
      kind: 'doc',
      body: d.body,
      status: 'published',
    } as never
    if (existing.docs[0]) {
      await payload.update({
        collection: 'pages',
        id: (existing.docs[0] as { id: string | number }).id,
        data,
        overrideAccess: true,
      })
      log(`doc updated: ${d.slug}`)
    } else {
      await payload.create({ collection: 'pages', data, overrideAccess: true })
      log(`doc created: ${d.slug}`)
    }
  }

  log('done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
