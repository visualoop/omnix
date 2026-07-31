import { useMemo, useSyncExternalStore } from "react";

export type FormFactor = "phone" | "tablet" | "desktop";

export interface DeviceCapabilities {
  formFactor: FormFactor;
  viewportWidth: number;
  viewportHeight: number;
  hasTouch: boolean;
  hasHover: boolean;
  hasFinePointer: boolean;
  prefersReducedMotion: boolean;
}

export const PHONE_MAX_WIDTH = 639;
export const TABLET_MAX_WIDTH = 1023;

export function classifyFormFactor(viewportWidth: number): FormFactor {
  if (viewportWidth <= PHONE_MAX_WIDTH) return "phone";
  if (viewportWidth <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

function subscribeToViewport(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("resize", onStoreChange, { passive: true });
  window.addEventListener("orientationchange", onStoreChange, { passive: true });
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 1280 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 800 : window.innerHeight;
}

function mediaQuerySnapshot(query: string, fallback = false): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;
  return window.matchMedia(query).matches;
}

function subscribeToMediaQuery(query: string, onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mediaQuery = window.matchMedia(query);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  }
  mediaQuery.addListener(onStoreChange);
  return () => mediaQuery.removeListener(onStoreChange);
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToMediaQuery(query, onStoreChange),
    () => mediaQuerySnapshot(query),
    () => false,
  );
}

export function useFormFactor(): FormFactor {
  const viewportWidth = useSyncExternalStore(
    subscribeToViewport,
    getViewportWidth,
    () => 1280,
  );
  return classifyFormFactor(viewportWidth);
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const viewportWidth = useSyncExternalStore(subscribeToViewport, getViewportWidth, () => 1280);
  const viewportHeight = useSyncExternalStore(subscribeToViewport, getViewportHeight, () => 800);
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const hasHover = useMediaQuery("(hover: hover)");
  const hasFinePointer = useMediaQuery("(pointer: fine)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const maxTouchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints;

  return useMemo(
    () => ({
      formFactor: classifyFormFactor(viewportWidth),
      viewportWidth,
      viewportHeight,
      hasTouch: coarsePointer || maxTouchPoints > 0,
      hasHover,
      hasFinePointer,
      prefersReducedMotion,
    }),
    [coarsePointer, hasFinePointer, hasHover, maxTouchPoints, prefersReducedMotion, viewportHeight, viewportWidth],
  );
}
