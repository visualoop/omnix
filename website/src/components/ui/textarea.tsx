'use client'

import * as React from 'react'

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

/**
 * Editorial Textarea — matches the website's Input border + focus halo.
 *
 *   <Textarea name="message" rows={6} placeholder="…" />
 *   <Textarea value={x} onChange={(e) => setX(e.target.value)} />
 */
type Props = React.ComponentProps<'textarea'>

export const Textarea = React.forwardRef<HTMLTextAreaElement, Props>(
  function TextareaImpl({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[80px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] leading-relaxed transition-colors',
          'placeholder:text-[var(--color-fg-muted)]',
          'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-y',
          className,
        )}
        {...props}
      />
    )
  },
)
