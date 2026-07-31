import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import type { FormFactor } from "@/hooks/use-form-factor";

const shellState = vi.hoisted(() => ({
  formFactor: "desktop" as FormFactor,
  prefersReducedMotion: false,
}));

vi.mock("@/hooks/use-form-factor", () => ({
  useDeviceCapabilities: () => ({
    formFactor: shellState.formFactor,
    viewportWidth: shellState.formFactor === "phone" ? 390 : shellState.formFactor === "tablet" ? 800 : 1280,
    viewportHeight: 800,
    hasTouch: shellState.formFactor !== "desktop",
    hasHover: shellState.formFactor === "desktop",
    hasFinePointer: shellState.formFactor === "desktop",
    prefersReducedMotion: shellState.prefersReducedMotion,
  }),
}));

vi.mock("@/components/layout/window-titlebar", () => ({
  TITLEBAR_HEIGHT_PX: 32,
  WindowTitlebar: () => <div data-testid="window-titlebar" />,
}));

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) => (
    <aside data-testid={mobile ? "mobile-sidebar" : "desktop-sidebar"}>
      {mobile ? <button onClick={onNavigate}>Choose destination</button> : null}
    </aside>
  ),
}));

vi.mock("@/components/layout/topbar", () => ({
  Topbar: ({ onNavigationOpen }: { onNavigationOpen?: () => void }) => (
    <header data-testid="topbar">
      {onNavigationOpen ? <button onClick={onNavigationOpen}>Open navigation</button> : null}
    </header>
  ),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? <div data-testid="navigation-drawer">{children}</div> : null,
  SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/stores/fullscreen", () => ({
  useFullscreenStore: (selector: (state: { isFullscreen: boolean }) => unknown) =>
    selector({ isFullscreen: false }),
}));

vi.mock("@/components/trial-lifecycle", () => ({ TrialLifecycleBanner: () => null }));
vi.mock("@/components/layout/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/route-error-boundary", () => ({
  RouteErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/onboarding-tour", () => ({ OnboardingTour: () => null }));
vi.mock("@/components/shortcuts-overlay", () => ({ ShortcutsOverlay: () => null }));
vi.mock("@/components/idle-auto-lock", () => ({ IdleAutoLock: () => null }));
vi.mock("@/components/ai/approval-dialog", () => ({ ApprovalDialog: () => null }));
vi.mock("@/hooks/use-auto-cloud-backup", () => ({ useAutoCloudBackup: () => undefined }));

import { AppShell } from "@/components/layout/app-shell";

function renderShell(formFactor: FormFactor, prefersReducedMotion = false) {
  shellState.formFactor = formFactor;
  shellState.prefersReducedMotion = prefersReducedMotion;
  return render(
    <MemoryRouter initialEntries={["/sales"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="*"
            element={
              <div data-testid="route-content">
                Sales
                <Link to="/inventory">Inventory route</Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("AppShell responsive navigation", () => {
  it.each(["phone", "tablet"] as const)(
    "uses a closable navigation drawer on %s",
    (formFactor) => {
      renderShell(formFactor);

      expect(screen.queryByTestId("desktop-sidebar")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
      expect(screen.getByTestId("mobile-sidebar")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Choose destination" }));
      expect(screen.queryByTestId("navigation-drawer")).toBeNull();
    },
  );

  it("keeps navigation inline on desktop", () => {
    renderShell("desktop");

    expect(screen.getByTestId("desktop-sidebar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();
    expect(screen.queryByTestId("navigation-drawer")).toBeNull();
  });

  it("removes route movement when reduced motion is requested", () => {
    renderShell("tablet", true);
    fireEvent.click(screen.getByRole("link", { name: "Inventory route" }));

    const routeFrame = screen.getByTestId("route-content").parentElement;
    expect(routeFrame?.className).not.toContain("animate-in");
    expect(routeFrame?.className).not.toContain("slide-in-from-bottom");
  });

  it("retains the short route transition when motion is allowed", () => {
    renderShell("desktop");
    fireEvent.click(screen.getByRole("link", { name: "Inventory route" }));

    expect(screen.getByTestId("route-content").parentElement?.className).toContain("animate-in");
    expect(screen.getByTestId("route-content").parentElement?.className).toContain("slide-in-from-bottom");
  });
});
