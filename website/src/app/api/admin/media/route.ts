/** Admin-only licensed media management. */
import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { auditLog, db, platformMedia } from '@/db'
import { auth } from '@/lib/auth'
import {
  isMediaRightsBasis,
  validateMediaProvenance,
  type MediaApprovalState,
} from '@/lib/media-governance'
import { isMediaSlot, mediaTypeForSlot } from '@/lib/media-slots'
import {
  ACCEPTED_MEDIA_TYPES,
  MAX_UPLOAD_BYTES,
  deletePublishedMedia,
  deleteQuarantinedMedia,
  getQuarantinePreviewUrl,
  promoteQuarantinedMedia,
  uploadMediaToQuarantine,
} from '@/lib/r2-media'

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

function revalidateMedia() {
  // Bust the full-route cache for the marketing shell...
  revalidatePath('/', 'layout')
  // ...and the tagged media-slots data cache so getSlotMedia re-resolves now
  // instead of waiting out its bounded revalidate window.
  revalidateTag('media-slots', { expire: 0 })
}

function formText(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function isApprovalState(value: unknown): value is MediaApprovalState {
  return value === 'pending' || value === 'approved' || value === 'rejected'
}

function fileMatchesSlot(mimeType: string, slot: string | null): boolean {
  if (!slot) return true
  const type = mediaTypeForSlot(slot)
  return (type === 'image' && mimeType.startsWith('image/')) || (type === 'video' && mimeType.startsWith('video/'))
}

async function adminPreviewUrl(row: typeof platformMedia.$inferSelect): Promise<string | null> {
  if (row.objectState === 'published' && row.url) return row.url
  if (row.objectState === 'quarantine' && row.quarantineKey) {
    return getQuarantinePreviewUrl(row.quarantineKey).catch(() => null)
  }
  return null
}

export async function GET() {
  const access = await requireAdmin()
  if (access.error) return access.error
  const rows = await db.select().from(platformMedia).orderBy(desc(platformMedia.createdAt)).limit(500)
  const items = await Promise.all(rows.map(async (row) => ({ ...row, previewUrl: await adminPreviewUrl(row) })))
  return NextResponse.json({ ok: true, items })
}

export async function POST(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Choose a media file to upload.' }, { status: 400 })
  }
  if (!ACCEPTED_MEDIA_TYPES.includes(file.type as (typeof ACCEPTED_MEDIA_TYPES)[number])) {
    return NextResponse.json({ ok: false, error: `Unsupported type: ${file.type}.` }, { status: 415 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'File too large. Maximum size is 50 MB.' }, { status: 413 })
  }

  const slot = formText(form, 'slot') || null
  if (slot && !isMediaSlot(slot)) {
    return NextResponse.json({ ok: false, error: 'Unknown media slot.' }, { status: 400 })
  }
  if (!fileMatchesSlot(file.type, slot)) {
    return NextResponse.json({ ok: false, error: 'The selected file type does not match this slot.' }, { status: 400 })
  }

  const alt = formText(form, 'alt')
  const rightsBasis = formText(form, 'rightsBasis')
  const rightsHolder = formText(form, 'rightsHolder')
  const rightsSource = formText(form, 'rightsSource')
  const provenanceError = validateMediaProvenance({ alt, rightsBasis, rightsHolder, rightsSource })
  if (provenanceError) return NextResponse.json({ ok: false, error: provenanceError }, { status: 400 })
  if (!isMediaRightsBasis(rightsBasis)) {
    return NextResponse.json({ ok: false, error: 'Select a valid rights basis.' }, { status: 400 })
  }

  let uploaded: Awaited<ReturnType<typeof uploadMediaToQuarantine>> | null = null
  try {
    uploaded = await uploadMediaToQuarantine({
      filename: file.name,
      contentType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    })
    const id = randomUUID()
    await db.insert(platformMedia).values({
      id,
      key: '',
      url: '',
      quarantineKey: uploaded.quarantineKey,
      objectState: 'quarantine',
      mimeType: file.type,
      sizeBytes: uploaded.sizeBytes,
      filename: file.name,
      alt,
      slot,
      rightsBasis,
      rightsHolder,
      rightsSource,
      approvalState: 'pending',
      approvedBy: null,
      approvalAuditId: null,
      approvedAt: null,
      uploadedBy: access.session!.user.id,
    })
    revalidateMedia()
    return NextResponse.json({ ok: true, id, approvalState: 'pending' })
  } catch (error) {
    // Best-effort private cleanup only: the insert failed, so NO DB row (and
    // therefore no publication or tombstone) claims this private quarantine
    // object exists. A failed cleanup here leaks at most an orphaned private,
    // no-store object that is unreachable publicly and unreferenced, so we do
    // not fail the request on it.
    if (uploaded) await deleteQuarantinedMedia(uploaded.quarantineKey).catch(() => undefined)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

interface MediaPatchBody {
  slot?: unknown
  alt?: unknown
  rightsBasis?: unknown
  rightsHolder?: unknown
  rightsSource?: unknown
  approvalState?: unknown
}

export async function PATCH(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })

  const current = (await db.select().from(platformMedia).where(eq(platformMedia.id, id)).limit(1))[0]
  if (!current) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as MediaPatchBody
  const nextSlot = body.slot === undefined
    ? current.slot
    : body.slot === null || body.slot === ''
      ? null
      : typeof body.slot === 'string' && isMediaSlot(body.slot)
        ? body.slot
        : undefined
  if (body.slot !== undefined && nextSlot === undefined) {
    return NextResponse.json({ ok: false, error: 'Unknown media slot.' }, { status: 400 })
  }
  if (!fileMatchesSlot(current.mimeType, nextSlot ?? null)) {
    return NextResponse.json({ ok: false, error: 'The media type does not match this slot.' }, { status: 400 })
  }

  for (const [field, value] of [['alt', body.alt], ['rights holder', body.rightsHolder], ['rights source', body.rightsSource]] as const) {
    if (value !== undefined && typeof value !== 'string') {
      return NextResponse.json({ ok: false, error: `${field} must be text.` }, { status: 400 })
    }
  }
  if (body.rightsBasis !== undefined && !isMediaRightsBasis(body.rightsBasis)) {
    return NextResponse.json({ ok: false, error: 'Select a valid rights basis.' }, { status: 400 })
  }
  if (body.approvalState !== undefined && !isApprovalState(body.approvalState)) {
    return NextResponse.json({ ok: false, error: 'Invalid approval state.' }, { status: 400 })
  }

  const next = {
    alt: typeof body.alt === 'string' ? body.alt.trim() : current.alt,
    rightsBasis: typeof body.rightsBasis === 'string' ? body.rightsBasis : current.rightsBasis,
    rightsHolder: typeof body.rightsHolder === 'string' ? body.rightsHolder.trim() : current.rightsHolder,
    rightsSource: typeof body.rightsSource === 'string' ? body.rightsSource.trim() : current.rightsSource,
  }
  const metadataChanged = nextSlot !== current.slot
    || next.alt !== current.alt
    || next.rightsBasis !== current.rightsBasis
    || next.rightsHolder !== current.rightsHolder
    || next.rightsSource !== current.rightsSource
  const currentApproval: MediaApprovalState = isApprovalState(current.approvalState) ? current.approvalState : 'pending'
  const nextApproval: MediaApprovalState = isApprovalState(body.approvalState) ? body.approvalState : currentApproval

  if (currentApproval === 'approved' && metadataChanged && body.approvalState !== 'approved') {
    return NextResponse.json({
      ok: false,
      error: 'Changes to approved media must be checked and submitted with Approve.',
    }, { status: 409 })
  }
  if (current.objectState === 'published' && nextApproval === 'pending') {
    return NextResponse.json({
      ok: false,
      error: 'Published media may only be reapproved or rejected.',
    }, { status: 409 })
  }
  if (currentApproval === 'approved' && !metadataChanged && body.approvalState === undefined) {
    return NextResponse.json({ ok: true, approvalState: currentApproval })
  }

  if (nextApproval === 'approved') {
    const error = validateMediaProvenance(next)
    if (error) return NextResponse.json({ ok: false, error }, { status: 400 })
    if (current.objectState === 'deleted') {
      return NextResponse.json({ ok: false, error: 'Rejected media must be uploaded again before approval.' }, { status: 409 })
    }

    let promoted: Awaited<ReturnType<typeof promoteQuarantinedMedia>> | null = null
    try {
      if (current.objectState === 'quarantine') {
        if (!current.quarantineKey) throw new Error('The private review object is missing.')
        promoted = await promoteQuarantinedMedia({ quarantineKey: current.quarantineKey, contentType: current.mimeType })
      }
      const auditId = randomUUID()
      const approvedAt = new Date()
      const key = promoted?.key ?? current.key
      const url = promoted?.url ?? current.url
      await db.batch([
        db.insert(auditLog).values({
          id: auditId,
          actorId: access.session!.user.id,
          action: 'media.approve',
          resource: `platform_media:${id}`,
          metadata: { slot: nextSlot, rightsBasis: next.rightsBasis, key },
        }),
        db.update(platformMedia).set({
          slot: nextSlot,
          ...next,
          key,
          url,
          quarantineKey: null,
          objectState: 'published',
          approvalState: 'approved',
          approvedBy: access.session!.user.id,
          approvalAuditId: auditId,
          approvedAt,
        }).where(eq(platformMedia.id, id)),
      ])
      if (promoted && current.quarantineKey) {
        // Best-effort private cleanup only, and only AFTER the publish
        // transaction has committed: the published public object is now the
        // source of truth, so the superseded private quarantine copy is
        // redundant. It is private and no-store, so a failed cleanup leaks
        // only a harmless, unreferenced object and must never undo a
        // successful, audited publication.
        await deleteQuarantinedMedia(current.quarantineKey).catch(() => undefined)
      }
    } catch (error) {
      // The promotion or the publish transaction failed. If we had already
      // promoted a private object into the public bucket, that public object
      // is now orphaned — no committed DB row claims it. Remove it so no
      // untracked public object survives, and do NOT swallow a failed removal:
      // an orphaned public object with no provenance record is a trust leak
      // that must surface (it propagates to a 500) so an operator can clean it
      // up, rather than being silently dropped.
      if (promoted) await deletePublishedMedia(promoted.key)
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
  } else {
    const rejected = nextApproval === 'rejected'
    try {
      if (current.objectState === 'published' && current.key) {
        await deletePublishedMedia(current.key)
      }
      if (current.objectState === 'quarantine' && current.quarantineKey && rejected) {
        await deleteQuarantinedMedia(current.quarantineKey)
      }
      await db.update(platformMedia).set({
        slot: nextSlot,
        ...next,
        key: current.objectState === 'published' ? '' : current.key,
        url: current.objectState === 'published' ? '' : current.url,
        quarantineKey: rejected ? null : current.quarantineKey,
        objectState: rejected || current.objectState === 'published' ? 'deleted' : current.objectState,
        approvalState: nextApproval,
        approvedBy: null,
        approvalAuditId: null,
        approvedAt: null,
      }).where(eq(platformMedia.id, id))
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
  }

  revalidateMedia()
  return NextResponse.json({ ok: true, approvalState: nextApproval })
}

export async function DELETE(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })

  const row = (await db.select().from(platformMedia).where(eq(platformMedia.id, id)).limit(1))[0]
  if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  try {
    // Delete/quarantine the public + private objects so nothing is served,
    // but keep the DB row as an audited tombstone: the rights/provenance
    // fields (rightsBasis / rightsHolder / rightsSource / alt / filename /
    // uploadedBy / createdAt) survive for the licence trail. Public resolvers
    // (getSlotMedia / getApprovedMediaById / listApprovedMediaPhotos) already
    // require objectState = 'published', so flipping to 'deleted' is
    // fail-closed by construction.
    //
    // These removals are NOT best-effort: the tombstone + audit written below
    // assert that both the private review copy and the public object are gone.
    // If either removal fails we must not commit a record that claims
    // otherwise, so we let the failure throw to the outer catch (controlled
    // 500) with the row left untouched — rather than swallowing it and
    // recording a false "deleted" provenance state over an object that is
    // still live and servable.
    if (row.quarantineKey) await deleteQuarantinedMedia(row.quarantineKey)
    if (row.key) await deletePublishedMedia(row.key)

    const auditId = randomUUID()
    await db.batch([
      db.insert(auditLog).values({
        id: auditId,
        actorId: access.session!.user.id,
        action: 'media.delete',
        resource: `platform_media:${id}`,
        metadata: {
          slot: row.slot,
          rightsBasis: row.rightsBasis,
          key: row.key,
          previousObjectState: row.objectState,
          previousApprovalState: row.approvalState,
        },
      }),
      db.update(platformMedia).set({
        // Remove all public/private object references (public removal).
        key: '',
        url: '',
        quarantineKey: null,
        objectState: 'deleted',
        // No longer eligible for publication; drop the approval linkage so it
        // can never resolve publicly again.
        approvalState: 'rejected',
        approvedBy: null,
        approvalAuditId: null,
        approvedAt: null,
        // NOTE: rightsBasis / rightsHolder / rightsSource / alt / filename /
        // uploadedBy / createdAt are intentionally NOT cleared — the audited
        // rights record is retained.
      }).where(eq(platformMedia.id, id)),
    ])

    revalidateMedia()
    return NextResponse.json({ ok: true, objectState: 'deleted', approvalState: 'rejected', auditId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
