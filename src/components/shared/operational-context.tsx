import { useEffect, useState } from "react";
import { CloudSlash, MapPin } from "@phosphor-icons/react";
import { useActiveBranch } from "@/stores/active-branch";
import { cn } from "@/lib/utils";

export function OperationalContext({ className, compact = false }: { className?: string; compact?: boolean }) {
  const branch = useActiveBranch((state) => state.active);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-y border-border/70 py-2 text-[11px] text-muted-foreground", compact ? "mb-3" : "mb-4", className)}>
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{branch?.name ?? "Current branch"}</span>
        {branch?.code ? <span className="font-mono">{branch.code}</span> : null}
      </span>
      <span aria-label={online ? "Offline-ready local workspace" : "Internet offline; local work continues"} className="inline-flex items-center gap-1.5">
        <CloudSlash className="h-3.5 w-3.5" />
        {online ? "Offline-ready · saved locally" : "Internet offline · local work continues"}
      </span>
    </div>
  );
}
