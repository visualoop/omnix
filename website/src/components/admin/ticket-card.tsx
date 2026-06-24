import { ChatCircleDots, FireSimple, Warning, Question } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface TicketLike {
  id: string
  subject: string
  category: string | null
  priority: string | null
  status: string | null
  createdAt: Date
  updatedAt: Date
  customerEmail?: string | null
}

const PRIORITY_TONE: Record<string, { tone: string; Icon: React.ComponentType<{ weight?: 'fill' | 'regular' | 'bold'; className?: string }> }> = {
  high:    { tone: 'var(--color-negative)', Icon: FireSimple },
  medium:  { tone: 'var(--color-caution)',  Icon: Warning },
  low:     { tone: 'var(--color-fg-subtle)', Icon: Question },
}

/**
 * TicketCard — kanban-style card with priority chip + age. Subject is
 * the hero (Fraunces small caps), customer email + category sit
 * underneath in muted mono.
 */
export function TicketCard({ t }: { t: TicketLike }) {
  const prio = PRIORITY_TONE[t.priority ?? 'low'] ?? PRIORITY_TONE.low
  const Icon = prio.Icon
  return (
    <Link
      href={`/admin/tickets/${t.id}`}
      className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors p-4 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            style={{ fontFamily: 'var(--font-display)' }}
            className="text-[14px] leading-tight text-[var(--color-fg)] truncate"
          >
            {t.subject}
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            <ChatCircleDots weight="regular" className="size-3" />
            {t.category ?? 'general'}
          </div>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ color: prio.tone, borderColor: prio.tone }}
        >
          <Icon weight="fill" className="size-2.5" />
          {t.priority ?? 'low'}
        </span>
      </div>
      <div className="mt-3 border-t border-[var(--color-border)] pt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
        <span className="truncate">{t.customerEmail ?? '—'}</span>
        <time>{relative(t.updatedAt)}</time>
      </div>
    </Link>
  )
}

function relative(d: Date): string {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / (60 * 1000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
