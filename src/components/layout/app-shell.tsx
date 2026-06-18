import { useState, useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { IdleAutoLock } from "@/components/idle-auto-lock";
import { useAutoCloudBackup } from "@/hooks/use-auto-cloud-backup";
import { AiAssistantPanel } from "@/components/ai/AiAssistantPanel";

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {!isSettingsRoute && !isFullscreen && <Sidebar onCommandOpen={openCmd} />}
      <div className="flex flex-col flex-1 overflow-hidden">
        {!isFullscreen && <Topbar />}
        <main className={isFullscreen ? "flex-1 overflow-auto" : "flex-1 overflow-auto p-6"}>
          <div key={routeKey} className={transitionClass}>
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <OnboardingTour />
      <ShortcutsOverlay />
      <IdleAutoLock />
      <AiAssistantPanel />
    </div>
  );
}
