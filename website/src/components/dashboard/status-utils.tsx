import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Working Counter status vocabulary for the customer account portal.
 *
 * Every status is a token-backed pill that always carries a text label —
 * colour is a reinforcement, never the sole signal (accessibility + the
 * house "no colour-only differentiation" rule). Hues come from the
 * semantic design tokens (`--color-positive/caution/negative`, the accent
 * soft wash, and the neutral surface) so nothing drifts into off-brand
 * Tailwind palette colours.
 */

const LICENSE_STATUS: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  trial: {
    label: 'Trial',
    className: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  },
  lapsed: {
    label: 'Lapsed',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
  revoked: {
    label: 'Revoked',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
  maintenance_expired: {
    label: 'Maintenance expired',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
}

const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  success: {
    label: 'Paid',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  pending: {
    label: 'Pending',
    className: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  },
  failed: {
    label: 'Failed',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
  },
}

const MACHINE_STATUS: Record<string, { label: string; className: string }> = {
  online: {
    label: 'Online',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  active: {
    label: 'Active',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  idle: {
    label: 'Idle',
    className: 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
  },
  offline: {
    label: 'Offline',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
  deactivated: {
    label: 'Deactivated',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
  revoked: {
    label: 'Revoked',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
}

const TICKET_STATUS: Record<string, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  },
  new: {
    label: 'New',
    className: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]',
  },
  awaiting_customer: {
    label: 'Awaiting you',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  closed: {
    label: 'Closed',
    className: 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
  },
}

/** Affiliate + reseller commission ledger states. */
const COMMISSION_STATUS: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
  paid: {
    label: 'Paid out',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
  rejected_self_referral: {
    label: 'Rejected · self',
    className: 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
  },
  rejected_repeat: {
    label: 'Rejected · repeat',
    className: 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
  },
}

/** Reseller channel account state. */
const RESELLER_STATUS: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
}

const REGISTRY = {
  license: LICENSE_STATUS,
  payment: PAYMENT_STATUS,
  machine: MACHINE_STATUS,
  ticket: TICKET_STATUS,
  commission: COMMISSION_STATUS,
  reseller: RESELLER_STATUS,
} as const

export type StatusKind = keyof typeof REGISTRY

export function StatusPill({ kind, status }: { kind: StatusKind; status: string }) {
  const map = REGISTRY[kind]
  const meta = map[status] ?? {
    label: status.replace(/_/g, ' '),
    className: 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

/**
 * @deprecated Prefer the shared `PageHeader` (`@/components/layout/page-header`)
 * or `EntityHero` primitive. Retained for backwards compatibility.
 */
export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-display text-[clamp(24px,3vw,36px)] font-medium leading-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[14px] text-[var(--color-fg-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

/**
 * Procedural empty state: never a dead end. Callers pass a real next
 * action (a Button/Link) so an empty list becomes an invitation to act.
 *
 * Kept as a small route-specific wrapper (rather than delegating to the
 * shared <StateView>) so the customer portal keeps its own copy voice; it
 * shares the same quiet, dashed, token-backed shape.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-12 text-center">
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[var(--color-fg-muted)]">
        {body}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function formatDate(value: string | undefined | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelative(value: string | undefined | null): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const day = 1000 * 60 * 60 * 24
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} weeks ago`
  return new Date(value).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
}
