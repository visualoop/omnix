import { useState, useEffect } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { useNavigate, useParams } from "react-router-dom";
import {
  ClipboardCheck, Plus, Search, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listStockTakes, createStockTake, getStockTakeItems, recordCount, completeStockTake,
  type StockTake, type StockTakeItem,
} from "@/services/erp";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

export function StockTakesPage() {
  const [takes, setTakes] = useState<StockTake[]>([]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  const load = async () => setTakes(await listStockTakes());
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      const id = await createStockTake(userId);
      toast.success("Stock take started");
      navigate(`/stock-take/${id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stock Take</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Physical inventory count and reconciliation
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          New Stock Take
        </Button>
      </div>

      <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 flex items-start gap-3">
        <ClipboardCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">How stock take works</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            1. Start a new stock take — system snapshots current expected quantities for all products.
            2. Walk through and physically count each item, enter the count.
            3. System computes variance (counted - expected) per item.
            4. Complete with "Apply Adjustments" to true up inventory, or just "Complete" to log without adjusting.
          </p>
        </div>
      </div>

      {takes.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No stock takes yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Reference</th>
                <th className="text-left px-3 py-2 font-medium">Started</th>
                <th className="text-left px-3 py-2 font-medium">By</th>
                <th className="text-right px-3 py-2 font-medium">Items</th>
                <th className="text-right px-3 py-2 font-medium">Qty Variance</th>
                <th className="text-right px-3 py-2 font-medium">Value Variance</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {takes.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/stock-take/${t.id}`)}>
                  <td className="px-3 py-2.5 font-mono text-xs">{t.reference}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {new Date(t.started_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5">{t.user_name || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{t.item_count}</td>
                  <td className={`px-3 py-2.5 text-right font-mono ${t.total_variance < 0 ? "text-red-700" : t.total_variance > 0 ? "text-green-700" : ""}`}>
                    {t.total_variance > 0 ? "+" : ""}{t.total_variance.toFixed(0)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${t.total_value_variance < 0 ? "text-red-700" : t.total_value_variance > 0 ? "text-green-700" : ""}`}>
                    {t.total_value_variance !== 0 && (t.total_value_variance > 0 ? "+" : "")}{t.total_value_variance.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {t.status === "completed" ? (
                      <Badge className="bg-green-600 hover:bg-green-600">Completed</Badge>
                    ) : t.status === "cancelled" ? (
                      <Badge variant="destructive">Cancelled</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-700">In Progress</Badge>
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

export function StockTakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [take, setTake] = useState<StockTake | null>(null);
  const [items, setItems] = useState<StockTakeItem[]>([]);
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState(false);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  const load = async () => {
    if (!id) return;
    const takes = await listStockTakes();
    const t = takes.find((x) => x.id === id);
    if (t) setTake(t);
    setItems(await getStockTakeItems(id, search));
  };

  useEffect(() => { load(); }, [id, search]);

  const updateCount = async (itemId: string, qty: number) => {
    await recordCount(itemId, qty);
    // Update locally for instant feedback
    setItems((curr) => curr.map((it) => {
      if (it.id !== itemId) return it;
      const variance = qty - it.expected_quantity;
      return {
        ...it,
        counted_quantity: qty,
        variance,
        value_variance: variance * (it.unit_cost || 0),
        counted_at: new Date().toISOString(),
      };
    }));
  };

  const handleComplete = async (applyAdjustments: boolean) => {
    if (!id || !userId) return;
    if (applyAdjustments && !(await confirm({ title: "Apply variances to inventory? This will create stock movements for all counted differences." }))) return;
    setCompleting(true);
    try {
      await completeStockTake(id, applyAdjustments, userId);
      toast.success(applyAdjustments ? "Inventory adjusted" : "Stock take completed");
      navigate("/stock-take");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCompleting(false);
    }
  };

  if (!take) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const counted = items.filter((it) => it.counted_quantity !== null);
  const uncounted = items.filter((it) => it.counted_quantity === null);
  const variances = counted.filter((it) => (it.variance || 0) !== 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/stock-take")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight font-mono">{take.reference}</h1>
            <p className="text-sm text-muted-foreground">
              Started {new Date(take.started_at).toLocaleString(intlLocale())} · {take.user_name}
            </p>
          </div>
        </div>
        {take.status === "in_progress" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleComplete(false)} disabled={completing}>
              <Save className="h-4 w-4 mr-2" /> Complete (no adjust)
            </Button>
            <Button onClick={() => handleComplete(true)} disabled={completing || variances.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Apply Adjustments ({variances.length})
            </Button>
          </div>
        )}
      </div>

      {take.status === "completed" && (
        <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-3 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Completed {take.completed_at && new Date(take.completed_at).toLocaleString(intlLocale())}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total variance: {take.total_variance > 0 ? "+" : ""}{take.total_variance.toFixed(0)} units · Value: KES {take.total_value_variance.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <SmallStat label="Total" value={items.length} />
        <SmallStat label="Counted" value={counted.length} color="green" />
        <SmallStat label="Uncounted" value={uncounted.length} color={uncounted.length > 0 ? "amber" : "default"} />
        <SmallStat label="Variances" value={variances.length} color={variances.length > 0 ? "red" : "default"} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Product</th>
              <th className="text-right px-3 py-2 font-medium">Expected</th>
              <th className="text-center px-3 py-2 font-medium w-32">Counted</th>
              <th className="text-right px-3 py-2 font-medium">Variance</th>
              <th className="text-right px-3 py-2 font-medium">Value Diff</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={`border-b border-border last:border-0 ${
                item.counted_quantity === null ? "" : (item.variance || 0) !== 0 ? "bg-red-500/5" : "bg-green-500/5"
              }`}>
                <td className="px-3 py-2">
                  <div>{item.product_name}</div>
                  {item.product_sku && <div className="text-xs font-mono text-muted-foreground">{item.product_sku}</div>}
                </td>
                <td className="px-3 py-2 text-right font-mono">{item.expected_quantity}</td>
                <td className="px-3 py-2">
                  {take.status === "in_progress" ? (
                    <Input
                      type="number"
                      defaultValue={item.counted_quantity ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== "" && Number(val) !== item.counted_quantity) {
                          updateCount(item.id, Number(val));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="text-right h-8 font-mono"
                      placeholder="—"
                    />
                  ) : (
                    <span className="font-mono text-center block">
                      {item.counted_quantity ?? "—"}
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${
                  (item.variance || 0) < 0 ? "text-red-700" : (item.variance || 0) > 0 ? "text-green-700" : "text-muted-foreground"
                }`}>
                  {item.variance !== null && item.variance !== undefined && (item.variance > 0 ? "+" : "")}
                  {item.variance ?? "—"}
                </td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${
                  (item.value_variance || 0) < 0 ? "text-red-700" : (item.value_variance || 0) > 0 ? "text-green-700" : "text-muted-foreground"
                }`}>
                  {item.value_variance !== null && item.value_variance !== undefined && item.value_variance !== 0 && (item.value_variance > 0 ? "+" : "")}
                  {item.value_variance?.toFixed(2) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {take.status === "in_progress" && uncounted.length > 0 && (
        <div className="border border-amber-500/50 bg-amber-500/5 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>{uncounted.length} items not yet counted.</strong> Uncounted items will be excluded from variance calculation when you complete the stock take.
          </p>
        </div>
      )}
    </div>
  );
}

function SmallStat({ label, value, color = "default" }: { label: string; value: number; color?: "default" | "green" | "amber" | "red" }) {
  const colors = {
    default: "border-border",
    green: "border-green-500/50 bg-green-500/5 text-green-700",
    amber: "border-amber-500/50 bg-amber-500/5 text-amber-700",
    red: "border-red-500/50 bg-red-500/5 text-red-700",
  };
  return (
    <div className={`border rounded-lg p-2.5 ${colors[color]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold font-mono mt-0.5">{value}</p>
    </div>
  );
}
