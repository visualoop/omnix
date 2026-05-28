import type { Endpoint } from 'payload'
import { errorResponse, jsonResponse, readJson } from './_auth'

/**
 * POST /api/support-tickets/:id/reply
 * Customer-authenticated. Appends a reply to the thread of a ticket the
 * customer owns.
 */
export const supportTicketsReplyEndpoint: Endpoint = {
  path: '/support-tickets/:id/reply',
  method: 'post',
  handler: async (req) => {
    if (req.user?.collection !== 'customers') {
      return errorResponse('Sign in required', 401)
    }
    const id = (req.routeParams?.id as string | undefined) ?? ''
    if (!id) return errorResponse('Missing ticket id', 400)

    const body = await readJson<{ body?: string }>(req)
    if (!body || !body.body || body.body.trim().length === 0) {
      return errorResponse('Reply body required', 400)
    }

    let ticket
    try {
      ticket = (await req.payload.findByID({
        collection: 'support-tickets',
        id,
        depth: 0,
      })) as unknown as {
        id: string | number
        customer: string | { id: string | number }
        thread?: Array<{
          sender: string
          senderName?: string
          body?: unknown
          sentAt?: string
        }>
        status: string
      }
    } catch {
      return errorResponse('Ticket not found', 404)
    }

    const ownerId =
      typeof ticket.customer === 'string' ? ticket.customer : ticket.customer?.id
    if (String(ownerId) !== String(req.user.id)) {
      return errorResponse('Not your ticket', 403)
    }

    const customer = req.user as unknown as { fullName?: string; email?: string }
    const senderName = customer.fullName ?? customer.email?.split('@')[0] ?? 'You'

    // Convert plain text → minimal lexical rich-text shape
    const lexical = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: body.body.split('\n').map((line) => ({
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            {
              type: 'text',
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
              text: line,
              version: 1,
            },
          ],
        })),
      },
    }

    const updatedThread = [
      ...(ticket.thread ?? []),
      {
        sender: 'customer' as const,
        senderName,
        body: lexical as never,
        sentAt: new Date().toISOString(),
      },
    ]

    await req.payload.update({
      collection: 'support-tickets',
      id,
      data: {
        thread: updatedThread as never,
        status:
          ticket.status === 'awaiting_customer'
            ? 'in_progress'
            : (ticket.status as 'new' | 'in_progress' | 'awaiting_customer' | 'resolved' | 'closed'),
      },
      overrideAccess: true,
    })

    return jsonResponse({ ok: true })
  },
}
