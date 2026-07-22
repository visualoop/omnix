'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function NewTicketForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: String(formData.get('subject') ?? '').trim(),
          category: String(formData.get('category') ?? 'general'),
          priority: String(formData.get('priority') ?? 'normal'),
          body: String(formData.get('body') ?? '').trim(),
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `Could not open ticket (${res.status})`)
      }
      const ticket = await res.json()
      router.push(`/dashboard/support/${ticket.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open ticket.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Subject" required>
        <Input name="subject" required placeholder="Short summary of the issue" />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-category">Category</Label>
          <Select name="category" defaultValue="general">
            <SelectTrigger id="ticket-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="bug">Bug report</SelectItem>
              <SelectItem value="feature">Feature request</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-priority">Priority</Label>
          <Select name="priority" defaultValue="normal">
            <SelectTrigger id="ticket-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Field label="Describe the problem" required>
        <Textarea name="body" required rows={6} placeholder="What happened, and what did you expect?" />
      </Field>

      {error ? (
        <Alert variant="error" title="Could not open ticket">
          {error}
        </Alert>
      ) : null}

      <div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Opening…' : 'Open ticket'}
        </Button>
      </div>
    </form>
  )
}
