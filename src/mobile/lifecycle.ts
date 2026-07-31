import type {
  AppLifecycleState,
  LifecycleAdapter,
  Unsubscribe,
} from "@/platform/adapters";

export interface MobileLifecycleHandlers {
  readonly canNavigateBack: () => boolean;
  readonly navigateBack: () => void | Promise<void>;
  readonly onStateChange?: (state: AppLifecycleState) => void;
}

export interface MobileLifecycleRegistration {
  readonly initialState: AppLifecycleState;
  dispose(): void;
}

/**
 * Installs Android lifecycle/back listeners at the authenticated mobile shell.
 * Returning false from the back callback delegates to Android to background/exit;
 * a React route is never guessed from native device state.
 */
export async function registerMobileLifecycle(
  adapter: LifecycleAdapter,
  handlers: MobileLifecycleHandlers,
): Promise<MobileLifecycleRegistration> {
  const initialState = await adapter.currentState();
  handlers.onStateChange?.(initialState);

  const subscriptions: Unsubscribe[] = [];
  try {
    subscriptions.push(await adapter.onStateChange((state) => {
      handlers.onStateChange?.(state);
    }));
    subscriptions.push(await adapter.onBackRequested(async () => {
      if (!handlers.canNavigateBack()) return false;
      await handlers.navigateBack();
      return true;
    }));
  } catch (error) {
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    throw error;
  }

  let disposed = false;
  return {
    initialState,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    },
  };
}
