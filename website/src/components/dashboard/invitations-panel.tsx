'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/format-date'

interface Invite {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: string
}

/**
 * Invitations panel — list pending invites with Resend / Cancel + a
 * compact invite form (email + role).
 *
 * Calls:
 *   POST   /api/dashboard/team/invitations            { email, role }
 *   POST   /api/dashboard/team/invitations/[id]/resend
 *   DELETE /api/dashboard/team/invitations/[id]
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
    if (!confirm(`Cancel the invitation sent to ${email}? The link in their email will stop working.`)) return
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
      {/* Compose row */}
      {canManage ? (
        <form
          onSubmit={invite}
          className="flex flex-col gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Invite teammate to {orgName}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="h-9 w-full rounded-md border border-foreground/15 bg-background px-3 text-[13px] outline-none focus-visible:border-foreground/40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="h-9 rounded-md border border-foreground/15 bg-background px-3 text-[13px]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy === '__invite' || !email.trim()}
            className="h-9 rounded-md bg-foreground px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 disabled:opacity-50 cursor-pointer"
          >
            {busy === '__invite' ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 font-mono text-[11px] text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {/* Invitations list */}
      {invites.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No invitations yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10 overflow-hidden">
          {invites.map((inv) => {
            const isPending = inv.status === 'pending'
            return (
              <li
                key={inv.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[13px] font-medium truncate">{inv.email}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {inv.role ?? 'member'} · {inv.status}
                    {isPending ? ` · expires ${formatDate(inv.expiresAt)}` : ''}
                  </span>
                </div>
                {canManage && isPending ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => resend(inv.id)}
                      disabled={busy === inv.id}
                      className="rounded-md border border-foreground/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-foreground/[0.04] disabled:opacity-50 cursor-pointer"
                    >
                      {busy === inv.id ? 'Sending…' : 'Resend'}
                    </button>
                    <button
                      onClick={() => cancel(inv.id, inv.email)}
                      disabled={busy === inv.id}
                      className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer dark:text-rose-300"
                    >
                      Cancel
                    </button>
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
