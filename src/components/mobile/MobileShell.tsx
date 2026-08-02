import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MobileShellModel } from "@/mobile/shell";

export interface MobileShellProps {
  readonly model: MobileShellModel;
  readonly children: ReactNode;
  readonly onNavigate: (path: string) => void;
}

export function MobileShell({ model, children, onNavigate }: MobileShellProps) {
  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain bg-background text-foreground"
      data-form-factor={model.formFactor}
    >
      <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-sm">
        <div
          className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {model.isReadOnlyContext ? "Viewing" : "Working in"}
            </p>
            <p className="truncate text-sm font-semibold">{model.branchLabel}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xs font-semibold">{model.currency}</p>
            <p className="text-[10px] text-muted-foreground">{model.country}</p>
          </div>
        </div>
      </header>

      <main id="mobile-main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        <div className="mx-auto grid min-h-16 w-full max-w-3xl grid-flow-col auto-cols-fr">
          {model.primaryNavigation.map((route) => {
            const active =
              model.activePath === route.path ||
              (route.path !== "/mobile" && model.activePath.startsWith(`${route.path}/`));
            return (
              <button
                key={route.id}
                type="button"
                aria-current={active ? "page" : undefined}
                aria-controls="mobile-main-content"
                onClick={() => onNavigate(route.path)}
                className={cn(
                  "min-h-14 border-t-2 border-transparent px-2 text-[11px] font-medium text-muted-foreground outline-none transition-colors focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 active:bg-muted/60",
                  active && "border-primary text-foreground",
                )}
              >
                {route.label}
              </button>
            );
          })}
        </div>
      </nav>
      </div>
    </div>
  );
}
