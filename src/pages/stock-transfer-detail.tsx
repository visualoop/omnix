import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowsLeftRight as ArrowRightLeft,
  Check,
  CircleNotch as Loader2,
  Truck,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getTransfer, dispatchTransfer, receiveTransfer, cancelTransfer,
  type StockTransferWithDetails, type StockTransferItem, type StockTransfer,
} from "@/services/stock-transfers";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

interface TransferData {
  transfer: StockTransferWithDetails;
  items: StockTransferItem[];
}

export function StockTransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<TransferData | null>(null);
  const [working, setWorking] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  const load = async () => {
    if (!id) return;
    const result = await getTransfer(id) as TransferData | null;
    setData(result);
    if (result) {
      const qtys: Record<string, number> = {};
      result.items.forEach((it) => { qtys[it.id] = it.quantity_sent; });
      setReceivedQtys(qtys);
    }
  };
  useEffect(() => { load(); }, [id]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const { transfer, items } = data;
  const totalSent = items.reduce((s, i) => s + i.quantity_sent, 0);
  const totalReceived = items.reduce((s, i) => s + i.quantity_received, 0);
  const totalCost = items.reduce((s, i) => s + (i.unit_cost || 0) * i.quantity_sent, 0);

  const dispatch = async () => {
    if (!(await confirm({ title: "Dispatch this transfer? Stock will be decremented from source branch." }))) return;
    setWorking(true);
    try { await dispatchTransfer(transfer.id); toast.success("Dispatched"); load(); }
    catch (e) { toast.error(String(e)); }
    finally { setWorking(false); }
  };

  const receive = async () => {
    if (!userId) return;
    setWorking(true);
    try {
      await receiveTransfer(transfer.id, userId, items.map((it) => ({
        id: it.id,
        quantity_received: receivedQtys[it.id] ?? it.quantity_sent,
      })));
      toast.success("Received - stock added to destination");
      load();
    } catch (e) { toast.error(String(e)); }
    finally { setWorking(false); }
  };

  const cancel = async () => {
    if (!(await confirm({ title: "Cancel this draft transfer?" }))) return;
    setWorking(true);
    try { await cancelTransfer(transfer.id); toast.success("Cancelled"); load(); }
    catch (e) { toast.error(String(e)); }
    finally { setWorking(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/stock-transfers")} className="mb-2 -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Transfers
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> {transfer.transfer_number}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Created {new Date(transfer.created_at).toLocaleString(intlLocale())} by {transfer.user_name}
            </p>
          </div>
          <StatusBadge status={transfer.status} />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">From</div>
              <div className="font-medium text-amber-700">{transfer.from_branch_name}</div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">To</div>
              <div className="font-medium text-emerald-700">{transfer.to_branch_name}</div>
            </div>
          </div>
          {transfer.notes && (
            <div className="mt-3 pt-3 border-t border-border text-xs">
              <span className="text-muted-foreground">Notes: </span>{transfer.notes}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty Sent</th>
              {transfer.status === "in_transit" ? (
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty to Receive</th>
              ) : (
                <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty Received</th>
              )}
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Cost</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-border/60">
                <td className="px-3 py-2 text-xs">{it.product_name}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums font-mono">{it.quantity_sent}</td>
                <td className="px-3 py-2 text-right">
                  {transfer.status === "in_transit" ? (
                    <Input
                      type="number"
                      value={receivedQtys[it.id] ?? 0}
                      onChange={(e) => setReceivedQtys({ ...receivedQtys, [it.id]: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-24 text-right tabular-nums ml-auto"
                    />
                  ) : (
                    <span className="text-xs tabular-nums font-mono">{it.quantity_received}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums font-mono text-muted-foreground">
                  {(it.unit_cost || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums font-mono">
                  {((it.unit_cost || 0) * it.quantity_sent).toFixed(2)}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-semibold">
              <td className="px-3 py-2 text-xs">Total</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums font-mono">{totalSent}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums font-mono">
                {transfer.status === "in_transit"
                  ? Object.values(receivedQtys).reduce((s, n) => s + n, 0)
                  : totalReceived}
              </td>
              <td></td>
              <td className="px-3 py-2 text-right text-xs tabular-nums font-mono">KES {totalCost.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        {transfer.status === "draft" && (
          <>
            <Button variant="ghost" onClick={cancel} disabled={working}>
              <X className="h-4 w-4 mr-1.5" /> Cancel Transfer
            </Button>
            <Button onClick={dispatch} disabled={working}>
              {working && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              <Truck className="h-4 w-4 mr-1.5" /> Dispatch
            </Button>
          </>
        )}
        {transfer.status === "in_transit" && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                const qtys: Record<string, number> = {};
                items.forEach((it) => { qtys[it.id] = it.quantity_sent; });
                setReceivedQtys(qtys);
              }}
            >
              Receive All
            </Button>
            <Button onClick={receive} disabled={working}>
              {working && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              <Check className="h-4 w-4 mr-1.5" /> Confirm Receipt
            </Button>
          </>
        )}
      </div>

      {transfer.status === "received" && transfer.received_by_name && (
        <div className="text-xs text-muted-foreground text-center">
          Received {transfer.received_date ? new Date(transfer.received_date).toLocaleString(intlLocale()) : ""} by {transfer.received_by_name}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StockTransfer["status"] }) {
  switch (status) {
    case "draft": return <Badge variant="outline">Draft</Badge>;
    case "in_transit": return <Badge className="bg-amber-500 hover:bg-amber-500"><Truck className="h-2.5 w-2.5 mr-0.5" /> In Transit</Badge>;
    case "received": return <Badge className="bg-emerald-600 hover:bg-emerald-600"><Check className="h-2.5 w-2.5 mr-0.5" /> Received</Badge>;
    case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
  }
}
