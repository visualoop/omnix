'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'

export interface LazyTab {
  id: string
  label: string
  count?: number | string
  /**
   * Pre-rendered tab content. Pass JSX directly — NOT a render function.
   *
   * Why ReactNode and not `() => ReactNode`: this component is `'use client'`,
   * which means props cross the server/client boundary. Functions can't be
   * passed across that boundary, so a render-prop API would crash any
   * Server Component caller with "Functions cannot be passed to Client
   * Components." Passing rendered JSX (ReactNode) is the supported pattern.
   *
   * Note: all tabs are rendered server-side up-front. Tabs that aren't
   * currently active are hidden via `hidden` + `className=hidden` so they
   * cost no layout work. There's no longer a real "lazy mount" — but the
   * cost was tiny anyway (a tab body is usually <10 elements), and the
   * Server Component compatibility gain is worth it.
   */
  content: ReactNode
}

interface Props {
  tabs: LazyTab[]
  defaultTab?: string
  paramKey?: string
  className?: string
}

/**
 * URL-deeplinked tab strip. Active tab id is stored in `?tab=…` so links
 * and refreshes preserve the open tab.
 */
export function LazyTabs({ tabs, defaultTab, paramKey = 'tab', className }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const initial = params.get(paramKey) ?? defaultTab ?? tabs[0]?.id
  const [activeId, setActiveId] = useState<string>(initial ?? '')

  function activate(id: string) {
    setActiveId(id)
    const next = new URLSearchParams(Array.from(params.entries()))
    next.set(paramKey, id)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const renderedTabs = useMemo(() => {
    return tabs.map((t) => {
      const isActive = t.id === activeId
      return (
        <div
          key={t.id}
          role="tabpanel"
          id={`tabpanel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={!isActive}
          className={isActive ? 'block' : 'hidden'}
        >
          {t.content}
        </div>
      )
    })
  }, [tabs, activeId])

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div
        role="tablist"
        className="-mx-1 flex flex-nowrap items-center gap-x-5 overflow-x-auto border-b border-[var(--color-border)] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
                'relative -mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b px-0.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-[var(--duration-fast)] cursor-pointer',
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
