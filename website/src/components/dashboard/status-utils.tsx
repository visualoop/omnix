import { cn } from '@/lib/cn'

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
  maintenance_expired: {
    label: 'Maintenance expired',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
}

const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  success: {
    label: 'Success',
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
    className: 'bg-[var(--color-fg-subtle)]/15 text-[var(--color-fg-subtle)]',
  },
}

const MACHINE_STATUS: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
  },
  idle: {
    label: 'Idle',
    className: 'bg-[var(--color-fg-subtle)]/15 text-[var(--color-fg-subtle)]',
  },
  offline: {
    label: 'Offline',
    className: 'bg-[var(--color-caution)]/15 text-[var(--color-caution)]',
  },
  deactivated: {
    label: 'Deactivated',
    className: 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]',
  },
}

const TICKET_STATUS: Record<string, { label: string; className: string }> = {
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
    className: 'bg-[var(--color-fg-subtle)]/15 text-[var(--color-fg-subtle)]',
  },
}

const REGISTRY = {
  license: LICENSE_STATUS,
  payment: PAYMENT_STATUS,
  machine: MACHINE_STATUS,
  ticket: TICKET_STATUS,
} as const

export type StatusKind = keyof typeof REGISTRY

export function StatusPill({ kind, status }: { kind: StatusKind; status: string }) {
  const map = REGISTRY[kind]
  const meta = map[status] ?? { label: status, className: 'bg-[var(--color-surface-hover)]' }
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-display text-[clamp(24px,3vw,36px)] font-medium leading-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[14px] text-[var(--color-fg-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-12 text-center">
      <h3 className="font-display text-[18px] font-medium text-[var(--color-fg)]">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.5] text-[var(--color-fg-muted)]">
        {body}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
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
