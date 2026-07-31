import {
  CloudCheck,
  CloudSlash,
  LockKey,
  PlugsConnected,
  WifiSlash,
} from "@phosphor-icons/react";
import type { WebRuntimeState } from "@/web/contracts";
import { cn } from "@/lib/utils";

interface WebStatusBannerProps {
  readonly state: WebRuntimeState;
  readonly onRetry?: () => void;
}

export function WebStatusBanner({ state, onRetry }: WebStatusBannerProps) {
  if (state.kind === "connected") {
    return (
      <div className="flex min-h-10 items-center gap-2 border-b border-border bg-background px-4 text-xs text-muted-foreground" role="status">
        <CloudCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span><span className="font-medium text-foreground">Live on branch LAN</span> · {state.hubName}</span>
        <span className="ml-auto hidden font-mono tabular-nums sm:inline">Updated {state.lastUpdatedAt}</span>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-10 items-center gap-2 border-b border-border bg-muted/30 px-4 text-xs text-muted-foreground" role="status" aria-live="polite">
        <PlugsConnected className="size-4" aria-hidden="true" />
        Connecting to the branch hub…
      </div>
    );
  }

  const expired = state.kind === "session-expired";
  const forbidden = state.kind === "forbidden";
  const unreachable = state.kind === "lan-unreachable";
  const Icon = expired || forbidden ? LockKey : unreachable ? WifiSlash : CloudSlash;
  const title = expired ? "Session expired" : forbidden ? "Access denied" : unreachable ? "Branch hub is out of reach" : "This device is offline";
  const detail = expired
    ? "Ask a desktop administrator to issue a new read-only browser session. Cached business data is no longer shown."
    : forbidden
      ? "This session cannot view the requested branch or report. Cached business data is not shown."
      : unreachable
        ? `Join the same LAN as ${state.hubName}. The last safe snapshot remains visible.`
        : "Reconnect to the branch LAN to refresh. The last safe snapshot remains visible.";

  return (
    <div
      className={cn(
        "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-xs",
        expired
          ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100",
      )}
      role="alert"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{title}.</span> {detail}
      </div>
      {!expired && !forbidden && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md border border-current px-3 font-semibold outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
