import { Robot, User as UserIcon } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface AuditLike {
  id: string
  actorId: string | null
  action: string
  resource: string | null
  metadata: unknown
  createdAt: Date
}

/**
 * AuditEntry — a single line in the audit feed. Uses a robot glyph for
 * system-actor events, person glyph for human-actor events. Action gets
 * its semantic colour (positive for creates, caution for updates,
 * negative for deletes/bans).
 */
export function AuditEntry({ a }: { a: AuditLike }) {
  const isSystem = a.actorId === null || a.actorId === '' || a.actorId === 'bootstrap'
  const tone = actionTone(a.action)
  return (
    <Link
      href={`/admin/audit/${a.id}`}
      className="grid grid-cols-[20px_1fr_auto] items-baseline gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors text-[12px] cursor-pointer"
    >
      {isSystem ? (
        <Robot weight="regular" className="size-3.5 text-[var(--color-fg-subtle)]" />
      ) : (
        <UserIcon weight="regular" className="size-3.5 text-[var(--color-fg-subtle)]" />
      )}
      <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <code className="font-mono text-[12px] tabular-nums" style={{ color: tone }}>
          {a.action}
        </code>
        {a.resource && (
          <code className="font-mono text-[11px] text-[var(--color-fg-muted)] truncate">{a.resource}</code>
        )}
        {!isSystem && a.actorId && (
          <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
            by {a.actorId.slice(0, 8)}
          </span>
        )}
      </div>
      <time className="font-mono text-[11px] text-[var(--color-fg-subtle)] tabular-nums whitespace-nowrap">
        {a.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
      </time>
    </Link>
  )
}

function actionTone(action: string): string {
  if (/\.(delete|ban|revoke|fail)/.test(action)) return 'var(--color-negative)'
  if (/\.(create|grant|issue|seed|success)/.test(action)) return 'var(--color-positive)'
  if (/\.(update|change|sync|rotate)/.test(action)) return 'var(--color-caution)'
  return 'var(--color-fg-muted)'
}
