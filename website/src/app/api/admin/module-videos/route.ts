/**
 * Admin-only management of module demo videos.
 *
 * Server-side authorization: every method requires an authenticated
 * platform_admin (the real platform capability convention). The admin route
 * page enforces the same gate; this handler is the security boundary of record.
 *
 * We validate the submitted URL with the pure, strict validator and persist
 * ONLY the normalised 11-character video ID — never the raw URL or embed HTML.
 * No API secrets are read, written, or exposed. No outbound metadata fetch.
 *
 * Search/pagination is intentionally absent: the entity is a fixed five-row
 * enum (one per product), so the whole set is always returned/edited at once.
 */
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auditLog, db, moduleDemoVideos } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'
import {
  MODULE_DEMO_PRODUCTS,
  parseYouTubeUrl,
} from '@/lib/youtube-demo'
import { ModuleDemoVideoInput } from '@/lib/youtube-demo-input'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 }), session: null }
  }
  if (session.user.role !== 'platform_admin') {
    return { error: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

/** GET — the fixed five products, merged with any persisted row. */
export async function GET() {
  const access = await requireAdmin()
  if (access.error) return access.error

  const rows = await db.select().from(moduleDemoVideos)
  const byProduct = new Map(rows.map((row) => [row.product, row]))

  const items = MODULE_DEMO_PRODUCTS.map((product) => {
    const row = byProduct.get(product)
    return {
      product,
      videoId: row?.videoId ?? '',
      title: row?.title ?? '',
      summary: row?.summary ?? '',
      published: row?.published ?? false,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      exists: Boolean(row),
    }
  })

  return NextResponse.json({ ok: true, items })
}

/**
 * PUT — upsert one product's demo video.
 * Body (strict): { product, url, title, summary, published }
 *   - url may be '' to clear/unpublish the entry.
 *   - publishing requires a valid video ID, title, and summary.
 * Emits a create / update / publish / unpublish audit event.
 */
export async function PUT(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error

  const body = await request.json().catch(() => null)
  const parsed = ModuleDemoVideoInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_request', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const { product, url, title, summary, published } = parsed.data

  // Resolve the video ID from the URL (empty URL clears the video).
  let videoId = ''
  if (url) {
    const result = parseYouTubeUrl(url)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }
    videoId = result.videoId
  }

  // Publishing requires a complete, valid entry.
  if (published) {
    if (!videoId) {
      return NextResponse.json({ ok: false, error: 'A valid YouTube link is required before publishing.' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: 'A title is required before publishing.' }, { status: 400 })
    }
    if (!summary) {
      return NextResponse.json({ ok: false, error: 'A text summary is required before publishing.' }, { status: 400 })
    }
  }

  const existing = (await db.select().from(moduleDemoVideos).where(eq(moduleDemoVideos.product, product)).limit(1))[0]
  const now = new Date()

  if (existing) {
    await db
      .update(moduleDemoVideos)
      .set({ videoId, title, summary, published, updatedBy: access.session!.user.id, updatedAt: now })
      .where(eq(moduleDemoVideos.product, product))
  } else {
    await db.insert(moduleDemoVideos).values({
      id: createId(),
      product,
      videoId,
      title,
      summary,
      published,
      updatedBy: access.session!.user.id,
      createdAt: now,
      updatedAt: now,
    })
  }

  const action = !existing
    ? 'module_demo_video.create'
    : published && !existing.published
      ? 'module_demo_video.publish'
      : !published && existing.published
        ? 'module_demo_video.unpublish'
        : 'module_demo_video.update'

  // Audit trail — no secrets; videoId is a public identifier, not sensitive.
  await db
    .insert(auditLog)
    .values({
      id: createId(),
      actorId: access.session!.user.id,
      action,
      resource: `module_demo_video:${product}`,
      metadata: { product, videoId, published, hasTitle: Boolean(title), hasSummary: Boolean(summary) },
    })
    .catch(() => undefined)

  return NextResponse.json({ ok: true, product, action, videoId, published })
}
