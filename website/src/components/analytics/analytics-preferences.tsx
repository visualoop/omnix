'use client'

/**
 * Footer control to revisit the analytics choice.
 *
 * Opens the same consent notice the analytics island renders, so a visitor can
 * change their mind at any time without clearing storage. Rendered only when a
 * valid GA id is configured (the server gates this), so it never appears on a
 * build with analytics switched off.
 */
import { openAnalyticsPreferences } from '@/lib/analytics/consent-store'

export function AnalyticsPreferences({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openAnalyticsPreferences}
      data-analytics-preferences
      className={
        className ??
        'text-[12px] text-[var(--color-fg-subtle)] underline-offset-4 transition-colors hover:text-[var(--color-fg)] hover:underline'
      }
    >
      Analytics preferences
    </button>
  )
}
