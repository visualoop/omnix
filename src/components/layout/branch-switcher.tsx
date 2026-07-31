import { useEffect } from "react";
import {
  Buildings,
  Building as Building2,
  CaretUpDown as ChevronsUpDown,
  ChartBar,
  Check,
  LockSimple,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { useActiveBranch } from "@/stores/active-branch";
import { useNavigate } from "react-router-dom";

interface BranchSwitcherProps {
  compact?: boolean;
}

export function BranchSwitcher({ compact = false }: BranchSwitcherProps) {
  const user = useAuthStore((state) => state.user);
  const { active, available, loaded, loadForUser, scope, switchTo, switchToAllBranches } = useActiveBranch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loaded) void loadForUser(user.id);
  }, [loadForUser, loaded, user]);

  if (!user) return null;

  if (!active) {
    if (!loaded) return null;
    return (
      <div
        className="flex min-h-11 min-w-0 items-center gap-1.5 border-r border-border pr-2 text-xs text-muted-foreground sm:min-h-0"
        aria-label="No branch assigned"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium">No branch assigned</span>
      </div>
    );
  }

  const canAggregate = available.length > 1 && ["owner", "admin", "manager"].includes(user.role);

  if (available.length <= 1 && scope === "branch") {
    return (
      <div
        className="flex min-h-11 min-w-0 items-center gap-1.5 border-r border-border pr-2 text-xs text-muted-foreground sm:min-h-0"
        aria-label={`Active branch: ${active.name}`}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium text-foreground">{compact ? active.code : active.name}</span>
      </div>
    );
  }

  const label = scope === "all" ? "All Branches" : active.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-11 max-w-[11rem] gap-1.5 px-2 text-xs font-medium sm:h-7 sm:max-w-none"
            aria-label={scope === "all" ? "All Branches analytics. Choose context" : `Active branch: ${active.name}. Switch branch`}
          >
            {scope === "all" ? <Buildings className="h-3.5 w-3.5 text-primary" /> : <Building2 className="h-3.5 w-3.5 text-primary" />}
            {scope === "branch" ? <span className="font-mono text-[10px] text-muted-foreground">{active.code}</span> : null}
            {!compact ? <span className="max-w-[120px] truncate">{label}</span> : null}
            {scope === "all" ? <LockSimple className="h-3 w-3 text-muted-foreground" aria-label="Read-only" /> : null}
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[min(19rem,calc(100vw-2rem))] sm:w-[260px]">
        <DropdownMenuLabel>
          <span className="block text-foreground">Data context</span>
          <span className="block text-[10px] font-normal">Branch contexts allow operations. All Branches is analytics only.</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => void switchTo(branch)}
            className="h-auto min-h-11 items-center justify-between gap-2 py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{branch.code}</span>
                <span className="truncate text-[13px] font-medium">{branch.name}</span>
              </div>
              {branch.address ? <span className="truncate text-[11px] text-muted-foreground">{branch.address}</span> : null}
            </div>
            {scope === "branch" && active.id === branch.id ? <Check className="h-3.5 w-3.5 text-primary" aria-label="Current branch" /> : null}
          </DropdownMenuItem>
        ))}
        {canAggregate ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="h-auto min-h-11 items-center justify-between py-2"
              onClick={() => void switchToAllBranches().then(() => navigate("/reports/analytics"))}
            >
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium"><Buildings className="h-3.5 w-3.5" /> All Branches</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Read-only manager analytics</div>
              </div>
              {scope === "all" ? <Check className="h-3.5 w-3.5 text-primary" aria-label="Current context" /> : <LockSimple className="h-3.5 w-3.5 text-muted-foreground" />}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-11" onClick={() => navigate("/settings/branches")}>
          <ChartBar className="h-3.5 w-3.5" />
          <span>View branch performance</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
