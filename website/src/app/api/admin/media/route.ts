/**
 * Admin media management.
 *
 *   GET    /api/admin/media           — list all uploaded media (most recent first)
 *   POST   /api/admin/media           — upload one image (multipart/form-data)
 *                                       fields: file (required), slot (optional),
 *                                               alt (optional)
 *   DELETE /api/admin/media?id=…      — delete one row + R2 object
 *   PATCH  /api/admin/media?id=…      — update slot/alt for an existing row
 *
 * Auth: platform_admin only. Anything else gets 403.
 */
import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { db, platformMedia } from '@/db'
import { auth } from '@/lib/auth'
import { uploadMedia, deleteMedia, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/r2-media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: NextResponse.json({ ok: false, error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const rows = await db
    .select()
    .from(platformMedia)
    .orderBy(desc(platformMedia.createdAt))
    .limit(500)
  return NextResponse.json({ ok: true, items: rows })
}

export async function POST(req: Request) {
  const a = await requireAdmin()
  if (a.error) return a.error

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'No file in upload' }, { status: 400 })
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported type: ${file.type}. Allowed: ${ACCEPTED_IMAGE_TYPES.join(', ')}`,
      },
      { status: 415 },
    )
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File too large (${Math.round(file.size / 1024)} KB). Max 8 MB.` },
      { status: 413 },
    )
  }

  const slot = (form.get('slot') as string | null)?.trim() || null
  const alt = (form.get('alt') as string | null)?.trim() || null

  const buf = Buffer.from(await file.arrayBuffer())

  try {
    const uploaded = await uploadMedia({
      filename: file.name,
      contentType: file.type,
      bytes: buf,
    })
    const id = randomUUID()
    await db.insert(platformMedia).values({
      id,
      key: uploaded.key,
      url: uploaded.url,
      mimeType: file.type,
      sizeBytes: uploaded.sizeBytes,
      filename: file.name,
      alt,
      slot,
      uploadedBy: a.session!.user.id,
    })
    // If a slot was set, also invalidate the relevant page caches.
    if (slot) {
      if (slot.startsWith('hero.')) revalidatePath('/')
      else if (slot.startsWith('module.dawa.')) revalidatePath('/dawa')
      else if (slot.startsWith('module.retail.')) revalidatePath('/retail')
      else if (slot.startsWith('module.hardware.')) revalidatePath('/hardware')
      else if (slot.startsWith('module.hospitality.')) revalidatePath('/hospitality')
      else if (slot.startsWith('pricing.')) revalidatePath('/pricing')
    }
    return NextResponse.json({ ok: true, id, url: uploaded.url, key: uploaded.key })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message ?? e) },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  const rows = await db.select().from(platformMedia).where(eq(platformMedia.id, id)).limit(1)
  const row = rows[0]
  if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  try {
    await deleteMedia(row.key)
  } catch {
    // R2 might already be gone; keep DB delete idempotent.
  }
  await db.delete(platformMedia).where(eq(platformMedia.id, id))
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  const body = (await req.json().catch(() => ({}))) as { slot?: string | null; alt?: string | null }
  await db
    .update(platformMedia)
    .set({
      slot: body.slot === undefined ? undefined : body.slot,
      alt: body.alt === undefined ? undefined : body.alt,
    })
    .where(eq(platformMedia.id, id))
  return NextResponse.json({ ok: true })
}
