/**
 * LazyTabs — URL-deeplinked tab strip used on every entity detail page.
 *
 * Behaviour:
 *   - Active tab is reflected in `?tab=...` so links / refresh / share
 *     all open the same view.
 *   - Tab content is lazy-mounted: the active panel renders, others
 *     return null until first opened. After first render the content
 *     stays mounted (so going back doesn't re-fetch).
 *   - Visual: hairline-bottom strip with mono uppercase labels, an
 *     accent underline on the active one. No card chrome.
 *
 * Usage:
 *   <LazyTabs
 *     defaultTab="overview"
 *     tabs={[
 *       { id: "overview", label: "Overview", render: () => <Overview /> },
 *       { id: "stock",    label: "Stock",    render: () => <Stock /> },
 *       ...
 *     ]}
 *   />
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"

export interface LazyTab {
  id: string
  label: string
  /** Optional badge (e.g. counts) shown next to the tab label. */
  count?: number | string
  /** Renders the tab body. Called lazily — only when the tab first activates. */
  render: () => ReactNode
}

interface Props {
  tabs: LazyTab[]
  defaultTab?: string
  /** Override the URL query key (default: "tab"). */
  paramKey?: string
  className?: string
}

export function LazyTabs({ tabs, defaultTab, paramKey = "tab", className }: Props) {
  const [params, setParams] = useSearchParams()
  const initial = params.get(paramKey) ?? defaultTab ?? tabs[0]?.id
  const [activeId, setActiveId] = useState<string>(initial ?? "")
  // Track which tabs have ever been mounted so they stay alive after switching.
  const mounted = useRef<Set<string>>(new Set())
  if (activeId) mounted.current.add(activeId)

  useEffect(() => {
    // Sync URL param → state when user navigates back/forward
    const fromUrl = params.get(paramKey)
    if (fromUrl && fromUrl !== activeId && tabs.some((t) => t.id === fromUrl)) {
      setActiveId(fromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function activate(id: string) {
    setActiveId(id)
    // Avoid leaking other params; only set the one we own.
    const next = new URLSearchParams(params)
    next.set(paramKey, id)
    setParams(next, { replace: true })
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
          className={isActive ? "block" : "hidden"}
        >
          {t.render()}
        </div>
      )
    })
  }, [tabs, activeId])

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div
        role="tablist"
        aria-label="Detail tabs"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-foreground/10"
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
              aria-controls={`tabpanel-${t.id}`}
              onClick={() => activate(t.id)}
              className={cn(
                "relative -mb-px inline-flex items-center gap-1.5 border-b py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/80",
              )}
            >
              <span>{t.label}</span>
              {t.count !== undefined && t.count !== null ? (
                <span
                  className={cn(
                    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-foreground/15 bg-background px-1 text-[10px] font-medium tabular-nums",
                    isActive ? "text-foreground" : "text-muted-foreground",
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
