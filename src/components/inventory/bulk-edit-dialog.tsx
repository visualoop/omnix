import { useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { X, Loader2, Tag, Percent, FolderInput, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { execute } from "@/lib/db";
import { toast } from "sonner";

interface Props {
  open: boolean;
  selectedIds: string[];
  onClose: () => void;
  onComplete: () => void;
  categories: Array<{ id: string; name: string }>;
}

type Action = "markup" | "category" | "tax" | "active";

export function BulkEditDialog({ open, selectedIds, onClose, onComplete, categories }: Props) {
  const [action, setAction] = useState<Action>("markup");
  const [percent, setPercent] = useState("10");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [categoryId, setCategoryId] = useState("");
  const [taxRate, setTaxRate] = useState("16");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const apply = async () => {
    if (selectedIds.length === 0) return;
    if (!(await confirm({ title: `Apply changes to ${selectedIds.length} product(s)? This cannot be undone in bulk.` }))) return;

    setSubmitting(true);
    try {
      const ids = selectedIds.map((_, i) => `?${i + 2}`).join(",");

      switch (action) {
        case "markup": {
          const factor = direction === "up" ? 1 + (parseFloat(percent) / 100) : 1 - (parseFloat(percent) / 100);
          await execute(
            `UPDATE products SET selling_price = ROUND(selling_price * ?1, 2) WHERE id IN (${ids})`,
            [factor, ...selectedIds],
          );
          toast.success(`Updated prices on ${selectedIds.length} products`);
          break;
        }
        case "category": {
          if (!categoryId) {
            toast.error("Pick a category");
            return;
          }
          await execute(
            `UPDATE products SET category_id = ?1 WHERE id IN (${ids})`,
            [categoryId, ...selectedIds],
          );
          toast.success(`Moved ${selectedIds.length} products`);
          break;
        }
        case "tax": {
          await execute(
            `UPDATE products SET tax_rate = ?1 WHERE id IN (${ids})`,
            [parseFloat(taxRate), ...selectedIds],
          );
          toast.success(`Tax rate set on ${selectedIds.length} products`);
          break;
        }
        case "active": {
          await execute(
            `UPDATE products SET active = ?1 WHERE id IN (${ids})`,
            [active ? 1 : 0, ...selectedIds],
          );
          toast.success(`${active ? "Activated" : "Deactivated"} ${selectedIds.length} products`);
          break;
        }
      }
      onComplete();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: Array<{ value: Action; label: string; icon: any }> = [
    { value: "markup", label: "Adjust Price", icon: Percent },
    { value: "category", label: "Change Category", icon: FolderInput },
    { value: "tax", label: "Tax Rate", icon: Tag },
    { value: "active", label: "Activate/Deactivate", icon: Power },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="font-semibold">Bulk Edit Products</h2>
            <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Action tabs */}
          <div className="grid grid-cols-2 gap-2">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setAction(t.value)}
                className={`px-3 py-2 rounded-md border text-xs flex items-center gap-1.5 ${
                  action === t.value ? "border-primary bg-primary/5 font-medium" : "border-border"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Action body */}
          {action === "markup" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDirection("up")}
                  className={`px-3 py-2 rounded-md border text-sm ${direction === "up" ? "border-primary bg-primary/5 font-medium" : "border-border"}`}
                >
                  Increase ↑
                </button>
                <button
                  onClick={() => setDirection("down")}
                  className={`px-3 py-2 rounded-md border text-sm ${direction === "down" ? "border-primary bg-primary/5 font-medium" : "border-border"}`}
                >
                  Decrease ↓
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">By percent</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className="text-lg font-mono pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                Example: A KES 100 product becomes
                {" "}KES {(100 * (direction === "up" ? 1 + parseFloat(percent || "0") / 100 : 1 - parseFloat(percent || "0") / 100)).toFixed(2)}
              </div>
            </div>
          )}

          {action === "category" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">New category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Pick a category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {action === "tax" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tax rate (%)</label>
              <Input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="text-lg font-mono"
              />
              <div className="flex gap-1.5">
                {["0", "8", "16"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTaxRate(r)}
                    className="flex-1 px-2 py-1.5 rounded-md border border-border text-xs hover:bg-accent/50"
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {action === "active" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActive(true)}
                  className={`px-3 py-3 rounded-md border text-sm ${active ? "border-primary bg-primary/5 font-medium" : "border-border"}`}
                >
                  Activate
                </button>
                <button
                  onClick={() => setActive(false)}
                  className={`px-3 py-3 rounded-md border text-sm ${!active ? "border-primary bg-primary/5 font-medium" : "border-border"}`}
                >
                  Deactivate
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={apply} className="flex-1" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply to {selectedIds.length}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
