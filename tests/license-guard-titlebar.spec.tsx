import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getLicenseStatus } = vi.hoisted(() => ({
  getLicenseStatus: vi.fn(),
}));

vi.mock("@/services/license", () => ({
  getLicenseStatus,
  revalidateLicense: vi.fn(),
}));

vi.mock("@/stores/entitlements", () => ({
  useEntitlements: {
    getState: () => ({ setModules: vi.fn() }),
  },
}));

vi.mock("@/components/layout/window-titlebar", () => ({
  TITLEBAR_HEIGHT_PX: 32,
  WindowTitlebar: () => <header data-tauri-drag-region data-testid="window-titlebar" />,
}));

vi.mock("@/pages/license-activation", () => ({
  LicenseActivationPage: () => <main>Enter licence key</main>,
}));

import { LicenseGuard } from "@/components/license-guard";

function renderGuard(children: ReactNode = <div>Application</div>) {
  return render(<LicenseGuard>{children}</LicenseGuard>);
}

beforeEach(() => {
  vi.stubEnv("VITE_SKIP_LICENSE", "0");
});

afterEach(() => {
  cleanup();
  getLicenseStatus.mockReset();
  vi.unstubAllEnvs();
});

describe("LicenseGuard window chrome", () => {
  it("renders a drag region during the initial licence check with a matching content offset", () => {
    getLicenseStatus.mockReturnValue(new Promise(() => {}));
    const { container } = renderGuard();
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
    const content = container.querySelector<HTMLElement>("[data-pre-shell-content]");
    expect(content?.style.marginTop).toBe("32px");
    expect(content?.style.height).toBe("calc(100dvh - 32px)");
  });

  it("renders a drag region on the licence activation screen", async () => {
    getLicenseStatus.mockResolvedValue({
      activated: false,
      modules: [],
    });
    const { container } = renderGuard();

    await screen.findByText("Enter licence key");
    await waitFor(() => {
      expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
    });
  });
});
