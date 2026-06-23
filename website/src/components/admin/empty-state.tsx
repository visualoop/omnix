import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

/**
 * EmptyState — shown when an admin list has zero rows. Quiet, oriented
 * around explaining what would appear here rather than mood-setting.
 */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      {icon ? <div className="mx-auto mb-4 text-[var(--color-fg-subtle)]">{icon}</div> : null}
      <div
        style={{ fontFamily: 'var(--font-display)' }}
        className="text-[18px] font-medium text-[var(--color-fg)]"
      >
        {title}
      </div>
      {description && (
        <p className="mx-auto mt-2 max-w-[40ch] text-[13px] text-[var(--color-fg-muted)] leading-[1.55]">
          {description}
        </p>
      )}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
