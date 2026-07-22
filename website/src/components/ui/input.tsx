import * as React from 'react'

import { cn } from '@/lib/cn'

export type InputProps = React.ComponentProps<'input'>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3.5',
          'font-sans text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)]',
          'transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'hover:border-[var(--color-fg-subtle)]',
          'focus-visible:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
          'aria-invalid:border-[var(--color-negative)] aria-invalid:ring-2 aria-invalid:ring-[color:var(--color-negative)]/15',
          'read-only:border-[var(--color-border)] read-only:bg-[var(--color-surface)] read-only:text-[var(--color-fg-muted)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--color-surface)] disabled:opacity-55',
          'file:mr-3 file:border-0 file:bg-transparent file:font-ui file:text-sm file:font-semibold',
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
