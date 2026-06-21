/**
 * Settings layout — redesigned with the editorial design language.
 *
 * Style notes (frontend-design + emil-design-eng + anti-slop-writing):
 *   - Background: #FBFAF6 cream paper (matches POS overview, P&L)
 *   - Masthead strip: Fraunces serif title + mono caption above
 *   - Sidebar: hairline border-right, mono-uppercase group labels,
 *     subtle hover at foreground/[0.04], active at foreground/[0.06]
 *     plus a 2 px module-accent strip on the left edge of the active row
 *   - No drop shadows. No card containers. Hairline rules between sections.
 *
 * Icons in the registry are now Phosphor (the site-wide sweep landed in
 * v0.7.15). The active-row treatment matches the rest of the redesigned
 * surfaces: 2 px module-accent strip + bg-foreground/[0.06] tint.
 */
import {
  ArrowLeft,
} from "@phosphor-icons/react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule } from "@/stores/active-module";
import { hasPermission } from "@/lib/permissions";
import { settingsRegistry, SETTINGS_GROUPS } from "@/lib/settings-registry";
import { useIsKenya } from "@/lib/features";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";

export function SettingsLayout() {
  const navigate = useNavigate();
  const backToDashboard = () => navigate("/");
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const activeModule = useActiveModule((s) => s.active);

  const isKenya = useIsKenya();
  const KENYA_ONLY_PATHS = new Set(["/settings/etims", "/settings/insurance"]);

  const visible = settingsRegistry().filter((item) => {
    if (item.module && item.module !== activeModule) return false;
    if (KENYA_ONLY_PATHS.has(item.to) && !isKenya) return false;
    return hasPermission(user, item.permission);
  });
  const current =
    visible.find((item) => item.to === location.pathname) ??
    visible.find((item) => location.pathname.startsWith(item.to + "/"));

  return (
    <div className="-m-6 flex h-[calc(100vh-48px)] bg-[#FBFAF6] dark:bg-background">
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside className="w-[260px] shrink-0 border-r border-foreground/10 flex flex-col">
        {/* Header: back + brand */}
        <div className="h-14 border-b border-foreground/10 px-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => backToDashboard()}
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

        {/* Nav */}
        <nav className="flex-1 overflow-auto px-2 py-4 space-y-5">
          {SETTINGS_GROUPS.map((group) => {
            const items = visible.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="px-3 mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {group === "Dawa" ? pharmacyTerm(useCountry.getState().code) : group}
                </div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
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
                            className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-r-full bg-primary"
                          />
                        ) : null}
                        <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium truncate">{item.label}</span>
                          <span className="block text-[11px] text-muted-foreground/80 truncate leading-snug">
                            {item.description}
                          </span>
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ─── Content ─────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Masthead — newspaper-style */}
        <header className="border-b border-foreground/10 px-8 py-5 flex items-baseline justify-between shrink-0">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {current?.group ?? "Settings"}
            </div>
            <h1
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="mt-1 text-[28px] font-medium leading-[1.05] tracking-[-0.01em]"
            >
              {current?.label ?? "Settings"}
            </h1>
            {current?.description && (
              <p className="mt-1.5 max-w-[60ch] text-[13px] leading-[1.55] text-muted-foreground">
                {current.description}
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
