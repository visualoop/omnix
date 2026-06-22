'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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
        <select name="category" defaultValue="general" className={inputClass}>
          <option value="general">General</option>
          <option value="billing">Billing</option>
          <option value="bug">Bug report</option>
          <option value="feature">Feature request</option>
        </select>
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue="normal" className={inputClass}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </Field>
      <Field label="Describe the problem">
        <textarea name="body" required rows={6} className={`${inputClass} font-mono`} />
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
