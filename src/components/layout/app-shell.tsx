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
import { useAutoCloudBackup } from "@/hooks/use-auto-cloud-backup";

/** Return the top-level route prefix, e.g. "/settings/license" → "settings". */
function sectionOf(pathname: string): string {
  const m = pathname.match(/^\/([^/]+)/);
  return m ? m[1] : "";
}

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const openCmd = useCallback(() => setCmdOpen(true), []);
  const location = useLocation();
  // routeKey is what we set on the <Outlet> wrapper to drive the
  // animate-in animation. Within a section (e.g. /settings/*), we keep the
  // SAME key + drop the slide so the inner content doesn't shake/scroll.
  const prevSection = useRef(sectionOf(location.pathname));
  const stableSectionKey = useRef(prevSection.current);
  const [routeKey, setRouteKey] = useState(location.pathname);
  const [transitionClass, setTransitionClass] = useState("animate-in fade-in-0 duration-150");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  // Fullscreen-canvas routes — POS sale interface, customer display.
  // Sidebar + topbar hide so cashier has the entire screen for selling.
  const isFullscreen =
    location.pathname === "/pos/sale" ||
    location.pathname.startsWith("/pos/sale/") ||
    location.pathname.startsWith("/customer-display");
  // Window (F11) fullscreen hides ONLY the titlebar strip — not the sidebar —
  // so the window fills the screen without the app reflowing.
  const windowFullscreen = useFullscreenStore((s) => s.isFullscreen);
  const chromeHidden = isFullscreen || windowFullscreen;

  useAutoCloudBackup();

  useEffect(() => {
    const nextSection = sectionOf(location.pathname);
    const isIntraSection = nextSection === prevSection.current;

    if (isIntraSection) {
      // Stay within the section: keep the section-stable key, no slide.
      // Outlet content updates in place; settings layout's own scroll persists.
      setRouteKey(stableSectionKey.current);
      setTransitionClass("");
    } else {
      // New section: re-key + animate.
      setRouteKey(location.pathname);
      stableSectionKey.current = location.pathname;
      setTransitionClass("animate-in fade-in-0 slide-in-from-bottom-1 duration-200");
    }
    prevSection.current = nextSection;
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <WindowTitlebar hidden={chromeHidden} />
      <div
        className="flex flex-1 overflow-hidden"
        style={{ marginTop: chromeHidden ? 0 : TITLEBAR_HEIGHT_PX }}
      >
        {!isSettingsRoute && !isFullscreen && <Sidebar onCommandOpen={openCmd} />}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!isFullscreen && <TrialLifecycleBanner />}
          {!isFullscreen && <Topbar />}
          <main className={isFullscreen ? "flex-1 overflow-y-auto overflow-x-hidden" : "flex-1 overflow-y-auto overflow-x-hidden bg-background"}>
            <div key={routeKey} className={cn(isFullscreen ? "" : "p-6", transitionClass)}>
              <RouteErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </RouteErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <OnboardingTour />
      <ShortcutsOverlay />
      <IdleAutoLock />
      <ApprovalDialog />
    </div>
  );
}
