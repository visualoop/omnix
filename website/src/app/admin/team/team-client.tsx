'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirm, prompt } from '@/components/ui/dialog-imperative'
import {
  UserPlus, Prohibit, Check, ArrowsClockwise,
} from '@phosphor-icons/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Member {
  id: string
  email: string
  name: string | null
  role: string | null
  banned: boolean
  banReason: string | null
  createdAt: string
}

const ROLES = [
  { value: 'platform_admin', label: 'Platform admin', hint: 'full access' },
  { value: 'support_agent',  label: 'Support agent',  hint: 'tickets + customers' },
  { value: 'sales_rep',      label: 'Sales rep',      hint: 'customers + payments' },
] as const

const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'Platform admin',
  support_agent: 'Support agent',
  sales_rep: 'Sales rep',
  user: 'Customer',
}

/** Bottom-right ephemeral status line, shared shape across both panels. */
function Toast({ toast }: { toast: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!toast) return null
  return (
    <div
      role={toast.kind === 'ok' ? 'status' : 'alert'}
      aria-live={toast.kind === 'ok' ? 'polite' : 'assertive'}
      className={`fixed bottom-6 right-6 z-50 rounded-md px-4 py-3 text-[13px] shadow-sm ${
        toast.kind === 'ok'
          ? 'border border-[var(--color-positive)] bg-[var(--color-surface)]'
          : 'border border-[var(--color-negative)] bg-[var(--color-surface)]'
      }`}
      style={{ color: toast.kind === 'ok' ? 'var(--color-positive)' : 'var(--color-negative)' }}
    >
      {toast.text}
    </div>
  )
}

/**
 * Invite form. On success it asks the server component to re-render
 * (`router.refresh()`), which re-runs the paginated roster query — the
 * server stays the single source of truth for what's on the page.
 */
export function TeamInvite() {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<typeof ROLES[number]['value']>('support_agent')

  function flash(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  function invite() {
    if (!email.trim()) return
    startTransition(async () => {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
      })
      const j = await res.json()
      if (j.ok) {
        flash('ok', j.created ? `Invited ${email}` : `Updated ${email} to ${ROLE_LABEL[role]}`)
        setEmail('')
        setName('')
        router.refresh()
      } else {
        flash('err', j.error ?? 'Invite failed')
      }
    })
  }

  return (
    <>
      <Toast toast={toast} />
      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <header className="mb-4 flex items-center gap-2">
          <UserPlus weight="regular" className="size-4 text-[var(--color-accent)]" />
          <h3
            style={{ fontFamily: 'var(--font-display)' }}
            className="text-[18px] font-medium text-[var(--color-fg)] tracking-[-0.01em]"
          >
            Invite a teammate
          </h3>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label
              htmlFor="team-invite-email"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] block mb-1.5"
            >
              Email
            </label>
            <input
              id="team-invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@yourdomain.com"
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] text-[var(--color-fg)]"
            />
          </div>
          <div>
            <label
              htmlFor="team-invite-name"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] block mb-1.5"
            >
              Name (optional)
            </label>
            <input
              id="team-invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aisha Wanjiku"
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] text-[var(--color-fg)]"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] block mb-1.5">
              Role
            </label>
            <Select value={role} onValueChange={(v) => setRole(String(v) as typeof role)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent></Select>
          </div>
          <button
            onClick={invite}
            disabled={busy || !email.trim()}
            className="rounded-md bg-[var(--color-accent)] px-5 py-2 text-[13px] font-medium text-[var(--color-accent-foreground)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        <p className="mt-3 font-mono text-[10px] text-[var(--color-fg-subtle)] leading-[1.55]">
          The invitee gets a magic-link sign-in to /admin + a branded letter explaining their role.
        </p>
      </section>
    </>
  )
}

/**
 * Roster of the current (server-paginated) page of staff. Row mutations call
 * the team API then `router.refresh()`, so the visible page always reflects
 * the server's ordering/counts rather than a divergent client cache.
 */
export function TeamRoster({ members }: { members: Member[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function flash(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  function changeRole(memberId: string, newRole: string) {
    startTransition(async () => {
      // Demotion to customer removes staff access entirely — gate it behind
      // an explicit destructive confirm. Role swaps between staff roles are
      // reversible and don't need one.
      if (newRole === 'user') {
        const sure = await confirm({
          title: 'Remove this person from staff?',
          description:
            'They lose all operator-console access immediately. You can re-invite them later.',
          variant: 'destructive',
          confirmText: 'Remove from staff',
        })
        if (!sure) return
      }
      const res = await fetch(`/api/admin/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const j = await res.json()
      if (j.ok) {
        flash('ok', newRole === 'user' ? 'Removed from staff' : `Role updated to ${ROLE_LABEL[newRole]}`)
        router.refresh()
      } else {
        flash('err', j.error ?? 'Update failed')
      }
    })
  }

  async function toggleBan(member: Member) {
    const newState = !member.banned
    let reason: string | null = null
    if (newState) {
      // Banning is destructive — require an explicit confirm first, so a
      // cancelled reason prompt can no longer fall through into a ban.
      const sure = await confirm({
        title: `Ban ${member.email}?`,
        description:
          'They are signed out and blocked from the operator console until you restore them.',
        variant: 'destructive',
        confirmText: 'Ban account',
      })
      if (!sure) return
      reason = await prompt({
        title: 'Ban reason (optional)',
        description: 'Recorded on the account for the audit trail.',
        placeholder: 'Why are you banning this member?',
      })
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned: newState, banReason: reason }),
      })
      const j = await res.json()
      if (j.ok) {
        flash('ok', newState ? 'Account banned' : 'Account restored')
        router.refresh()
      } else {
        flash('err', j.error ?? 'Update failed')
      }
    })
  }

  function resendInvite(member: Member) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/team/${member.id}/resend`, { method: 'POST' })
      const j = await res.json()
      if (j.ok) {
        flash('ok', `Invite resent to ${member.email}`)
      } else {
        flash('err', j.error ?? 'Resend failed')
      }
    })
  }

  return (
    <section>
      <Toast toast={toast} />
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
        {members.map((m) => (
          <div key={m.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3">
            {/* Avatar */}
            <div
              className="size-10 rounded-full grid place-items-center font-mono text-[12px] font-medium shrink-0"
              style={{
                background: m.banned ? 'rgba(176,67,47,0.12)' : 'var(--color-accent-soft)',
                color: m.banned ? 'var(--color-negative)' : 'var(--color-accent)',
                border: `1px solid ${m.banned ? 'var(--color-negative)' : 'var(--color-accent-line)'}`,
              }}
            >
              {(m.name ?? m.email).slice(0, 2).toUpperCase()}
            </div>

            {/* Identity */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-medium text-[var(--color-fg)] truncate">
                  {m.name || m.email.split('@')[0]}
                </span>
                {m.banned && (
                  <span className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
                    style={{ color: 'var(--color-negative)', borderColor: 'var(--color-negative)' }}>
                    <Prohibit weight="bold" className="size-2.5" />
                    Banned
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-[var(--color-fg-muted)] truncate">{m.email}</div>
              {m.banned && m.banReason && (
                <div className="text-[11px] text-[var(--color-negative)] italic mt-0.5">{m.banReason}</div>
              )}
            </div>

            {/* Role select */}
            <Select value={m.role ?? 'user'} onValueChange={(v) => changeRole(m.id, String(v))} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
              <SelectItem value="user">— Demote to customer —</SelectItem>
            </SelectContent></Select>

            {/* Resend invite — re-fires the magic-link + branded
                letter so the teammate gets a fresh sign-in URL. */}
            <button
              onClick={() => resendInvite(m)}
              disabled={busy || m.banned}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={m.banned ? 'Unban first, then resend' : 'Resend invite email'}
            >
              <ArrowsClockwise weight="regular" className="size-3" />
              Resend
            </button>

            {/* Ban toggle */}
            <button
              onClick={() => toggleBan(m)}
              disabled={busy}
              className="rounded-md border border-[var(--color-border)] p-2 hover:border-[var(--color-border-strong)] disabled:opacity-50 transition-colors"
              aria-label={m.banned ? 'Unban' : 'Ban'}
              title={m.banned ? 'Restore access' : 'Ban'}
            >
              {m.banned ? (
                <Check weight="bold" className="size-3.5 text-[var(--color-positive)]" />
              ) : (
                <Prohibit weight="bold" className="size-3.5 text-[var(--color-fg-muted)]" />
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
