import * as React from 'react'

import { cn } from '@/lib/cn'

export type LabelProps = React.ComponentProps<'label'> & {
  required?: boolean
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  function Label({ className, children, required, ...props }, ref) {
    return (
      <label
        ref={ref}
        data-slot="label"
        className={cn(
          'font-ui text-[12px] font-semibold leading-5 text-[var(--color-fg)]',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-55',
          className,
        )}
        {...props}
      >
        {children}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[var(--color-accent)]">
            *
          </span>
        ) : null}
      </label>
    )
  },
)

Label.displayName = 'Label'
