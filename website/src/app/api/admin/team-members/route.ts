/** Admin CRUD for public marketing-team records. */
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db, teamMembers, auditLog } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'
import { getApprovedTeamMemberPhoto } from '@/lib/team-member-media'

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

function rejectsRawPhotoUrl(body: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(body, 'photoUrl')
}

async function approvedMediaId(value: unknown): Promise<{ mediaId: string | null; error: string | null }> {
  if (value === null || value === '') return { mediaId: null, error: null }
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    return { mediaId: null, error: 'mediaId must be an approved media ID or null' }
  }
  const media = await getApprovedTeamMemberPhoto(value)
  if (!media) return { mediaId: null, error: 'Select an approved image from the licensed media library' }
  return { mediaId: media.id, error: null }
}

export async function GET() {
  const access = await requireAdmin()
  if (access.error) return access.error
  const rows = await db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder))
  return NextResponse.json({ ok: true, items: rows })
}

export async function POST(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (rejectsRawPhotoUrl(body)) {
    return NextResponse.json({ ok: false, error: 'Raw photo URLs are not accepted; use mediaId' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const role = String(body.role ?? '').trim()
  if (!name || !role) {
    return NextResponse.json({ ok: false, error: 'name and role are required' }, { status: 400 })
  }

  const photo = await approvedMediaId(body.mediaId ?? null)
  if (photo.error) return NextResponse.json({ ok: false, error: photo.error }, { status: 400 })

  const id = randomUUID()
  await db.insert(teamMembers).values({
    id,
    name,
    role,
    bio: body.bio ? String(body.bio) : null,
    mediaId: photo.mediaId,
    linkedinUrl: body.linkedinUrl ? String(body.linkedinUrl) : null,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    active: body.active === undefined ? true : Boolean(body.active),
  })
  await db.insert(auditLog).values({
    id: createId(),
    actorId: access.session!.user.id,
    action: 'team_member.create',
    resource: `team_member:${id}`,
    metadata: { name, role, mediaId: photo.mediaId },
  })
  revalidatePath('/team')
  return NextResponse.json({ ok: true, id })
}

export async function PATCH(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (rejectsRawPhotoUrl(body)) {
    return NextResponse.json({ ok: false, error: 'Raw photo URLs are not accepted; use mediaId' }, { status: 400 })
  }

  const patch: Partial<typeof teamMembers.$inferInsert> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.role !== undefined) patch.role = String(body.role).trim()
  if (body.bio !== undefined) patch.bio = body.bio ? String(body.bio) : null
  if (body.mediaId !== undefined) {
    const photo = await approvedMediaId(body.mediaId)
    if (photo.error) return NextResponse.json({ ok: false, error: photo.error }, { status: 400 })
    patch.mediaId = photo.mediaId
  }
  if (body.linkedinUrl !== undefined) patch.linkedinUrl = body.linkedinUrl ? String(body.linkedinUrl) : null
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0
  if (body.active !== undefined) patch.active = Boolean(body.active)

  await db.update(teamMembers).set(patch).where(eq(teamMembers.id, id))
  await db.insert(auditLog).values({
    id: createId(),
    actorId: access.session!.user.id,
    action: 'team_member.update',
    resource: `team_member:${id}`,
    metadata: { fields: Object.keys(patch) },
  })
  revalidatePath('/team')
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const access = await requireAdmin()
  if (access.error) return access.error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  await db.delete(teamMembers).where(eq(teamMembers.id, id))
  await db.insert(auditLog).values({
    id: createId(),
    actorId: access.session!.user.id,
    action: 'team_member.delete',
    resource: `team_member:${id}`,
    metadata: {},
  })
  revalidatePath('/team')
  return NextResponse.json({ ok: true })
}
