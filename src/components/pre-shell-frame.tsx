import type { ReactNode } from "react";
import {
  TITLEBAR_HEIGHT_PX,
  WindowTitlebar,
} from "@/components/layout/window-titlebar";

interface PreShellFrameProps {
  children: ReactNode;
  title?: string;
}

/**
 * Shared chrome for every desktop screen rendered before AppShell mounts.
 * Frameless Tauri windows must retain a drag region and window controls even
 * while licensing, database bootstrap, setup, or sign-in owns the viewport.
 */
export function PreShellFrame({ children, title }: PreShellFrameProps) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <WindowTitlebar title={title} />
      <div
        className="overflow-y-auto overflow-x-hidden"
        data-pre-shell-content
        style={{
          height: `calc(100dvh - ${TITLEBAR_HEIGHT_PX}px)`,
          marginTop: TITLEBAR_HEIGHT_PX,
        }}
      >
        {children}
      </div>
    </div>
  );
}
