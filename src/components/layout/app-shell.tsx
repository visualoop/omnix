import { useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { IdleAutoLock } from "@/components/idle-auto-lock";

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const openCmd = useCallback(() => setCmdOpen(true), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar onCommandOpen={openCmd} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <OnboardingTour />
      <ShortcutsOverlay />
      <IdleAutoLock />
    </div>
  );
}
