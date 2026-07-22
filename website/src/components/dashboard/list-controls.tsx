'use client'

/**
 * Customer-dashboard list controls — a labelled, URL-driven search box and
 * a pagination strip for every growing account collection (licences,
 * devices, payments, support tickets, issued licences, teammates).
 *
 * Design contract:
 *   - Server owns the query. Both controls only read/write bounded URL
 *     search params (`page`, `q`, or a caller-supplied name) via
 *     `router.replace`, so the server re-renders the page with the new
 *     window. This keeps ordering stable and the back button working, and
 *     never loads an unbounded table into the client.
 *   - Every search control has a real, associated <label> — never a bare
 *     placeholder — and the pagination strip is a labelled <nav> with a
 *     polite live region announcing the visible range.
 *   - Distinct `paramName`/`pageParam` values let two lists coexist on one
 *     page without colliding.
 *
 * Owned by Task 24 (dashboard pages); deliberately separate from the
 * admin console's own `data-controls`.
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, MagnifyingGlass, X } from '@/components/icons'
import { cn } from '@/lib/cn'

export function ListSearch({
  label,
  placeholder = 'Search…',
  paramName = 'q',
  pageParam = 'page',
  className,
}: {
  label: string
  placeholder?: string
  paramName?: string
  pageParam?: string
  className?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const initial = params.get(paramName) ?? ''
  const [value, setValue] = useState(initial)
  const inputId = `list-search-${paramName}`

  // Debounced URL update so the server isn't refetched on every keystroke.
  useEffect(() => {
    if (value === initial) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set(paramName, value.trim())
      else next.delete(paramName)
      // Reset to page one whenever the query changes — otherwise you can
      // land on page 7 of a 2-page filtered result.
      next.delete(pageParam)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label
        htmlFor={inputId}
        className="font-ui text-[12px] font-semibold leading-5 text-[var(--color-fg)]"
      >
        {label}
      </label>
      <div className="relative w-full max-w-sm">
        <MagnifyingGlass
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-subtle)]"
        />
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] pl-9 pr-9',
            'font-sans text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none',
            'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
            'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-[var(--radius-sm)] text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function ListPagination({
  page,
  pageSize,
  total,
  pageParam = 'page',
  label = 'Pagination',
}: {
  page: number
  pageSize: number
  total: number
  pageParam?: string
  label?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const go = (next: number) => {
    const query = new URLSearchParams(params.toString())
    if (next <= 1) query.delete(pageParam)
    else query.set(pageParam, String(next))
    const qs = query.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 py-2.5 font-mono text-[11px] text-[var(--color-fg-muted)]"
    >
      <span aria-live="polite" className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </nav>
  )
}

/**
 * Labelled, URL-driven select filter for a small fixed enum (e.g. payment
 * status). Fixed enums are the one place a plain <Select> is allowed; a
 * growing set must use a searchable control instead.
 */
export function ListSelectFilter({
  label,
  paramName,
  options,
  pageParam = 'page',
  allLabel = 'All',
}: {
  label: string
  paramName: string
  options: Array<{ value: string; label: string }>
  pageParam?: string
  allLabel?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const current = params.get(paramName) ?? ''
  const selectId = `list-filter-${paramName}`

  const change = (value: string) => {
    const query = new URLSearchParams(params.toString())
    if (value) query.set(paramName, value)
    else query.delete(paramName)
    query.delete(pageParam)
    const qs = query.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className="font-ui text-[12px] font-semibold leading-5 text-[var(--color-fg)]"
      >
        {label}
      </label>
      <select
        id={selectId}
        value={current}
        onChange={(event) => change(event.target.value)}
        className={cn(
          'h-11 w-full max-w-[14rem] rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3',
          'font-sans text-[14px] text-[var(--color-fg)] outline-none',
          'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'hover:border-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-line)]',
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
