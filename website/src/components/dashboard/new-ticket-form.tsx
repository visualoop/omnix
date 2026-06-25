'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Subject"><input name="subject" required className={inputClass} /></Field>
      <Field label="Category">
        <Select name="category" defaultValue="general">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="bug">Bug report</SelectItem>
            <SelectItem value="feature">Feature request</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Priority">
        <Select name="priority" defaultValue="normal">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Describe the problem">
        <Textarea name="body" required rows={6} className={`${inputClass} font-mono`} />
      </Field>
      {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? 'Opening…' : 'Open ticket'}</Button>
    </form>
  )
}

const inputClass = 'w-full h-10 rounded-md border border-[var(--color-border)] bg-transparent px-3 text-[14px] focus:outline-none focus:border-[var(--color-fg-muted)]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">{label}</span>
      {children}
    </label>
  )
}
