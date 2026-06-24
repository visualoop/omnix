/**
 * FuzzySearch — minimal typeahead input used inside detail-page lists
 * (variants, batches, related products, etc.).
 *
 * It's NOT the global ⌘K palette — that's command-palette.tsx. This is
 * a per-list filter that supports:
 *   - debounced input
 *   - up/down arrow keys to highlight rows
 *   - enter to invoke the active row's onSelect
 *   - escape to clear
 *
 * Caller provides an `items` array + a `keys` array of which fields to
 * match. We do a simple lowercase substring test against each key. For
 * datasets > 1k rows, swap in fuse.js — but for typical inventory lists
 * (<500 rows) substring is cheap + zero dependencies.
 *
 * Usage:
 *   <FuzzySearch
 *     items={variants}
 *     keys={["sku", "name"]}
 *     placeholder="Search variants…"
 *     onSelect={(v) => setActive(v.id)}
 *     renderItem={(v) => <span>{v.sku} — {v.name}</span>}
 *   />
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MagnifyingGlass } from "@phosphor-icons/react"

interface Props<T> {
  items: T[]
  keys: Array<keyof T>
  onSelect: (item: T) => void
  renderItem: (item: T) => React.ReactNode
  placeholder?: string
  /** Limit visible matches. Default 8. */
  maxResults?: number
  /** ms debounce on the filter (default 80). */
  debounceMs?: number
  className?: string
}

export function FuzzySearch<T extends { id?: string | number }>({
  items,
  keys,
  onSelect,
  renderItem,
  placeholder = "Search…",
  maxResults = 8,
  debounceMs = 80,
  className,
}: Props<T>) {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement | null>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs)
    return () => clearTimeout(t)
  }, [query, debounceMs])

  const matches = useMemo(() => {
    if (!debounced.trim()) return items.slice(0, maxResults)
    const needle = debounced.toLowerCase()
    return items
      .filter((it) =>
        keys.some((k) => {
          const v = it[k]
          if (v == null) return false
          return String(v).toLowerCase().includes(needle)
        }),
      )
      .slice(0, maxResults)
  }, [items, keys, debounced, maxResults])

  // Reset highlight when matches change
  useEffect(() => {
    setActive(0)
  }, [matches])

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(matches.length - 1, a + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const m = matches[active]
      if (m) onSelect(m)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setQuery("")
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="pl-8 h-9"
        />
      </div>
      {debounced.trim() ? (
        <ul
          ref={listRef}
          role="listbox"
          className="flex flex-col gap-0.5 rounded-md border border-foreground/10 bg-background py-1 max-h-[320px] overflow-y-auto"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-muted-foreground">
              No matches
            </li>
          ) : (
            matches.map((m, i) => (
              <li
                key={String(m.id ?? i)}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => onSelect(m)}
                className={cn(
                  "px-3 py-1.5 text-[13px] cursor-pointer",
                  i === active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
                )}
              >
                {renderItem(m)}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
