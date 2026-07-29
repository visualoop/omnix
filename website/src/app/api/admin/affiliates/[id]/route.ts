import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auditLog, affiliates, db, withDbTransaction } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export const runtime = 'nodejs'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return { error: Response.json({ error: 'Sign in' }, { status: 401 }), session: null }
  if (session.user.role !== 'platform_admin') {
    return { error: Response.json({ error: 'Admin only' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

interface AffiliatePatchBody {
  commissionPercent?: unknown
  blocked?: unknown
  blockedReason?: unknown
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdmin()
  if (access.error) return access.error

  const { id } = await params
  const [current] = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1)
  if (!current) return Response.json({ error: 'Affiliate not found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as AffiliatePatchBody | null
  if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

  const updates: Partial<typeof affiliates.$inferInsert> = { updatedAt: new Date() }
  if (body.commissionPercent !== undefined) {
    const commissionPercent = Number(body.commissionPercent)
    if (!Number.isInteger(commissionPercent) || commissionPercent < 0 || commissionPercent > 60) {
      return Response.json({ error: 'Commission must be a whole number from 0 to 60.' }, { status: 400 })
    }
    updates.commissionPercent = commissionPercent
  }
  if (body.blocked !== undefined) {
    if (typeof body.blocked !== 'boolean') {
      return Response.json({ error: 'Blocked status must be true or false.' }, { status: 400 })
    }
    updates.blocked = body.blocked
    updates.blockedReason = body.blocked
      ? typeof body.blockedReason === 'string' && body.blockedReason.trim()
        ? body.blockedReason.trim().slice(0, 500)
        : current.blockedReason || 'Blocked by platform admin'
      : null
  } else if (body.blockedReason !== undefined) {
    if (typeof body.blockedReason !== 'string') {
      return Response.json({ error: 'Blocked reason must be text.' }, { status: 400 })
    }
    updates.blockedReason = body.blockedReason.trim().slice(0, 500) || null
  }

  await withDbTransaction(async (tx) => {
    await tx.update(affiliates).set(updates).where(eq(affiliates.id, id))
    await tx.insert(auditLog).values({
      id: createId(),
      actorId: access.session!.user.id,
      action: 'affiliate.admin_update',
      resource: `affiliate:${id}`,
      metadata: {
        userId: current.userId,
        previousBlocked: current.blocked,
        previousCommissionPercent: current.commissionPercent,
        updates: Object.keys(updates),
      },
    })
  })

  return Response.json({ ok: true })
}
