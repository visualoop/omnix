import { useEffect, useState } from "react";
import { Pause, RotateCcw, Trash2, X } from "lucide-react";
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

export function HeldSalesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    if (cart.items.length > 0 && !confirm("Recall will replace current cart. Continue?")) return;
    const result = await recallHeldSale(id);
    if (!result) return;
    cart.loadSnapshot(result.snapshot.items, result.snapshot.discount, result.customer_id);
    toast.success("Sale recalled");
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this parked sale?")) return;
    await deleteHeldSale(id);
    load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
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
              <div className="flex gap-2">
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
                          {new Date(h.created_at).toLocaleString("en-KE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
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
