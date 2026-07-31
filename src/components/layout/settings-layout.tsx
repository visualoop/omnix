import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, List, MagnifyingGlass as Search, X } from "@phosphor-icons/react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ModuleLogo } from "@/components/module-logos";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule } from "@/stores/active-module";
import { BRAND } from "@/lib/brand";
import { VARIANT, IS_PRO } from "@/lib/variant";
import { hasPermission } from "@/lib/permissions";
import {
  settingsRegistry,
  SETTINGS_GROUPS,
  type SettingsGroup,
  type SettingsNavItem,
} from "@/lib/settings-registry";
import { useIsKenya } from "@/lib/features";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";
import { useFormFactor } from "@/hooks/use-form-factor";

const KENYA_ONLY_PATHS = new Set(["/settings/etims", "/settings/insurance"]);

function labelForGroup(group: SettingsGroup, countryCode: string): string {
  if (group === "Dawa") return pharmacyTerm(countryCode);
  if (group === "Hardware") return "Hardware Store";
  if (group === "Hardware Devices") return "Hardware";
  return group;
}

export function SettingsLayout() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const activeModule = useActiveModule((state) => state.active);
  const countryCode = useCountry((state) => state.code) ?? "KE";
  const isKenya = useIsKenya();
  const desktop = useFormFactor() === "desktop";
  const [navigationOpen, setNavigationOpen] = useState(false);

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
    visible.find((item) => location.pathname.startsWith(`${item.to}/`)) ??
    settingsRegistry().find((item) => item.to === location.pathname);

  useEffect(() => setNavigationOpen(false), [location.pathname]);
  useEffect(() => {
    if (desktop) setNavigationOpen(false);
  }, [desktop]);

  const navigation = (
    <SettingsNavigation
      visible={visible}
      countryCode={countryCode}
      onNavigate={() => setNavigationOpen(false)}
    />
  );

  return (
    <div className="flex h-full min-h-0 bg-background">
      {desktop ? (
        <aside className="flex min-h-0 w-[280px] shrink-0 flex-col border-r border-foreground/10">
          {navigation}
        </aside>
      ) : (
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetContent
            side="left"
            className="!inset-y-0 !top-0 w-[min(22rem,calc(100vw-1rem))] max-w-none rounded-none p-0 motion-reduce:transition-none [&>div]:px-0"
            aria-describedby={undefined}
          >
            <SheetTitle className="sr-only">Settings navigation</SheetTitle>
            {navigation}
          </SheetContent>
        </Sheet>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-foreground/10 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5">
          <div className="flex items-start gap-3">
            {!desktop ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 -ml-2"
                onClick={() => setNavigationOpen(true)}
                aria-label="Open settings navigation"
              >
                <List className="size-5" />
              </Button>
            ) : null}
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {currentItem ? labelForGroup(currentItem.group, countryCode) : "Settings"}
              </div>
              <h1
                style={{ fontFamily: "var(--font-display, serif)" }}
                className="mt-1 text-[clamp(24px,5vw,28px)] font-medium leading-[1.05] tracking-[-0.01em]"
              >
                {currentItem?.label ?? "Settings"}
              </h1>
              {currentItem?.description ? (
                <p className="mt-1.5 max-w-[60ch] text-[13px] leading-[1.55] text-muted-foreground">
                  {currentItem.description}
                </p>
              ) : null}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-[max(1rem,env(safe-area-inset-left))] py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </section>
    </div>
  );
}

interface SettingsNavigationProps {
  visible: SettingsNavItem[];
  countryCode: string;
  onNavigate: () => void;
}

function SettingsNavigation({ visible, countryCode, onNavigate }: SettingsNavigationProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? visible.filter(
        (item) =>
          item.label.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          item.to.toLowerCase().includes(normalizedQuery),
      )
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col pb-[env(safe-area-inset-bottom)]">
      <div className="flex min-h-14 items-center gap-3 border-b border-foreground/10 px-4 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none lg:size-8"
          title="Back to dashboard"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Configuration</div>
          <div
            style={{ fontFamily: "var(--font-display, serif)" }}
            className="mt-0.5 text-[18px] font-medium leading-none tracking-[-0.005em]"
          >
            Settings
          </div>
        </div>
      </div>

      <div className="border-b border-foreground/10 px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="search"
            aria-label="Search settings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings…"
            className="h-11 w-full rounded-md border border-foreground/10 bg-background/60 pl-9 pr-11 text-[14px] outline-none transition-colors focus:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none lg:h-8 lg:pr-8 lg:text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:right-1.5 lg:size-5"
              aria-label="Clear settings search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3" aria-label="Settings">
        {filtered ? (
          filtered.length === 0 ? (
            <div className="px-3 py-6 text-[12px] text-muted-foreground/80">
              No settings match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {filtered.length} match{filtered.length === 1 ? "" : "es"}
              </div>
              {filtered.map((item) => (
                <SidebarRow
                  key={item.to}
                  item={item}
                  groupLabel={labelForGroup(item.group, countryCode)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )
        ) : (
          SETTINGS_GROUPS.map((group) => {
            const items = visible.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {labelForGroup(group, countryCode)}
                </div>
                {items.map((item) => <SidebarRow key={item.to} item={item} onNavigate={onNavigate} />)}
              </div>
            );
          })
        )}
      </nav>
      <SettingsSidebarFooter />
    </div>
  );
}

interface SidebarRowProps {
  item: SettingsNavItem;
  groupLabel?: string;
  onNavigate: () => void;
}

declare const __APP_VERSION__: string;

function moduleIconFor(moduleId: string, size = 36) {
  return <ModuleLogo moduleId={moduleId} size={size} rounded className="shrink-0" />;
}

function SettingsSidebarFooter() {
  const activeModule = useActiveModule((state) => state.active);
  const moduleId = VARIANT === "pro" ? activeModule : VARIANT;
  const version = (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) || "";
  const navigate = useNavigate();

  return (
    <div className="mt-auto border-t border-foreground/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="size-9 shrink-0">{moduleIconFor(moduleId, 36)}</div>
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: "var(--font-display, serif)" }} className="truncate text-[13px] font-medium leading-tight">
            {BRAND.name}
          </div>
          {!IS_PRO ? <div className="truncate text-[10px] text-muted-foreground/80">Powered by {BRAND.parentBrand}</div> : null}
        </div>
      </div>
      {version ? (
        <button
          type="button"
          onClick={() => navigate("/settings/updates")}
          className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md border border-foreground/10 px-3 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none lg:min-h-0 lg:rounded-full lg:px-2 lg:py-0.5"
        >
          <span className="opacity-60">v</span>{version}
        </button>
      ) : null}
    </div>
  );
}

function SidebarRow({ item, groupLabel, onNavigate }: SidebarRowProps) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/settings"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex min-h-11 items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none lg:min-h-0",
          isActive
            ? "bg-foreground/[0.06] text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[2px] rounded-r-full bg-primary" /> : null}
          <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium">{item.label}</span>
            {groupLabel ? (
              <span className="block truncate text-[10.5px] uppercase tracking-wider text-muted-foreground/80">{groupLabel}</span>
            ) : null}
          </span>
        </>
      )}
    </NavLink>
  );
}
