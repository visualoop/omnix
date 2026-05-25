import { useEffect, useState } from "react";
import { AlertTriangle, AlertOctagon, Info, X } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import {
  checkInteractions,
  getSeverityColor,
  type InteractionWarning,
} from "@/services/interactions";

/**
 * Watches the cart and surfaces drug-drug interaction warnings.
 * Shown as a sticky banner above the cart on the POS screen.
 */
export function InteractionAlerts() {
  const items = useCartStore((s) => s.items);
  const [warnings, setWarnings] = useState<InteractionWarning[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (items.length < 2) {
      setWarnings([]);
      return;
    }
    const productIds = items.map((it) => it.product_id);
    let cancelled = false;
    checkInteractions(productIds).then((result) => {
      if (!cancelled) setWarnings(result);
    });
    return () => { cancelled = true; };
  }, [items]);

  const visible = warnings.filter((w) => !dismissed.has(w.interaction.id));
  if (visible.length === 0) return null;

  const worst = visible[0];
  const colors = getSeverityColor(worst.interaction.severity);
  const Icon = worst.interaction.severity === "contraindicated" || worst.interaction.severity === "major"
    ? AlertOctagon
    : worst.interaction.severity === "moderate"
    ? AlertTriangle
    : Info;

  return (
    <div className={`border ${colors.border} ${colors.bg} rounded-lg p-3 mb-3 space-y-2`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-5 w-5 ${colors.text} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.badge}`}>
              {colors.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {visible.length} interaction{visible.length > 1 ? "s" : ""} detected
            </span>
          </div>
          <p className={`text-sm font-medium ${colors.text}`}>
            {worst.product_a.name} + {worst.product_b.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {worst.interaction.description}
          </p>
          {worst.interaction.management && (
            <p className="text-xs mt-1.5 italic text-muted-foreground">
              <strong>Action:</strong> {worst.interaction.management}
            </p>
          )}

          {visible.length > 1 && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer hover:underline text-muted-foreground">
                Show {visible.length - 1} more interaction{visible.length > 2 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {visible.slice(1).map((w) => {
                  const c = getSeverityColor(w.interaction.severity);
                  return (
                    <div key={w.interaction.id} className="border-l-2 border-muted pl-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.badge}`}>
                          {c.label}
                        </span>
                        <span className="text-xs font-medium">
                          {w.product_a.name} + {w.product_b.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {w.interaction.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
        <button
          onClick={() => setDismissed(new Set([...dismissed, worst.interaction.id]))}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
