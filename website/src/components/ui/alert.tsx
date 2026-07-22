import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/cn'

const alertVariants = cva(
  'grid grid-cols-[3px_1fr] gap-x-3 rounded-[var(--radius-md)] border px-4 py-3 text-[13px] leading-5',
  {
    variants: {
      variant: {
        info: 'border-[var(--color-info)]/30 bg-[var(--color-info)]/8 text-[var(--color-fg)] before:bg-[var(--color-info)]',
        success: 'border-[var(--color-positive)]/30 bg-[var(--color-positive)]/8 text-[var(--color-fg)] before:bg-[var(--color-positive)]',
        warning: 'border-[var(--color-caution)]/35 bg-[var(--color-caution)]/9 text-[var(--color-fg)] before:bg-[var(--color-caution)]',
        error: 'border-[var(--color-negative)]/35 bg-[var(--color-negative)]/8 text-[var(--color-fg)] before:bg-[var(--color-negative)]',
      },
    },
    defaultVariants: { variant: 'info' },
  },
)

export interface AlertProps
  extends Omit<React.ComponentProps<'div'>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode
}

export function Alert({
  children,
  className,
  role,
  title,
  variant = 'info',
  ...props
}: AlertProps) {
  const resolvedRole = role ?? (variant === 'error' ? 'alert' : 'status')

  return (
    <div
      data-slot="alert"
      role={resolvedRole}
      aria-live={resolvedRole === 'alert' ? 'assertive' : 'polite'}
      className={cn(
        alertVariants({ variant }),
        'before:row-span-2 before:my-0.5 before:rounded-[var(--radius-pill)] before:content-[\'\']',
        className,
      )}
      {...props}
    >
      <div>
        {title ? <p className="font-ui font-semibold text-[var(--color-fg)]">{title}</p> : null}
        {children ? (
          <div className={cn('text-[var(--color-fg-muted)]', title && 'mt-0.5')}>{children}</div>
        ) : null}
      </div>
    </div>
  )
}

export { alertVariants }
