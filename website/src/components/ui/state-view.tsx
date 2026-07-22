import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lock, MagnifyingGlass } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * Shared quality-state primitive for the whole website.
 *
 * One quiet, procedural block that the empty / filtered-empty / not-found /
 * permission-denied / recoverable-error states all compose from. It is a
 * server component (no client hooks) so it can be rendered from server pages,
 * route-group boundaries, and client error boundaries alike.
 *
 * Design contract (Working Counter, light-first):
 *   - No new tokens, no gradients, no giant illustrations, no emoji.
 *   - Colour is never the only signal — every tone pairs with a text label.
 *   - Optional small inline icon only; never a decorative hero graphic.
 *   - Actions use the shared <Button> (44px touch target) and route somewhere
 *     real — no dead CTAs.
 *   - Reduced-motion safe: no animation here at all; loading skeletons own the
 *     only motion and guard it with motion-safe.
 */

export type StateTone = 'neutral' | 'accent' | 'positive' | 'caution' | 'negative' | 'info'

const TONE_TEXT: Record<StateTone, string> = {
  neutral: 'text-[var(--color-fg-subtle)]',
  accent: 'text-[var(--color-accent)]',
  positive: 'text-[var(--color-positive)]',
  caution: 'text-[var(--color-caution)]',
  negative: 'text-[var(--color-negative)]',
  info: 'text-[var(--color-info)]',
}

export interface StateViewProps {
  /** Mono eyebrow — e.g. "404", "403", "EMPTY". Reinforced by tone colour + text. */
  code?: ReactNode
  /** Small inline icon (already sized). Optional; never a giant illustration. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  tone?: StateTone
  /** Primary/secondary buttons or links. */
  actions?: ReactNode
  /** Extra quiet links row under the actions. */
  footer?: ReactNode
  /** Dashed card framing for in-page empty states; false = bare (boundary pages). */
  bordered?: boolean
  size?: 'inline' | 'panel' | 'page'
  role?: string
  'aria-live'?: 'polite' | 'assertive'
  /** Stable hook for tests + analytics, e.g. "empty" | "not-found". */
  dataState?: string
  className?: string
}

export function StateView({
  code,
  icon,
  title,
  description,
  tone = 'neutral',
  actions,
  footer,
  bordered = false,
  size = 'panel',
  role,
  'aria-live': ariaLive,
  dataState,
  className,
}: StateViewProps) {
  const pad =
    size === 'page'
      ? 'px-6 py-16 sm:py-24'
      : size === 'inline'
        ? 'px-4 py-8'
        : 'px-6 py-12'

  // Full-page states are the page's primary content → h1. Inline/panel states
  // sit inside a page that already owns the h1 → h2.
  const Heading = size === 'page' ? 'h1' : 'h2'

  return (
    <div
      data-state={dataState}
      role={role}
      aria-live={ariaLive}
      className={cn(
        'flex min-w-0 flex-col items-center text-center',
        size === 'page' && 'min-h-[calc(100vh-160px)] justify-center',
        pad,
        bordered &&
          'rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]',
        className,
      )}
    >
      {icon ? (
        <div className={cn('mb-4 inline-flex items-center justify-center', TONE_TEXT[tone])} aria-hidden>
          {icon}
        </div>
      ) : null}

      {code ? (
        <div
          className={cn(
            'font-mono text-[12px] font-semibold uppercase tracking-[0.18em] tabular-nums',
            TONE_TEXT[tone],
          )}
        >
          {code}
        </div>
      ) : null}

      <Heading
        className={cn(
          'font-display font-medium tracking-[-0.02em] text-[var(--color-fg)]',
          code ? 'mt-3' : 'mt-0',
          size === 'page'
            ? 'text-[clamp(28px,4vw,44px)] leading-[1.05]'
            : 'text-[18px] leading-tight',
        )}
      >
        {title}
      </Heading>

      {description ? (
        <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-[1.6] text-[var(--color-fg-muted)]">
          {description}
        </p>
      ) : null}

      {actions ? (
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {actions}
        </div>
      ) : null}

      {footer ? <div className="mt-8 w-full">{footer}</div> : null}
    </div>
  )
}

/**
 * First-use empty state — never a dead end. `action` should route to a real
 * create/demo/support/action destination the current role is allowed to use.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'panel',
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  size?: StateViewProps['size']
  className?: string
}) {
  return (
    <StateView
      bordered
      size={size}
      icon={icon}
      title={title}
      description={description}
      actions={action}
      dataState="empty"
      className={className}
    />
  )
}

/**
 * Filtered-empty state — the search/filters matched nothing. Always offers a
 * one-click way back to the unfiltered list so the user is never stuck.
 */
export function FilteredEmptyState({
  query,
  clearHref,
  entityLabel = 'results',
  className,
}: {
  query?: string | null
  /** Link back to the un-filtered list (same route, no search params). */
  clearHref: string
  entityLabel?: string
  className?: string
}) {
  return (
    <StateView
      bordered
      size="panel"
      tone="neutral"
      icon={<MagnifyingGlass className="size-6" />}
      title={`No ${entityLabel} match your filters`}
      description={
        query
          ? `Nothing matched “${query}”. Try a different term, or clear the filters to see everything.`
          : 'Nothing matched the current filters. Clear them to see everything.'
      }
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={clearHref}>Clear filters</Link>
        </Button>
      }
      dataState="filtered-empty"
      className={className}
    />
  )
}

/**
 * Permission-denied (403). Preserves the server-side gate — this only renders
 * the message. `requiredRole` is disclosed ONLY when the caller judges it safe
 * to name; it must never leak whether a specific resource exists.
 */
export function PermissionState({
  title = 'You don’t have access to this.',
  description,
  requiredRole,
  code = '403',
  homeHref = '/dashboard',
  homeLabel = 'Back to your dashboard',
  size = 'page',
}: {
  title?: ReactNode
  description?: ReactNode
  requiredRole?: string
  code?: ReactNode
  homeHref?: string
  homeLabel?: string
  size?: StateViewProps['size']
}) {
  return (
    <StateView
      size={size}
      code={code}
      tone="caution"
      icon={<Lock className="size-6" />}
      title={title}
      description={
        description ??
        (requiredRole
          ? `This area is limited to the ${requiredRole} role.`
          : 'Your account doesn’t have permission to view this area.')
      }
      actions={
        <Button asChild variant="outline">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      }
      role="status"
      dataState="permission-denied"
    />
  )
}

/**
 * Not-found (404). Generic by construction — it never reveals whether a
 * specific id/slug existed.
 */
export function NotFoundState({
  code = '404',
  title = 'Page not found.',
  description = 'The page you were looking for doesn’t exist, or has moved. The most useful next steps are below.',
  actions,
  footer,
  size = 'page',
}: {
  code?: ReactNode
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  size?: StateViewProps['size']
}) {
  return (
    <StateView
      size={size}
      code={code}
      tone="accent"
      title={title}
      description={description}
      actions={actions}
      footer={footer}
      dataState="not-found"
    />
  )
}
