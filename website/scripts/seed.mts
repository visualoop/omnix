/**
 * Idempotent CMS seed for omnix.
 *
 * Populates the metadata side of Modules, BlogPosts (title/slug/category),
 * and Pages (title/slug/kind) from src/lib/*-seed.ts so the live site has
 * non-empty collections out of the gate.
 *
 * Body content (richText) is intentionally NOT seeded — the owner edits
 * those in Payload admin to use the proper lexical editor. Re-running this
 * script updates titles/categories without overwriting body.
 *
 * Usage:
 *   pnpm seed                   # local
 *   pnpm exec tsx scripts/seed.mts   # CI (DATABASE_URL + PAYLOAD_SECRET in env)
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { MODULES_SEED } from '../src/lib/modules-seed.ts'
import { POSTS_SEED } from '../src/lib/blog-seed.ts'
import { DOCS_SEED } from '../src/lib/docs-seed.ts'

const log = (msg: string) => console.log(`[seed] ${msg}`)
const warn = (msg: string) => console.warn(`[seed] WARN: ${msg}`)

const upsert = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  uniqueField: string,
  uniqueValue: string,
  data: Record<string, unknown>,
) => {
  try {
    const existing = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: collection as any,
      where: { [uniqueField]: { equals: uniqueValue } },
      limit: 1,
    })
    if (existing.docs[0]) {
      await payload.update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: collection as any,
        id: (existing.docs[0] as { id: string | number }).id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
        overrideAccess: true,
      })
      log(`${collection} updated: ${uniqueValue}`)
    } else {
      await payload.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: collection as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
        overrideAccess: true,
      })
      log(`${collection} created: ${uniqueValue}`)
    }
  } catch (e) {
    warn(`${collection}/${uniqueValue}: ${(e as Error).message}`)
  }
}

const main = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  // ── Modules ───────────────────────────────────────────────
  for (const m of MODULES_SEED) {
    await upsert(payload, 'modules', 'moduleId', m.moduleId, {
      moduleId: m.moduleId,
      name: m.name,
      shortName: m.shortName,
      tagline: m.tagline,
      shortDescription: m.shortDescription,
      longDescription: m.longDescription,
      available: m.status,
      priority: m.priority,
    })
  }

  // ── Blog posts (metadata only; body filled in admin) ──────
  for (const p of POSTS_SEED) {
    await upsert(payload, 'blog-posts', 'slug', p.slug, {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      publishedAt: p.publishedAt,
      status: 'published',
    })
  }

  // ── Docs (Pages with kind=help; body filled in admin) ────
  for (const d of DOCS_SEED) {
    await upsert(payload, 'pages', 'slug', d.slug, {
      slug: d.slug,
      title: d.title,
      kind: 'help',
    })
  }

  log('done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
