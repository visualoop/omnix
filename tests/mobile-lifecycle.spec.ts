import { describe, expect, it, vi } from "vitest";
import { registerMobileLifecycle } from "@/mobile/lifecycle";
import type {
  AndroidBackRequest,
  AppLifecycleState,
  LifecycleAdapter,
  Unsubscribe,
} from "@/platform/adapters";

class FakeLifecycle implements LifecycleAdapter {
  stateListener: ((state: AppLifecycleState) => void) | null = null;
  backListener: ((request: AndroidBackRequest) => boolean | Promise<boolean>) | null = null;
  readonly unsubState = vi.fn();
  readonly unsubBack = vi.fn();

  async currentState(): Promise<AppLifecycleState> { return "active"; }
  async onStateChange(listener: (state: AppLifecycleState) => void): Promise<Unsubscribe> {
    this.stateListener = listener;
    return this.unsubState;
  }
  async onBackRequested(
    listener: (request: AndroidBackRequest) => boolean | Promise<boolean>,
  ): Promise<Unsubscribe> {
    this.backListener = listener;
    return this.unsubBack;
  }
}

describe("mobile lifecycle boundary", () => {
  it("navigates React history only when available and otherwise delegates to Android", async () => {
    const lifecycle = new FakeLifecycle();
    const navigateBack = vi.fn();
    const state = vi.fn();
    let canGoBack = true;
    const registration = await registerMobileLifecycle(lifecycle, {
      canNavigateBack: () => canGoBack,
      navigateBack,
      onStateChange: state,
    });

    expect(registration.initialState).toBe("active");
    expect(state).toHaveBeenCalledWith("active");
    await expect(lifecycle.backListener?.({ requestId: "one", canGoBack: true })).resolves.toBe(true);
    expect(navigateBack).toHaveBeenCalledOnce();

    canGoBack = false;
    await expect(lifecycle.backListener?.({ requestId: "two", canGoBack: false })).resolves.toBe(false);
    expect(navigateBack).toHaveBeenCalledOnce();

    lifecycle.stateListener?.("background");
    expect(state).toHaveBeenLastCalledWith("background");
    registration.dispose();
    registration.dispose();
    expect(lifecycle.unsubState).toHaveBeenCalledOnce();
    expect(lifecycle.unsubBack).toHaveBeenCalledOnce();
  });
});
