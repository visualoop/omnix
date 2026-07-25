'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { confirm } from '@/components/ui/dialog-imperative'

type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'

interface TicketActionsProps {
  ticketId: string
  status: string
  replyPage: number
}

export function TicketActions({ ticketId, status, replyPage }: TicketActionsProps) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState<'reply' | 'status' | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = reply.trim()
    if (!body || busy) return
    setBusy('reply')
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? `Reply failed (${response.status})`)
      }
      setReply('')
      setNotice({ kind: 'success', text: 'Reply sent. The customer can now see it in their dashboard.' })
      router.push(replyPage > 1 ? `/admin/tickets/${ticketId}?msgPage=${replyPage}` : `/admin/tickets/${ticketId}`)
      router.refresh()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not send reply.' })
    } finally {
      setBusy(null)
    }
  }

  async function changeStatus(nextStatus: TicketStatus) {
    if (busy) return
    if (nextStatus === 'closed') {
      const approved = await confirm({
        title: 'Close this ticket?',
        description: 'The customer can still send a follow-up, which will reopen it automatically.',
        confirmText: 'Close ticket',
        variant: 'warning',
      })
      if (!approved) return
    }

    setBusy('status')
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? `Status update failed (${response.status})`)
      }
      setNotice({
        kind: 'success',
        text: nextStatus === 'open' ? 'Ticket reopened.' : nextStatus === 'closed' ? 'Ticket closed.' : 'Ticket marked resolved.',
      })
      router.refresh()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not update ticket.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="ticket-actions-title" className="border-y border-[var(--color-border)] py-5">
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <form onSubmit={submitReply} className="flex flex-col gap-3">
          <div>
            <h2 id="ticket-actions-title" className="text-[14px] font-semibold text-[var(--color-fg)]">Reply to customer</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">
              This reply appears in the buyer dashboard and is also sent to their account email.
            </p>
          </div>
          <Textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={5}
            maxLength={10_000}
            placeholder="Write a clear response or ask for the next detail you need…"
            aria-label="Reply to ticket"
            disabled={busy !== null}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">{reply.length.toLocaleString()} / 10,000</span>
            <Button type="submit" disabled={busy !== null || !reply.trim()}>
              {busy === 'reply' ? 'Sending…' : 'Send reply'}
            </Button>
          </div>
        </form>

        <div className="flex min-w-[180px] flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">Ticket status</p>
          {status === 'closed' || status === 'resolved' ? (
            <Button type="button" variant="outline" onClick={() => void changeStatus('open')} disabled={busy !== null}>
              {busy === 'status' ? 'Updating…' : 'Reopen ticket'}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => void changeStatus('resolved')} disabled={busy !== null}>
                Mark resolved
              </Button>
              <Button type="button" variant="outline" onClick={() => void changeStatus('closed')} disabled={busy !== null}>
                Close ticket
              </Button>
            </>
          )}
        </div>
      </div>

      {notice ? (
        <Alert variant={notice.kind} className="mt-4" title={notice.kind === 'success' ? 'Ticket updated' : 'Action failed'}>
          {notice.text}
        </Alert>
      ) : null}
    </section>
  )
}
