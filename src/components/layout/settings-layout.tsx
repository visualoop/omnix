/**
 * Settings layout — vertical grouped sidebar (v0.27.3).
 *
 * Corrects the v0.25.0 mistake of moving groups to a horizontal tab bar
 * at the top of the sidebar. The masthead style pattern from other
 * sections doesn't translate well to nested navigation — users lose the
 * "see everything at once" affordance and don't naturally scan tabs on
 * a settings surface.
 *
 * This version keeps the new 7-group information architecture from
 * v0.25.0 (Business / People / Money / Hardware Devices / Application /
 * System + module-specific) but renders them the way settings surfaces
 * ACTUALLY work in Linear / Notion / Slack: a vertical scrollable
 * sidebar with monospace-uppercase group eyebrows above each block of
 * items. Everything visible at once, no toggling.
 *
 * Style preserved: cream paper #FBFAF6, Fraunces masthead, hairline
 * foreground/10 borders, 2 px module-accent strip on the active row.
 */
import { useMemo, useState } from "react";
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

function labelForGroup(group: SettingsGroup, countryCode: string): string {
  if (group === "Dawa") return pharmacyTerm(countryCode);
  if (group === "Hardware") return "Hardware Store";
  if (group === "Hardware Devices") return "Hardware";
  return group;
}

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

  const currentItem =
    visible.find((item) => item.to === location.pathname) ??
    visible.find((item) => location.pathname.startsWith(item.to + "/")) ??
    settingsRegistry().find((item) => item.to === location.pathname);

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? visible.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.to.toLowerCase().includes(q),
      )
    : null;

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

        {/* Search — filters across every group */}
        <div className="px-3 py-3 border-b border-foreground/10">
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
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Nav — grouped, vertical, everything visible */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {filtered ? (
            filtered.length === 0 ? (
              <div className="px-3 py-6 text-[12px] text-muted-foreground/80">
                No settings match &ldquo;{query}&rdquo;.
              </div>
            ) : (
              // Search results — one flat list.
              <div className="space-y-0.5">
                <div className="px-3 mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {filtered.length} match{filtered.length === 1 ? "" : "es"}
                </div>
                {filtered.map((item) => (
                  <SidebarRow key={item.to} item={item} groupLabel={labelForGroup(item.group, countryCode)} />
                ))}
              </div>
            )
          ) : (
            SETTINGS_GROUPS.map((group) => {
              const items = visible.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-0.5">
                  <div className="px-3 mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {labelForGroup(group, countryCode)}
                  </div>
                  {items.map((item) => (
                    <SidebarRow key={item.to} item={item} />
                  ))}
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {/* ─── Content ─────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-foreground/10 px-8 py-5 shrink-0">
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

interface SidebarRowProps {
  item: import("@/lib/settings-registry").SettingsNavItem;
  /** When set, shown as a subtle group hint (used in search results). */
  groupLabel?: string;
}

function SidebarRow({ item, groupLabel }: SidebarRowProps) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/settings"}
      className={({ isActive }) =>
        cn(
          "group relative flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
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
          <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium truncate">
              {item.label}
            </span>
            {groupLabel ? (
              <span className="block text-[10.5px] text-muted-foreground/80 truncate uppercase tracking-wider">
                {groupLabel}
              </span>
            ) : null}
          </span>
        </>
      )}
    </NavLink>
  );
}
