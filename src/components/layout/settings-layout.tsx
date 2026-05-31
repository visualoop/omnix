import { ArrowLeft, Building2, CreditCard, FileCheck, Shield, Users, Key, Database, Activity, Network, Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule, type ModuleId } from "@/stores/active-module";
import { hasPermission, type Permission } from "@/lib/permissions";

interface SettingsNavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
  group: "Business" | "Access" | "Finance" | "Operations" | "Dawa" | "Retail" | "Hospitality";
  module?: ModuleId;
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { to: "/settings", label: "Business Profile", description: "Name, contacts, identity", icon: Building2, permission: "settings.business", group: "Business" },
  { to: "/settings/branches", label: "Locations & Branches", description: "Branches and user access", icon: Building2, permission: "settings.business", group: "Business" },
  { to: "/settings/users", label: "Users & Permissions", description: "Accounts, roles, branch access", icon: Users, permission: "users.view", group: "Access" },
  { to: "/settings/payments", label: "Payment Methods", description: "Cash, M-Pesa, cards, bank", icon: CreditCard, permission: "settings.business", group: "Finance" },
  { to: "/settings/etims", label: "KRA eTIMS", description: "Tax invoice signing", icon: FileCheck, permission: "etims.view", group: "Finance" },
  { to: "/settings/network", label: "LAN Multi-device", description: "Master/client mode", icon: Network, permission: "settings.network", group: "Operations" },
  { to: "/settings/modules", label: "Modules", description: "Active vertical and roadmap", icon: Boxes, permission: "settings.modules", group: "Operations" },
  { to: "/settings/backup", label: "Backup & Restore", description: "Protect business data", icon: Database, permission: "settings.backup", group: "Operations" },
  { to: "/settings/audit", label: "Audit Log", description: "Security and compliance history", icon: Activity, permission: "audit.view", group: "Operations" },
  { to: "/settings/license", label: "License", description: "Machine binding and updates", icon: Key, permission: "license.view", group: "Operations" },
  { to: "/settings/insurance", label: "Insurance Providers", description: "SHA and private insurers", icon: Shield, permission: "claims.view", group: "Dawa", module: "dawa" },
];

const GROUPS: SettingsNavItem["group"][] = ["Business", "Access", "Finance", "Operations", "Dawa", "Retail", "Hospitality"];

export function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const activeModule = useActiveModule((s) => s.active);

  const visible = SETTINGS_NAV.filter((item) => {
    if (item.module && item.module !== activeModule) return false;
    return hasPermission(user, item.permission);
  });
  const current = visible.find((item) => item.to === location.pathname) ?? visible.find((item) => location.pathname.startsWith(item.to + "/"));

  return (
    <div className="-m-6 flex h-[calc(100vh-48px)] bg-background">
      <aside className="w-[248px] shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="h-12 border-b border-border px-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
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
          {GROUPS.map((group) => {
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
