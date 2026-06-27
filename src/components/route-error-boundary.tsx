import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowCounterClockwise as RotateCcw, Warning, House } from "@phosphor-icons/react";

interface State {
  error: Error | null;
  info: React.ErrorInfo | null;
}

/**
 * Route-level error boundary.
 *
 * Wrap routed pages so a render-time exception shows a real error UI (with
 * the message + stack) instead of blanking the entire app. Without this,
 * one bad property access in a deep child unmounts everything above it and
 * the user sees a totally empty screen — making the bug both invisible and
 * unreportable.
 *
 * Reset key: the boundary clears its error state when its `resetKey` prop
 * changes (we pass the location pathname from App.tsx), so navigating away
 * recovers rather than sticking on the error page.
 */
export class RouteErrorBoundary extends React.Component<
  { resetKey?: string; children: React.ReactNode },
  State
> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the dev console for bug reports + future telemetry.
    console.error("RouteErrorBoundary caught:", error, info);
    this.setState({ error, info });
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
          <Warning className="h-7 w-7 text-red-700" weight="bold" />
        </div>
        <h1 className="text-xl font-semibold">Something crashed on this page.</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Omnix caught the error before it could blank the whole app. The
          details below are exactly what to paste in a bug report.
        </p>

        <div className="mt-6 w-full max-w-2xl rounded-lg border border-border bg-muted/30 px-4 py-3 text-left">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Error</div>
          <div className="mt-1 text-sm font-mono break-all text-foreground">{error.message || String(error)}</div>
          {info?.componentStack && (
            <details className="mt-3">
              <summary className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground cursor-pointer hover:text-foreground">
                Component stack
              </summary>
              <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto">
                {info.componentStack}
              </pre>
            </details>
          )}
          {error.stack && (
            <details className="mt-2">
              <summary className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground cursor-pointer hover:text-foreground">
                Stack trace
              </summary>
              <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={() => this.setState({ error: null, info: null })}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
          <Button onClick={() => { window.location.href = "/"; }}>
            <House className="h-3.5 w-3.5 mr-1.5" /> Back to dashboard
          </Button>
        </div>
      </div>
    );
  }
}
