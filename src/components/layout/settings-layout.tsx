import { ArrowLeft } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule } from "@/stores/active-module";
import { hasPermission } from "@/lib/permissions";
import { settingsRegistry, SETTINGS_GROUPS } from "@/lib/settings-registry";
import { useIsKenya } from "@/lib/features";

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
  const current = visible.find((item) => item.to === location.pathname) ?? visible.find((item) => location.pathname.startsWith(item.to + "/"));

  return (
    <div className="-m-6 flex h-[calc(100vh-48px)] bg-background">
      <aside className="w-[248px] shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="h-12 border-b border-border px-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => backToDashboard()}
            className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Settings</div>
            <div className="text-[10px] text-muted-foreground truncate">System configuration</div>
          </div>
        </div>

        <nav className="flex-1 overflow-auto px-2 py-3 space-y-4">
          {SETTINGS_GROUPS.map((group) => {
            const items = visible.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-1">
                <div className="px-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{group}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/settings"}
                    className={({ isActive }) => cn(
                      "flex gap-2 rounded-md px-2 py-2 text-left transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium truncate">{item.label}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{item.description}</span>
                    </span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 border-b border-border px-5 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold leading-tight">{current?.label ?? "Settings"}</h1>
            {current?.description && <p className="text-[11px] text-muted-foreground">{current.description}</p>}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
