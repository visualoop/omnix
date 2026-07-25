import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import {
  auditLog,
  db,
  supportMessages,
  supportTickets,
  withDbTransaction,
} from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const { id } = await params
  const input = (await request.json().catch(() => null)) as { body?: string } | null
  const body = input?.body?.trim() ?? ''
  if (!body) return Response.json({ error: 'message is required' }, { status: 400 })
  if (body.length > 10_000) {
    return Response.json({ error: 'message must be 10,000 characters or fewer' }, { status: 400 })
  }

  // Ownership is enforced in the same query as the ID lookup so another
  // customer's ticket is indistinguishable from a missing ticket.
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, session.user.id)))
    .limit(1)
  if (!ticket) return Response.json({ error: 'ticket not found' }, { status: 404 })

  await withDbTransaction(async (tx) => {
    await tx.insert(supportMessages).values({
      id: createId(),
      ticketId: id,
      senderId: session.user.id,
      body,
    })
    await tx
      .update(supportTickets)
      .set({ status: 'open', updatedAt: new Date() })
      .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, session.user.id)))
    await tx.insert(auditLog).values({
      id: createId(),
      actorId: session.user.id,
      action: 'ticket.customer_reply',
      resource: `ticket:${id}`,
      metadata: { previousStatus: ticket.status, nextStatus: 'open' },
    })
  })

  return Response.json({ ok: true, status: 'open' })
}
