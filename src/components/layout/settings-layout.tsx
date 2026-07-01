/**
 * Settings layout — tab-driven redesign (v0.25.0).
 *
 * The old design surfaced all 24 items in one long sidebar broken by
 * mono-caps subheadings. The "Operations" group carried 14 items — a
 * bucket for anything that didn't obviously belong elsewhere — which
 * made the whole surface feel like "everything is everywhere".
 *
 * The new shell:
 *   1. Groups the registry into 7 job-oriented tabs at the top of the
 *      sidebar (Business, People, Money, Hardware Devices, Application,
 *      System) plus any module-specific tabs (Dawa, Hardware Store,
 *      Hospitality) that only show when their module is active.
 *   2. Adds a fuzzy search field at the top that filters across every
 *      tab. Selecting a match auto-switches to the item's tab.
 *   3. Preserves the editorial masthead (Fraunces + mono eyebrow) and
 *      keeps every existing route path — bookmarks and deep links from
 *      earlier releases continue to resolve.
 *
 * Style: still cream paper (#FBFAF6) + hairline foreground/10 rules +
 * 2 px module-accent strip on the active row. The tab-bar itself uses
 * an underline treatment in the module-accent colour so it reads as
 * masthead rubric rather than button UI.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  MagnifyingGlass as Search,
  X,
} from "@phosphor-icons/react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule } from "@/stores/active-module";
import { hasPermission } from "@/lib/permissions";
import {
  settingsRegistry,
  SETTINGS_GROUPS,
  type SettingsGroup,
} from "@/lib/settings-registry";
import { useIsKenya } from "@/lib/features";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";

/** Human labels for tabs (keeps registry types stable if we rename copy). */
function labelForGroup(group: SettingsGroup, countryCode: string): string {
  if (group === "Dawa") return pharmacyTerm(countryCode);
  if (group === "Hardware") return "Hardware Store";
  if (group === "Hardware Devices") return "Hardware";
  return group;
}

/** Best-effort tag for "which tab should be default when landing on /settings". */
const DEFAULT_TAB: SettingsGroup = "Business";

export function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const activeModule = useActiveModule((s) => s.active);
  const countryCode = useCountry((s) => s.code) ?? "KE";
  const isKenya = useIsKenya();

  const KENYA_ONLY_PATHS = new Set(["/settings/etims", "/settings/insurance"]);

  const visible = useMemo(
    () =>
      settingsRegistry().filter((item) => {
        if (item.hidden) return false;
        if (item.module && item.module !== activeModule) return false;
        if (KENYA_ONLY_PATHS.has(item.to) && !isKenya) return false;
        return hasPermission(user, item.permission);
      }),
    [activeModule, isKenya, user],
  );

  // Groups that actually have entries the current user can see. Empty
  // groups don't get a tab.
  const groupsWithItems = useMemo(() => {
    const set = new Set(visible.map((i) => i.group));
    return SETTINGS_GROUPS.filter((g) => set.has(g));
  }, [visible]);

  // Match the currently visible entry against location — this also tells
  // the sidebar which tab to open.
  const currentItem =
    visible.find((item) => item.to === location.pathname) ??
    visible.find((item) => location.pathname.startsWith(item.to + "/")) ??
    // Legacy /settings/license and other hidden entries — pick nearest
    // registered path so the masthead still labels the surface.
    settingsRegistry().find((item) => item.to === location.pathname);

  const [activeTab, setActiveTab] = useState<SettingsGroup>(() =>
    currentItem?.group ?? groupsWithItems[0] ?? DEFAULT_TAB,
  );

  // Sync the active tab whenever the URL changes to a different group.
  useEffect(() => {
    if (currentItem && currentItem.group !== activeTab) {
      setActiveTab(currentItem.group);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.to]);

  // Fuzzy search — filters across ALL visible items, not just the active tab.
  const [query, setQuery] = useState("");
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = visible.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.to.toLowerCase().includes(q),
    );
    // Cap to 8 so the dropdown never grows into the content area.
    return matches.slice(0, 8);
  }, [query, visible]);

  const itemsInActiveTab = visible.filter((item) => item.group === activeTab);
  const backToDashboard = () => navigate("/");

  return (
    <div className="-m-6 flex h-[calc(100vh-48px)] bg-[#FBFAF6] dark:bg-background">
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside className="w-[280px] shrink-0 border-r border-foreground/10 flex flex-col">
        {/* Header — back + masthead */}
        <div className="h-14 border-b border-foreground/10 px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={backToDashboard}
            className="size-8 rounded-md hover:bg-foreground/[0.04] grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Configuration
            </div>
            <div
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="text-[18px] font-medium leading-none tracking-[-0.005em] mt-0.5"
            >
              Settings
            </div>
          </div>
        </div>

        {/* Search — jumps across every tab */}
        <div className="px-3 py-3 border-b border-foreground/10 relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings…"
              className="w-full h-8 pl-8 pr-8 rounded-md border border-foreground/10 bg-background/60 text-[13px] outline-none focus:border-foreground/30 transition-colors"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground"
                title="Clear"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          {/* Results dropdown */}
          {query && searchResults.length > 0 ? (
            <div className="absolute left-3 right-3 top-full mt-1 z-20 border border-foreground/10 rounded-md bg-background shadow-sm overflow-hidden">
              {searchResults.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.group);
                    setQuery("");
                    navigate(item.to);
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-foreground/[0.04] transition-colors"
                >
                  <item.icon className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-[13px] truncate">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground/80 truncate">
                      {labelForGroup(item.group, countryCode)} · {item.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {query && searchResults.length === 0 ? (
            <div className="absolute left-3 right-3 top-full mt-1 z-20 border border-foreground/10 rounded-md bg-background shadow-sm px-3 py-2 text-[12px] text-muted-foreground">
              No settings match &ldquo;{query}&rdquo;.
            </div>
          ) : null}
        </div>

        {/* Tabs — masthead-style. Horizontal scroll on narrow viewports. */}
        <div className="border-b border-foreground/10 overflow-x-auto">
          <div className="flex px-3 py-2 gap-1 min-w-max">
            {groupsWithItems.map((group) => {
              const isActive = group === activeTab;
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setActiveTab(group)}
                  className={cn(
                    "relative px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors whitespace-nowrap",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80",
                  )}
                >
                  {labelForGroup(group, countryCode)}
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute left-2 right-2 bottom-0 h-[2px] bg-primary"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Item list — only the active tab's items */}
        <nav className="flex-1 overflow-auto px-2 py-3">
          {itemsInActiveTab.length === 0 ? (
            <p className="px-3 py-6 text-[12px] text-muted-foreground/80">
              Nothing in this tab yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {itemsInActiveTab.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/settings"}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      isActive
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-primary"
                        />
                      ) : null}
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 text-[13px] font-medium truncate">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
      </aside>

      {/* ─── Content ─────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Masthead — newspaper-style */}
        <header className="border-b border-foreground/10 px-8 py-5 flex items-baseline justify-between shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {currentItem ? labelForGroup(currentItem.group, countryCode) : "Settings"}
            </div>
            <h1
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="mt-1 text-[28px] font-medium leading-[1.05] tracking-[-0.01em]"
            >
              {currentItem?.label ?? "Settings"}
            </h1>
            {currentItem?.description && (
              <p className="mt-1.5 max-w-[60ch] text-[13px] leading-[1.55] text-muted-foreground">
                {currentItem.description}
              </p>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto px-8 py-7">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
