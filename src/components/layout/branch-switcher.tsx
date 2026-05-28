import { useEffect } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { useActiveBranch } from "@/stores/active-branch";
import { useNavigate } from "react-router-dom";

/**
 * Branch switcher in the topbar.
 *
 * Hidden if user only has 1 branch (no need to switch).
 * Shown as a compact dropdown showing the current branch's code + name.
 */
export function BranchSwitcher() {
  const user = useAuthStore((s) => s.user);
  const { active, available, loaded, loadForUser, setActive } = useActiveBranch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loaded) {
      loadForUser(user.id);
    }
  }, [user, loaded]);

  if (!user) return null;
  if (!active) return null;
  if (available.length <= 1) {
    // Single branch — show as static badge
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-r border-border pr-2 mr-1">
        <Building2 className="h-3 w-3" />
        <span className="font-medium text-foreground">{active.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2 text-xs font-medium">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[10px] text-muted-foreground">{active.code}</span>
            <span className="max-w-[120px] truncate">{active.name}</span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => setActive(b)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{b.code}</span>
                <span className="font-medium text-[13px] truncate">{b.name}</span>
              </div>
              {b.address && (
                <span className="text-[11px] text-muted-foreground truncate">{b.address}</span>
              )}
            </div>
            {active.id === b.id && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings/branches")}>
          <Building2 className="h-3.5 w-3.5" />
          <span>Manage branches…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
