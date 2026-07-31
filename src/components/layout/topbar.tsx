import { useAuthStore } from "@/stores/auth";
import { List, Moon, SignOut, Sun } from "@phosphor-icons/react";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NetworkIndicator } from "@/components/layout/network-indicator";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { ROLE_INFO, type Role } from "@/lib/permissions";
import { useFormFactor } from "@/hooks/use-form-factor";

interface TopbarProps {
  onNavigationOpen?: () => void;
}

export function Topbar({ onNavigationOpen }: TopbarProps) {
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useThemeStore();
  const formFactor = useFormFactor();
  const desktop = formFactor === "desktop";
  const phone = formFactor === "phone";
  const roleInfo = user ? ROLE_INFO[user.role as Role] : null;
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const signOut = () => useAuthStore.getState().signOut();

  return (
    <header className="sticky top-0 z-30 flex min-h-12 items-center justify-between gap-2 px-[max(0.75rem,env(safe-area-inset-left))] glass-topbar sm:px-4">
      <div className="flex min-w-0 items-center gap-1">
        {onNavigationOpen ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 lg:hidden"
            onClick={onNavigationOpen}
            aria-label="Open application navigation"
          >
            <List className="size-5" />
          </Button>
        ) : null}
        {!desktop ? <BranchSwitcher compact={phone} /> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 pr-[env(safe-area-inset-right)]">
        {desktop ? <BranchSwitcher /> : null}
        {!phone ? <NetworkIndicator /> : null}
        <div className={phone ? "[&_[data-slot=dropdown-menu-trigger]]:size-11" : undefined}>
          <NotificationBell />
        </div>

        {!phone ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={toggleTheme}
            aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        ) : null}

        {user && !phone ? (
          <div className="flex items-center gap-2 border-l border-border/50 pl-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
              {(user.full_name || user.username).charAt(0).toUpperCase()}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium">{user.full_name || user.username}</div>
              {roleInfo ? <div className={`${roleInfo.color} text-[10px] font-medium`}>{roleInfo.label}</div> : null}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={signOut} title="Sign out">
              <SignOut className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {user && phone ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-11 items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              aria-label="Open profile menu"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
                {(user.full_name || user.username).charAt(0).toUpperCase()}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate text-foreground">{user.full_name || user.username}</span>
                {roleInfo ? <span className="mt-0.5 block text-[11px] font-normal">{roleInfo.label}</span> : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="h-11" onClick={toggleTheme}>
                {theme === "dark" ? <Sun /> : <Moon />}
                Use {theme === "dark" ? "light" : "dark"} theme
              </DropdownMenuItem>
              <DropdownMenuItem className="h-11" onClick={signOut}>
                <SignOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
