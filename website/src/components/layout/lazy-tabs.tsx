'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'

export interface LazyTab {
  id: string
  label: string
  count?: number | string
  render: () => ReactNode
}

interface Props {
  tabs: LazyTab[]
  defaultTab?: string
  paramKey?: string
  className?: string
}

/**
 * LazyTabs — URL-deeplinked tab strip with lazy mounting. Mirrors the
 * desktop primitive but uses Next.js' useRouter + searchParams.
 *
 * Once a tab is opened it stays mounted (so going back doesn't refetch).
 */
export function LazyTabs({ tabs, defaultTab, paramKey = 'tab', className }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const initial = params.get(paramKey) ?? defaultTab ?? tabs[0]?.id
  const [activeId, setActiveId] = useState<string>(initial ?? '')
  const mounted = useRef<Set<string>>(new Set())
  if (activeId) mounted.current.add(activeId)

  function activate(id: string) {
    setActiveId(id)
    const next = new URLSearchParams(Array.from(params.entries()))
    next.set(paramKey, id)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const renderedTabs = useMemo(() => {
    return tabs.map((t) => {
      const shouldRender = mounted.current.has(t.id)
      const isActive = t.id === activeId
      if (!shouldRender) return null
      return (
        <div
          key={t.id}
          role="tabpanel"
          id={`tabpanel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={!isActive}
          className={isActive ? 'block' : 'hidden'}
        >
          {t.render()}
        </div>
      )
    })
  }, [tabs, activeId])

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div role="tablist" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-foreground/10">
        {tabs.map((t) => {
          const isActive = t.id === activeId
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={isActive}
              onClick={() => activate(t.id)}
              className={cn(
                'relative -mb-px inline-flex items-center gap-1.5 border-b py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer',
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground/80',
              )}
            >
              <span>{t.label}</span>
              {t.count !== undefined && t.count !== null ? (
                <span
                  className={cn(
                    'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-foreground/15 bg-background px-1 text-[10px] font-medium tabular-nums',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div>{renderedTabs}</div>
    </div>
  )
}
