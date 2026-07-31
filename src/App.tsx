import { lazy, Suspense } from "react";
import { readRuntimeSignals, resolveRuntimeCapabilities } from "@/platform/runtime";

const DesktopApp = lazy(() => import("@/DesktopApp"));
const AndroidApp = lazy(() =>
  import("@/mobile/AndroidApp").then(({ AndroidApp: Root }) => ({ default: Root })),
);
const WebCompanionRoot = lazy(() =>
  import("@/web/WebCompanionRoot").then(({ WebCompanionRoot: Root }) => ({ default: Root })),
);

function RootLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Opening Omnix…
      </p>
    </main>
  );
}

/**
 * Runtime dispatch happens before licence, desktop window, SQL, or background
 * job modules are imported. `/web` therefore remains a reporting-only graph,
 * while Android receives its own authenticated touch shell.
 */
function App() {
  const runtime = resolveRuntimeCapabilities(readRuntimeSignals());
  const isWebCompanionPath = window.location.pathname === "/web" ||
    window.location.pathname.startsWith("/web/");

  let root = <DesktopApp />;
  if (runtime.target === "android") root = <AndroidApp runtime={runtime} />;
  else if (runtime.target === "web" && isWebCompanionPath) root = <WebCompanionRoot />;

  return <Suspense fallback={<RootLoading />}>{root}</Suspense>;
}

export default App;
