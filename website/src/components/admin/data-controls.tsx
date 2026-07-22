/**
 * URL-driven pagination strip + search bar for admin tables.
 *
 * Both are client components that read from / write to URL search
 * params via `useRouter().replace()` so the server can re-render
 * with the new page / query on every change. Keeps the back button
 * working and lets admins bookmark filtered views.
 */
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CaretLeft, CaretRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function AdminPagination({
  page,
  pageSize,
  total,
  pageParamName = 'page',
  label,
}: {
  page: number
  pageSize: number
  total: number
  /** URL param that carries the page number. Defaults to `page`. Detail
   *  pages with several independent lists pass a namespaced value
   *  (e.g. `machPage`) so one pager never clobbers another. */
  pageParamName?: string
  /** Optional accessible label for the whole pager (announced range). */
  label?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const go = (next: number) => {
    const u = new URLSearchParams(params.toString())
    if (next <= 1) u.delete(pageParamName)
    else u.set(pageParamName, String(next))
    const qs = u.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div
      className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2 font-mono text-[11px] text-[var(--color-fg-muted)]"
      role="navigation"
      aria-label={label ?? 'Pagination'}
    >
      <span>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        {/* Hit targets are 44px (WCAG 2.5.5 / touch-friendly); the glyph
            stays small so the control still reads as a compact pager. */}
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="inline-flex size-11 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <CaretLeft className="size-3.5" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex size-11 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <CaretRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function AdminSearch({
  placeholder = 'Search…',
  paramName = 'q',
  label = 'Search this list',
  id,
  pageParamName = 'page',
}: {
  placeholder?: string
  paramName?: string
  /** Accessible name for the field. Rendered visually-hidden by default so
   *  the control is announced to assistive tech without adding chrome. */
  label?: string
  /** Optional explicit id. Defaults to a stable id derived from `paramName`
   *  so the `<label htmlFor>` association is deterministic across renders. */
  id?: string
  /** Which page param to reset when the query changes. Defaults to `page`.
   *  Namespaced lists pass their own (e.g. `machPage`) so searching one list
   *  does not reset another list's pager. */
  pageParamName?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const initial = params.get(paramName) ?? ''
  const [value, setValue] = useState(initial)
  const inputId = id ?? `admin-search-${paramName}`

  // Debounced URL update so we don't refetch on every keystroke.
  useEffect(() => {
    if (value === initial) return
    const t = setTimeout(() => {
      const u = new URLSearchParams(params.toString())
      if (value.trim()) u.set(paramName, value.trim())
      else u.delete(paramName)
      // Going back to page 1 whenever the query changes — otherwise
      // you can land on page 7 of a 2-page filtered set.
      u.delete(pageParamName)
      const qs = u.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative w-full max-w-sm">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <MagnifyingGlass className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-fg-muted)] pointer-events-none" />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-8 text-[13px] outline-none focus:border-[var(--color-accent)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          aria-label="Clear"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

export function AdminSelectFilter({
  paramName,
  label,
  options,
}: {
  paramName: string
  label: string
  options: Array<{ value: string; label: string }>
}) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const current = params.get(paramName) ?? ''

  const change = (v: string) => {
    const u = new URLSearchParams(params.toString())
    if (v) u.set(paramName, v)
    else u.delete(paramName)
    u.delete('page')
    const qs = u.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
        {label}
      </label>
      <Select
        value={current || '__all'}
        onValueChange={(v) => change(v === '__all' ? '' : String(v))}
      >
        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
