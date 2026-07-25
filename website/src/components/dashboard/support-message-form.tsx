'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface SupportMessageFormProps {
  ticketId: string
  status: string
  replyPage: number
}

export function SupportMessageForm({ ticketId, status, replyPage }: SupportMessageFormProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = message.trim()
    if (!body || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? `Message failed (${response.status})`)
      }
      setMessage('')
      setNotice({
        kind: 'success',
        text: status === 'closed' || status === 'resolved'
          ? 'Message sent and ticket reopened for support.'
          : 'Message sent to Omnix support.',
      })
      router.push(replyPage > 1 ? `/dashboard/support/${ticketId}?msgPage=${replyPage}` : `/dashboard/support/${ticketId}`)
      router.refresh()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not send message.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="support-follow-up-title" className="border-t border-[var(--color-border)] pt-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <h2 id="support-follow-up-title" className="text-[14px] font-semibold text-[var(--color-fg)]">Add to conversation</h2>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">
            {status === 'closed' || status === 'resolved'
              ? 'Sending a follow-up will reopen this ticket.'
              : 'Share an update, answer a support question, or add details that may help.'}
          </p>
        </div>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={10_000}
          placeholder="Write your follow-up…"
          aria-label="Add a message to this support ticket"
          disabled={busy}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">{message.length.toLocaleString()} / 10,000</span>
          <Button type="submit" disabled={busy || !message.trim()}>
            {busy ? 'Sending…' : 'Send message'}
          </Button>
        </div>
      </form>

      {notice ? (
        <Alert variant={notice.kind} className="mt-4" title={notice.kind === 'success' ? 'Message sent' : 'Could not send message'}>
          {notice.text}
        </Alert>
      ) : null}
    </section>
  )
}
