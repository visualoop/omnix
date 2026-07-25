import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import {
  auditLog,
  db,
  supportMessages,
  supportTickets,
  user,
  withDbTransaction,
} from '@/db'
import { auth } from '@/lib/auth'
import { sendSupportReplyEmail } from '@/lib/email'
import { createId } from '@/lib/ids'
import {
  DESK_ACCESS,
  isDeskAllowed,
  type StaffContext,
  type StaffRole,
} from '@/lib/permissions/admin-guard'

const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const
type TicketStatus = (typeof TICKET_STATUSES)[number]

async function authorizeStaff(): Promise<
  | { ok: true; staff: StaffContext; name: string }
  | { ok: false; response: Response }
> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: 'unauthenticated' }, { status: 401 }),
    }
  }
  const role = ((session.user as { role?: string }).role ?? 'user') as StaffRole
  if (!isDeskAllowed(role, DESK_ACCESS.tickets)) {
    return {
      ok: false,
      response: Response.json({ error: 'forbidden' }, { status: 403 }),
    }
  }
  return {
    ok: true,
    staff: { userId: session.user.id, email: session.user.email, role },
    name: session.user.name || session.user.email,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeStaff()
  if (!authorization.ok) return authorization.response

  const { id } = await params
  const input = (await request.json().catch(() => null)) as { body?: string } | null
  const body = input?.body?.trim() ?? ''
  if (!body) return Response.json({ error: 'reply is required' }, { status: 400 })
  if (body.length > 10_000) {
    return Response.json({ error: 'reply must be 10,000 characters or fewer' }, { status: 400 })
  }

  const [row] = await db
    .select({ ticket: supportTickets, reporter: user })
    .from(supportTickets)
    .innerJoin(user, eq(user.id, supportTickets.userId))
    .where(eq(supportTickets.id, id))
    .limit(1)
  if (!row) return Response.json({ error: 'ticket not found' }, { status: 404 })

  const now = new Date()
  await withDbTransaction(async (tx) => {
    await tx.insert(supportMessages).values({
      id: createId(),
      ticketId: id,
      senderId: authorization.staff.userId,
      body,
    })
    await tx
      .update(supportTickets)
      .set({
        status: 'pending',
        assignedTo: row.ticket.assignedTo ?? authorization.staff.userId,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, id))
    await tx.insert(auditLog).values({
      id: createId(),
      actorId: authorization.staff.userId,
      action: 'ticket.reply',
      resource: `ticket:${id}`,
      metadata: { previousStatus: row.ticket.status, nextStatus: 'pending' },
    })
  })

  await sendSupportReplyEmail({
    to: row.reporter.email,
    ticketSubject: row.ticket.subject,
    ticketId: id,
    body,
    agentName: authorization.name,
  }).catch((error: unknown) => {
    console.error(
      '[support] reply email delivery failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
  })

  return Response.json({ ok: true, status: 'pending' })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeStaff()
  if (!authorization.ok) return authorization.response

  const { id } = await params
  const input = (await request.json().catch(() => null)) as { status?: string } | null
  if (!input?.status || !TICKET_STATUSES.includes(input.status as TicketStatus)) {
    return Response.json(
      { error: `status must be one of ${TICKET_STATUSES.join(' / ')}` },
      { status: 400 },
    )
  }
  const status = input.status as TicketStatus

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1)
  if (!ticket) return Response.json({ error: 'ticket not found' }, { status: 404 })

  await withDbTransaction(async (tx) => {
    await tx
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
    await tx.insert(auditLog).values({
      id: createId(),
      actorId: authorization.staff.userId,
      action: status === 'closed' ? 'ticket.close' : status === 'open' ? 'ticket.reopen' : 'ticket.status',
      resource: `ticket:${id}`,
      metadata: { previousStatus: ticket.status, nextStatus: status },
    })
  })

  return Response.json({ ok: true, status })
}
