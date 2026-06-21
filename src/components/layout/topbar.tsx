import { useAuthStore } from "@/stores/auth";
import { Moon, Sun, SignOut } from "@phosphor-icons/react";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/components/ui/button";
import { NetworkIndicator } from "@/components/layout/network-indicator";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { ROLE_INFO, type Role } from "@/lib/permissions";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useThemeStore();
  const roleInfo = user ? ROLE_INFO[user.role as Role] : null;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 glass-topbar">
      <div className="text-sm text-muted-foreground" />
      <div className="flex items-center gap-1">
        <BranchSwitcher />

        {/* Network indicator (only visible in master/client mode) */}
        <NetworkIndicator />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* User info + role + logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border/50">
            <div className="h-7 w-7 rounded-full bg-primary/10 ring-1 ring-inset ring-primary/15 flex items-center justify-center text-xs font-medium text-primary">
              {(user.full_name || user.username).charAt(0).toUpperCase()}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium">{user.full_name || user.username}</div>
              {roleInfo && (
                <div className={`${roleInfo.color} font-medium text-[10px]`}>
                  {roleInfo.label}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => useAuthStore.getState().signOut()}
              title="Sign out"
            >
              <SignOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
