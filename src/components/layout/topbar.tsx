import { useAuthStore } from "@/stores/auth";
import { Moon, Sun, LogOut } from "lucide-react";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/components/ui/button";
import { NetworkIndicator } from "@/components/layout/network-indicator";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useThemeStore();

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-background">
      <div className="text-sm text-muted-foreground" />
      <div className="flex items-center gap-2">
        {/* Network indicator (only visible in master/client mode) */}
        <NetworkIndicator />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* User info + logout */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {user.full_name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => useAuthStore.getState().signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
