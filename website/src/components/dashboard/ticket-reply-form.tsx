'use client'

import * as React from 'react'
import { Send } from '@/components/icons'
import { Button } from '@/components/ui/button'

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const body = formData.get('body') as string

    try {
      const res = await fetch(`/api/support-tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not send reply')
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reply')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        name="body"
        required
        rows={5}
        placeholder="Your reply..."
        className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-3 text-[14px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
      />
      {error ? (
        <div className="rounded-md border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-3 py-2 text-[13px] text-[var(--color-fg)]">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send reply'}
          <Send className="size-4" />
        </Button>
      </div>
    </form>
  )
}
