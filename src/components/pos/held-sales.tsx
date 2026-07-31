import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  ArrowCounterClockwise as RotateCcw,
  Pause,
  Trash as Trash2,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import {
  holdCurrentSale,
  listHeldSales,
  recallHeldSale,
  deleteHeldSale,
  type HeldSale,
} from "@/services/held-sales";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { cn } from "@/lib/utils";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

export function HeldSalesDialog({ open, onClose, formFactor = "desktop" }: { open: boolean; onClose: () => void; formFactor?: PosFormFactor }) {
  const [held, setHeld] = useState<HeldSale[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cart = useCartStore();
  const userId = useAuthStore((s) => s.user?.id);

  const load = async () => setHeld(await listHeldSales());
  useEffect(() => { if (open) load(); }, [open]);

  const handlePark = async () => {
    if (!userId || cart.items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setBusy(true);
    try {
      await holdCurrentSale({
        items: cart.items,
        discount: cart.discount,
        customer_id: cart.customerId,
        user_id: userId,
        note: note.trim() || undefined,
      });
      cart.clear();
      toast.success("Sale parked");
      setNote("");
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRecall = async (id: string) => {
    if (cart.items.length > 0 && !(await confirm({ title: "Recall will replace current cart. Continue?" }))) return;
    const result = await recallHeldSale(id);
    if (!result) return;
    cart.loadSnapshot(result.snapshot.items, result.snapshot.discount, result.customer_id);
    toast.success("Sale recalled");
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: "Delete this parked sale?" }))) return;
    await deleteHeldSale(id);
    load();
  };

  if (!open) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex bg-black/50",
      formFactor === "desktop" ? "items-center justify-center p-4" : "items-stretch justify-stretch p-0",
    )}>
      <div className={cn(
        "flex w-full flex-col border border-border bg-background",
        formFactor === "desktop"
          ? "max-h-[85vh] max-w-2xl rounded-lg"
          : "h-[100dvh] max-h-none max-w-none rounded-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] [&_button]:min-h-11 [&_input]:min-h-11 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring",
      )}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Pause className="h-4 w-4 text-primary" /> Parked Sales
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-auto">
          {cart.items.length > 0 && (
            <div className="border-b border-border bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium">Park current cart ({cart.items.length} items)</p>
              <div className={cn("flex gap-2", formFactor !== "desktop" && "flex-col")}>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (e.g., 'Mama Wanjiru, picking up later')"
                  className="flex-1"
                />
                <Button onClick={handlePark} disabled={busy}>
                  <Pause className="h-3.5 w-3.5 mr-1.5" /> Park
                </Button>
              </div>
            </div>
          )}

          {held.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Pause className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No parked sales</p>
              <p className="text-xs mt-1">Park a sale to come back later</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {held.map((h) => {
                const snapshot = JSON.parse(h.cart_json) as { items: Array<{ name: string; quantity: number; total: number }>; discount: number };
                const total = snapshot.items.reduce((s, i) => s + i.total, 0) - snapshot.discount;
                return (
                  <div key={h.id} className="px-4 py-3 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{h.customer_name || "Walk-in"}</span>
                          <span className="text-xs text-muted-foreground">
                            · {snapshot.items.length} items · KES {total.toFixed(0)}
                          </span>
                        </div>
                        {h.note && <p className="text-xs text-muted-foreground mt-1 italic">"{h.note}"</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(h.created_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className={cn("flex gap-1", formFactor !== "desktop" ? "shrink-0 flex-col" : "shrink-0")}>
                        <Button size="sm" onClick={() => handleRecall(h.id)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Recall
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(h.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
