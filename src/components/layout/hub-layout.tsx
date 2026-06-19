/**
 * HubLayout — generic two-section layout for module / functional hubs.
 *
 * Header strip with the hub name + optional summary stats on the right.
 * Tab strip below, no sidebar submenu (sidebar stays simple).
 * Tabs swap inline via the ?tab= search param so deep links keep working.
 *
 * Why hub pages: the old sidebar bloated past 20 entries. People got
 * lost. Grouping eight HR routes under one "People" hub, eight retail
 * routes under "Retail", etc., drops the sidebar to a digestible list
 * and gives each domain its own room to breathe.
 *
 * Design (frontend-design + emil-design-eng):
 *   - Header shows the hub name in display type (Fraunces) + a 12px
 *     mono caption underneath, Linear-style.
 *   - Tabs are pill chips, only the active one carries the accent.
 *   - Tab transitions are 150ms — fast enough to feel like a switch,
 *     slow enough that the eye registers the change.
 *   - No drop shadows, no gradients. The chrome is quiet so the tab
 *     content can carry visual weight.
 */
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode, type ComponentType } from "react";

export interface HubTab {
  /** URL slug; written to ?tab= */
  id: string;
  label: string;
  /** Optional badge — e.g. count of unread / pending items. */
  badge?: number | string;
  icon?: ComponentType<{ className?: string }>;
  /** Component to render when this tab is active. */
  component: ComponentType<unknown>;
  /** Optional permission gate — tab hides when user lacks it. */
  permission?: string;
}

interface Props {
  /** Big display title (Fraunces). */
  title: string;
  /** Mono caption above the title. */
  eyebrow?: string;
  /** Body copy under the title — keep to 1–2 short sentences. */
  description?: string;
  /** Right-aligned summary content — usually 2–3 KPI stats. */
  summary?: ReactNode;
  tabs: HubTab[];
  /** Default tab when no ?tab= is in URL. Falls back to first tab. */
  defaultTabId?: string;
  /** Current user's permission set, if you want to filter tabs. */
  hasPermission?: (perm: string) => boolean;
}

export function HubLayout({
  title, eyebrow, description, summary, tabs, defaultTabId, hasPermission,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleTabs = tabs.filter((t) => !t.permission || (hasPermission?.(t.permission) ?? true));
  const requestedTab = searchParams.get("tab") ?? defaultTabId ?? visibleTabs[0]?.id;
  const activeTab = visibleTabs.find((t) => t.id === requestedTab) ?? visibleTabs[0];

  // Sync default tab into URL on first mount so reload + back-button work.
  useEffect(() => {
    if (!searchParams.get("tab") && activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab.id);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    navigate(`${location.pathname}?${next.toString()}`, { replace: false });
  };

  const Active = activeTab?.component;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {eyebrow ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="mt-1.5 font-[family-name:var(--font-display,_serif)] text-[clamp(28px,3vw,38px)] font-medium leading-[1.1] tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.55] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {summary ? (
          <div className="shrink-0">{summary}</div>
        ) : null}
      </header>

      {/* Tab strip */}
      <nav className="flex flex-wrap items-center gap-1.5 border-b border-border/60 -mx-1 px-1 pb-px">
        {visibleTabs.map((t) => {
          const active = t.id === activeTab?.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`group relative flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {Icon ? <Icon className="size-3.5" /> : null}
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge !== 0 ? (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground/10 px-1 text-[10px] font-mono tabular-nums text-foreground">
                  {t.badge}
                </span>
              ) : null}
              {active ? (
                <span className="absolute -bottom-px left-2 right-2 h-[2px] bg-foreground rounded-full" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      <div className="min-h-[40vh]">
        {Active ? <Active /> : null}
      </div>
    </div>
  );
}
