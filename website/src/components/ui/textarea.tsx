import * as React from 'react'

import { cn } from '@/lib/cn'

export type TextareaProps = React.ComponentProps<'textarea'>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          'min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5 py-3',
          'font-sans text-[14px] leading-6 text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none',
          'transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
          'aria-invalid:border-[var(--color-negative)] aria-invalid:ring-2 aria-invalid:ring-[color:var(--color-negative)]/15',
          'read-only:border-[var(--color-border)] read-only:bg-[var(--color-surface)] read-only:text-[var(--color-fg-muted)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-55',
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
