import { create } from "zustand";

/**
 * Window-fullscreen (F11) state, shared so chrome-bearing shells can hide the
 * custom titlebar strip + zero its top offset when the OS window goes
 * fullscreen. Written by useF11Fullscreen (one per window), read by AppShell +
 * the display shells.
 *
 * Note: this hides ONLY the titlebar — NOT the sidebar/topbar — so F11 makes
 * the window fill the screen without the app reflowing (a previous attempt
 * that reused the route-immersive flag hid the sidebar and shifted content).
 */
interface FullscreenState {
  isFullscreen: boolean;
  setFullscreen: (v: boolean) => void;
}

export const useFullscreenStore = create<FullscreenState>((set) => ({
  isFullscreen: false,
  setFullscreen: (v) => set({ isFullscreen: v }),
}));
