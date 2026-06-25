/**
 * Editorial table primitive — hairline rules, no borders, mono header.
 *
 * Matches the rest of /admin (espresso paper, no shadows). Use this
 * instead of CardLayout for dense list views like /admin/licenses,
 * /admin/payments, /admin/machines.
 *
 * Composition:
 *   <Table>
 *     <TableHeader>
 *       <TableRow>
 *         <TableHead>Column</TableHead>
 *         …
 *       </TableRow>
 *     </TableHeader>
 *     <TableBody>
 *       <TableRow>
 *         <TableCell>…</TableCell>
 *       </TableRow>
 *     </TableBody>
 *   </Table>
 */
import * as React from 'react'

type TableElProps = React.HTMLAttributes<HTMLTableElement>
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>
type RowProps = React.HTMLAttributes<HTMLTableRowElement>
type CellProps = React.TdHTMLAttributes<HTMLTableCellElement>
type HeadCellProps = React.ThHTMLAttributes<HTMLTableCellElement>

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

export function Table({ className, ...props }: TableElProps) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table
        className={cn('w-full caption-bottom border-collapse text-[13px]', className)}
        {...props}
      />
    </div>
  )
}

export function TableHeader({ className, ...props }: SectionProps) {
  return (
    <thead
      className={cn(
        'border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]/40',
        className,
      )}
      {...props}
    />
  )
}

export function TableBody({ className, ...props }: SectionProps) {
  return (
    <tbody
      className={cn('divide-y divide-[var(--color-border)]', className)}
      {...props}
    />
  )
}

export function TableFooter({ className, ...props }: SectionProps) {
  return (
    <tfoot
      className={cn(
        'border-t border-[var(--color-border)] bg-[var(--color-bg-muted)]/30 font-medium',
        className,
      )}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: RowProps) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-[var(--color-bg-muted)]/40 data-[state=selected]:bg-[var(--color-bg-muted)]/60',
        className,
      )}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }: HeadCellProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-fg-muted)]',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: CellProps) {
  return (
    <td
      className={cn('px-3 py-2.5 align-middle text-[var(--color-fg)]', className)}
      {...props}
    />
  )
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-3 px-3 text-[12px] text-[var(--color-fg-muted)]', className)}
      {...props}
    />
  )
}
