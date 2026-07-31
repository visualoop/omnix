import { useState, useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { WindowTitlebar, TITLEBAR_HEIGHT_PX } from "./window-titlebar";
import { useFullscreenStore } from "@/stores/fullscreen";
import { TrialLifecycleBanner } from "@/components/trial-lifecycle";
import { CommandPalette } from "@/components/layout/command-palette";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { IdleAutoLock } from "@/components/idle-auto-lock";
import { ApprovalDialog } from "@/components/ai/approval-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAutoCloudBackup } from "@/hooks/use-auto-cloud-backup";
import { useDeviceCapabilities } from "@/hooks/use-form-factor";
import { useActiveBranch } from "@/stores/active-branch";

function sectionOf(pathname: string): string {
  const match = pathname.match(/^\/([^/]+)/);
  return match ? match[1] : "";
}

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const openCmd = useCallback(() => setCmdOpen(true), []);
  const location = useLocation();
  const { formFactor, prefersReducedMotion } = useDeviceCapabilities();
  const branchRevision = useActiveBranch((state) => state.revision);
  const branchScope = useActiveBranch((state) => state.scope);
  const activeBranchId = useActiveBranch((state) => state.active?.id ?? "unassigned");
  const desktop = formFactor === "desktop";
  const previousSection = useRef(sectionOf(location.pathname));
  const stableSectionKey = useRef(previousSection.current);
  const [routeKey, setRouteKey] = useState(location.pathname);
  const [transitionClass, setTransitionClass] = useState(
    prefersReducedMotion ? "" : "animate-in fade-in-0 duration-150",
  );
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isFullscreen =
    location.pathname === "/pos/sale" ||
    location.pathname.startsWith("/pos/sale/") ||
    location.pathname.startsWith("/customer-display");
  const windowFullscreen = useFullscreenStore((state) => state.isFullscreen);
  const chromeHidden = isFullscreen || windowFullscreen;
  const showApplicationNavigation = !isSettingsRoute && !isFullscreen;

  useAutoCloudBackup();

  useEffect(() => {
    setMobileNavigationOpen(false);
    const nextSection = sectionOf(location.pathname);
    const isIntraSection = nextSection === previousSection.current;

    if (isIntraSection) {
      setRouteKey(stableSectionKey.current);
      setTransitionClass("");
    } else {
      setRouteKey(location.pathname);
      stableSectionKey.current = location.pathname;
      setTransitionClass(
        prefersReducedMotion ? "" : "animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
      );
    }
    previousSection.current = nextSection;
  }, [location.pathname, prefersReducedMotion]);

  useEffect(() => {
    if (desktop) setMobileNavigationOpen(false);
  }, [desktop]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <WindowTitlebar hidden={chromeHidden} />
      <div
        className="flex flex-1 overflow-hidden"
        style={{ marginTop: chromeHidden ? 0 : TITLEBAR_HEIGHT_PX }}
      >
        {showApplicationNavigation && desktop ? <Sidebar onCommandOpen={openCmd} /> : null}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isFullscreen ? <TrialLifecycleBanner /> : null}
          {!isFullscreen ? (
            <Topbar
              onNavigationOpen={showApplicationNavigation && !desktop ? () => setMobileNavigationOpen(true) : undefined}
            />
          ) : null}
          <main
            className={cn(
              "min-h-0 flex-1 bg-background",
              isSettingsRoute ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden",
            )}
          >
            <div
              key={`${routeKey}:${branchScope}:${activeBranchId}:${branchRevision}`}
              className={cn(
                isFullscreen
                  ? ""
                  : isSettingsRoute
                    ? "h-full min-h-0"
                    : "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
                !isSettingsRoute && transitionClass,
              )}
            >
              <RouteErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </RouteErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <SheetContent
          side="left"
          className="!inset-y-0 !top-0 w-[min(20rem,calc(100vw-2rem))] max-w-none rounded-none p-0 motion-reduce:transition-none [&>div]:px-0"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Application navigation</SheetTitle>
          <Sidebar
            mobile
            onCommandOpen={() => {
              setMobileNavigationOpen(false);
              openCmd();
            }}
            onNavigate={() => setMobileNavigationOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <OnboardingTour />
      <ShortcutsOverlay />
      <IdleAutoLock />
      <ApprovalDialog />
    </div>
  );
}
