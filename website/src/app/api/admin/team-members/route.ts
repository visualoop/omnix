/**
 * Team-members management (public marketing team).
 *
 *   GET    /api/admin/team-members        — list all (admin) ordered by sort
 *   POST   /api/admin/team-members        — create { name, role, bio?, photoUrl?, linkedinUrl?, sortOrder?, active? }
 *   PATCH  /api/admin/team-members?id=…   — update any field
 *   DELETE /api/admin/team-members?id=…   — remove
 *
 * Photos: upload via /api/admin/media first, then pass the returned URL
 * as photoUrl here. Auth: platform_admin only.
 */
import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { asc, eq } from 'drizzle-orm'
import { db, teamMembers } from '@/db'
import { auth } from '@/lib/auth'

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
  const a = await requireAdmin()
  if (a.error) return a.error
  const rows = await db.select().from(teamMembers).orderBy(asc(teamMembers.sortOrder))
  return NextResponse.json({ ok: true, items: rows })
}

export async function POST(req: Request) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const name = String(body.name ?? '').trim()
  const role = String(body.role ?? '').trim()
  if (!name || !role) {
    return NextResponse.json({ ok: false, error: 'name and role are required' }, { status: 400 })
  }
  const id = randomUUID()
  await db.insert(teamMembers).values({
    id,
    name,
    role,
    bio: body.bio ? String(body.bio) : null,
    photoUrl: body.photoUrl ? String(body.photoUrl) : null,
    linkedinUrl: body.linkedinUrl ? String(body.linkedinUrl) : null,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    active: body.active === undefined ? true : Boolean(body.active),
  })
  revalidatePath('/team')
  return NextResponse.json({ ok: true, id })
}

export async function PATCH(req: Request) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name)
  if (body.role !== undefined) patch.role = String(body.role)
  if (body.bio !== undefined) patch.bio = body.bio ? String(body.bio) : null
  if (body.photoUrl !== undefined) patch.photoUrl = body.photoUrl ? String(body.photoUrl) : null
  if (body.linkedinUrl !== undefined) patch.linkedinUrl = body.linkedinUrl ? String(body.linkedinUrl) : null
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0
  if (body.active !== undefined) patch.active = Boolean(body.active)
  await db.update(teamMembers).set(patch).where(eq(teamMembers.id, id))
  revalidatePath('/team')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const a = await requireAdmin()
  if (a.error) return a.error
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  await db.delete(teamMembers).where(eq(teamMembers.id, id))
  revalidatePath('/team')
  return NextResponse.json({ ok: true })
}
