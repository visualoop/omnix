import { create } from "zustand";

/**
 * Window-fullscreen state (F11), shared so chrome-bearing shells can hide the
 * custom titlebar + drop its top offset. Written by useF11Fullscreen (called
 * once per window) and read by AppShell / login / setup shells. Kept in a
 * store rather than passed as props because the titlebar lives in a route-
 * level layout the root App can't hand props to directly.
 */
interface FullscreenState {
  isFullscreen: boolean;
  setFullscreen: (v: boolean) => void;
}

export const useFullscreenStore = create<FullscreenState>((set) => ({
  isFullscreen: false,
  setFullscreen: (v) => set({ isFullscreen: v }),
}));
