import { headers } from 'next/headers'
import { db, supportTickets, supportMessages } from '@/db'
import { auth } from '@/lib/auth'
import { createId } from '@/lib/ids'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => null) as null | {
    subject?: string
    category?: string
    priority?: string
    body?: string
  }
  if (!body?.subject || !body.body) {
    return Response.json({ error: 'subject and body required' }, { status: 400 })
  }

  const ticketId = createId()
  await db.insert(supportTickets).values({
    id: ticketId,
    userId: session.user.id,
    subject: body.subject.slice(0, 200),
    category: body.category ?? 'general',
    priority: body.priority ?? 'normal',
    status: 'open',
  })
  await db.insert(supportMessages).values({
    id: createId(),
    ticketId,
    senderId: session.user.id,
    body: body.body,
  })

  return Response.json({ id: ticketId })
}
