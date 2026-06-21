import { useState, useEffect } from "react";
import {
  Calendar,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { getExpiringItems, type ExpiryItem } from "@/services/pharmacy";
import { Badge } from "@/components/ui/badge";

export function ExpiryPage() {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [window, setWindow] = useState(90);

  useEffect(() => {
    getExpiringItems(window).then(setItems);
  }, [window]);

  const expired = items.filter((i) => i.days_to_expiry < 0);
  const critical = items.filter((i) => i.days_to_expiry >= 0 && i.days_to_expiry <= 30);
  const warning = items.filter((i) => i.days_to_expiry > 30 && i.days_to_expiry <= 90);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Expiry Alerts</h1>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setWindow(d)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                window === d ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Expired" value={expired.length} variant="destructive" />
        <Stat label="< 30 days" value={critical.length} variant="warning" />
        <Stat label="30-90 days" value={warning.length} variant="default" />
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No items expiring within {window} days</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">Product</th>
                <th className="text-left px-4 py-2.5 font-medium">Batch</th>
                <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                <th className="text-left px-4 py-2.5 font-medium">Expiry Date</th>
                <th className="text-right px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.batch_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.product_name}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{item.batch_number}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.expiry_date}</td>
                  <td className="px-4 py-2.5 text-right">
                    {item.days_to_expiry < 0 ? (
                      <Badge variant="destructive" className="text-xs">Expired {Math.abs(item.days_to_expiry)}d ago</Badge>
                    ) : item.days_to_expiry <= 30 ? (
                      <Badge variant="destructive" className="text-xs">{item.days_to_expiry}d</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{item.days_to_expiry}d</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant: "default" | "warning" | "destructive" }) {
  const styles = {
    default: "border-border",
    warning: "border-amber-500/50 bg-amber-500/5",
    destructive: "border-destructive/50 bg-destructive/5",
  };
  return (
    <div className={`border rounded-lg p-4 ${styles[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {variant !== "default" && <AlertTriangle className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-semibold mt-2 font-mono">{value}</p>
    </div>
  );
}
