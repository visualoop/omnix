'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirm } from '@/components/ui/dialog-imperative'
import { formatDate } from '@/lib/format-date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/dashboard/status-utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Invite {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: string
}

/**
 * Invitations panel — list pending invites with Resend / Cancel plus a
 * compact invite form (email + role).
 *
 * Preserves the Better Auth organisation invitation lifecycle endpoints:
 *   POST   /api/dashboard/team/invitations            { email, role }
 *   POST   /api/dashboard/team/invitations/[id]/resend
 *   DELETE /api/dashboard/team/invitations/[id]
 *
 * The server owns anti-enumeration and duplicate handling; this panel only
 * renders the outcome. Management controls are gated on `canManage`, but
 * that gate is UI-only — the API enforces authorization independently.
 */
export function InvitationsPanel({
  invites: initial,
  canManage,
  orgName,
}: {
  invites: Invite[]
  canManage: boolean
  orgName: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [invites, setInvites] = useState(initial)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy('__invite')
    try {
      const res = await fetch('/api/dashboard/team/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; resent?: boolean }
      if (!data.ok) {
        setError(data.error ?? 'Could not send invitation')
        return
      }
      setEmail('')
      startTransition(() => router.refresh())
    } finally {
      setBusy(null)
    }
  }

  async function resend(id: string) {
    setError(null)
    setBusy(id)
    try {
      const res = await fetch(`/api/dashboard/team/invitations/${id}/resend`, { method: 'POST' })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ?? 'Could not resend')
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusy(null)
    }
  }

  async function cancel(id: string, email: string) {
    if (
      !(await confirm({
        title: `Cancel invitation to ${email}?`,
        description: 'The link in their email will stop working.',
        variant: 'destructive',
        confirmText: 'Cancel invitation',
      }))
    )
      return
    setError(null)
    setBusy(id)
    try {
      const res = await fetch(`/api/dashboard/team/invitations/${id}`, { method: 'DELETE' })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ?? 'Could not cancel')
        return
      }
      setInvites((prev) => prev.filter((i) => i.id !== id))
      startTransition(() => router.refresh())
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <form
          onSubmit={invite}
          className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-end"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="invite-email">Invite a teammate to {orgName}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(String(v) as 'admin' | 'member')}>
              <SelectTrigger id="invite-role" className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy === '__invite' || !email.trim()} className="max-sm:w-full">
            {busy === '__invite' ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
      ) : null}

      {error ? (
        <Alert variant="error" title="Invitation action failed">
          {error}
        </Alert>
      ) : null}

      {invites.length === 0 ? (
        <EmptyState
          title="No invitations yet"
          body={
            canManage
              ? 'Invite a teammate above and they will show up here until they accept.'
              : 'Your organisation owner can invite teammates from here.'
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {invites.map((inv) => {
            const isPending = inv.status === 'pending'
            return (
              <li
                key={inv.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-[var(--color-fg)]">{inv.email}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                    {inv.role ?? 'member'} · {inv.status}
                    {isPending ? ` · expires ${formatDate(inv.expiresAt)}` : ''}
                  </span>
                </div>
                {canManage && isPending ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => resend(inv.id)}
                      disabled={busy === inv.id}
                    >
                      {busy === inv.id ? 'Sending…' : 'Resend'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => cancel(inv.id, inv.email)}
                      disabled={busy === inv.id}
                      className="text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)]"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
