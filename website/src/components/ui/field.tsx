'use client'

import * as React from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/cn'

type FieldControlProps = {
  id?: string
  required?: boolean
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export interface FieldProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  children: React.ReactElement<FieldControlProps>
  description?: React.ReactNode
  error?: React.ReactNode
  label: React.ReactNode
  optional?: boolean
  required?: boolean
}

export function Field({
  children,
  className,
  description,
  error,
  label,
  optional,
  required,
  ...props
}: FieldProps) {
  const generatedId = React.useId()
  const controlId = children.props.id ?? `field-${generatedId}`
  const descriptionId = description ? `${controlId}-description` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div
      data-slot="field"
      className={cn('grid min-w-0 gap-1.5', className)}
      {...props}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <Label htmlFor={controlId} required={required}>
          {label}
        </Label>
        {optional ? (
          <span className="font-ui text-[11px] text-[var(--color-fg-subtle)]">
            Optional
          </span>
        ) : null}
      </div>

      {React.cloneElement(children, {
        id: controlId,
        required: required ?? children.props.required,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {description ? (
        <p id={descriptionId} className="text-[12px] leading-5 text-[var(--color-fg-subtle)]">
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[12px] font-medium leading-5 text-[var(--color-negative)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
