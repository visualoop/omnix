'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe, RefreshCw, TriangleAlert } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'

/**
 * Shared recoverable-error body for every route-group `error.tsx` boundary.
 *
 * Guarantees the Task 27 error contract:
 *   - Client-safe: logs the raw error to the console for operators, but never
 *     renders `error.message` (which can carry stack frames / PII / secrets)
 *     into the UI. Only the opaque `digest` reference is shown.
 *   - Always offers reset/retry AND a safe navigation escape.
 *   - Distinguishes offline / network from a generic server fault when it can
 *     tell them apart (navigator.onLine + a network-shaped message).
 *   - Never a bare generic dead-end — every state carries a next action.
 */

export interface ErrorStateProps {
  error: Error & { digest?: string }
  reset: () => void
  /** Human label for the surface, e.g. "dashboard", "checkout", "page". */
  scope?: string
  /** Overrides the derived heading. */
  title?: string
  /** Overrides the derived body copy. */
  description?: string
  homeHref?: string
  homeLabel?: string
  /** Extra escape hatch, e.g. sign-in-again or support. */
  secondaryHref?: string
  secondaryLabel?: string
}

function looksLikeNetworkError(error: Error): boolean {
  const msg = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  )
}

export function ErrorState({
  error,
  reset,
  scope = 'page',
  title,
  description,
  homeHref = '/',
  homeLabel = 'Back to home',
  secondaryHref,
  secondaryLabel,
}: ErrorStateProps) {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    // Operator-facing log only. Nothing from here reaches the rendered UI.
    console.error(`[${scope} error boundary]`, error)
  }, [error, scope])

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  const isNetwork = offline || looksLikeNetworkError(error)

  const resolvedTitle =
    title ??
    (offline
      ? 'You’re offline.'
      : isNetwork
        ? 'We couldn’t reach the server.'
        : `We hit a snag loading this ${scope}.`)

  const resolvedDescription =
    description ??
    (offline
      ? 'Your device lost its connection. Reconnect, then try again — nothing was lost.'
      : isNetwork
        ? 'The request didn’t reach us. Check your connection and try again.'
        : 'The error has been logged. Try again, and if it keeps happening use the link below.')

  return (
    <StateView
      size="page"
      tone={offline ? 'info' : 'negative'}
      icon={offline ? <Globe className="size-8" /> : <TriangleAlert className="size-8" />}
      code={offline ? 'OFFLINE' : isNetwork ? 'NETWORK' : 'ERROR'}
      title={resolvedTitle}
      description={resolvedDescription}
      role="alert"
      aria-live="assertive"
      dataState="error"
      actions={
        <>
          <Button type="button" onClick={() => reset()}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
          {secondaryHref ? (
            <Button asChild variant="outline">
              <Link href={secondaryHref}>{secondaryLabel ?? 'Get help'}</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={homeHref}>
                <ArrowLeft className="size-4" />
                {homeLabel}
              </Link>
            </Button>
          )}
        </>
      }
      footer={
        error?.digest ? (
          <p className="text-center font-mono text-[11px] text-[var(--color-fg-subtle)]">
            Reference: {error.digest}
          </p>
        ) : null
      }
    />
  )
}
