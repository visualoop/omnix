import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowCounterClockwise as RotateCcw, Warning, House } from "@phosphor-icons/react";

interface State {
  error: Error | null;
  info: React.ErrorInfo | null;
  /** Errors caught outside the React render path (window.onerror,
   *  unhandledrejection) live here. They have no component stack. */
  globalError: { message: string; stack?: string; source: 'window' | 'promise' } | null;
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
 *
 * Global capture: React's error boundary ONLY catches render-time throws.
 * It misses everything thrown inside an async handler, a setTimeout, a
 * Tauri plugin call's failure, or an unhandled promise rejection. We also
 * subscribe to `window.error` + `window.unhandledrejection` so those bugs
 * surface visibly here too — that's how we'll catch blank-screen issues
 * that aren't render errors (e.g. a click handler navigating to nowhere,
 * a Tauri plugin throwing inside an onClick).
 */
export class RouteErrorBoundary extends React.Component<
  { resetKey?: string; children: React.ReactNode },
  State
> {
  state: State = { error: null, info: null, globalError: null };
  private onWindowError = (e: ErrorEvent) => {
    if (this.state.error || this.state.globalError) return;
    this.setState({
      globalError: {
        message: e.message || String(e.error ?? 'Unknown error'),
        stack: (e.error as Error | undefined)?.stack,
        source: 'window',
      },
    });
  };
  private onUnhandledRejection = (e: PromiseRejectionEvent) => {
    if (this.state.error || this.state.globalError) return;
    const r = e.reason;
    this.setState({
      globalError: {
        message: r instanceof Error ? r.message : String(r ?? 'Unhandled promise rejection'),
        stack: r instanceof Error ? r.stack : undefined,
        source: 'promise',
      },
    });
  };

  componentDidMount() {
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }
  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the dev console for bug reports + future telemetry.
    console.error("RouteErrorBoundary caught:", error, info);
    this.setState({ error, info });
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && (this.state.error || this.state.globalError)) {
      this.setState({ error: null, info: null, globalError: null });
    }
  }

  render() {
    const { error, info, globalError } = this.state;
    if (!error && !globalError) return this.props.children;

    // Normalise to one shape for the error UI.
    const display = error
      ? { source: 'render' as const, message: error.message || String(error), stack: error.stack, info }
      : { source: globalError!.source, message: globalError!.message, stack: globalError!.stack, info: null };

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
          <Warning className="h-7 w-7 text-red-700" weight="bold" />
        </div>
        <h1 className="text-xl font-semibold">
          {display.source === 'render'
            ? 'Something crashed on this page.'
            : display.source === 'promise'
              ? 'An async operation failed.'
              : 'An unexpected error occurred.'}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Omnix caught the error before it could blank the whole app. The
          details below are exactly what to paste in a bug report.
          <span className="block mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
            Source: {display.source}
          </span>
        </p>

        <div className="mt-6 w-full max-w-2xl rounded-lg border border-border bg-muted/30 px-4 py-3 text-left">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Error</div>
          <div className="mt-1 text-sm font-mono break-all text-foreground">{display.message}</div>
          {display.info?.componentStack && (
            <details className="mt-3">
              <summary className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground cursor-pointer hover:text-foreground">
                Component stack
              </summary>
              <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto">
                {display.info.componentStack}
              </pre>
            </details>
          )}
          {display.stack && (
            <details className="mt-2">
              <summary className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground cursor-pointer hover:text-foreground">
                Stack trace
              </summary>
              <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-48 overflow-auto">
                {display.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={() => this.setState({ error: null, info: null, globalError: null })}>
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
