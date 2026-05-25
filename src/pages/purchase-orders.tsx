import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus, FileText, Package, ChevronRight, ArrowLeft, Trash2, Save, Send, CheckCircle2,
  PackageCheck, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePOStatus,
  createGoodsReceipt, listSuppliers,
  type PurchaseOrder, type Supplier,
} from "@/services/erp";
import { getProducts, type Product } from "@/services/inventory";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "sent" | "partial" | "received">("all");
  const navigate = useNavigate();

  const load = async () => {
    const result = filter === "all"
      ? await listPurchaseOrders()
      : await listPurchaseOrders({ status: filter });
    setPos(result);
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Order stock from suppliers, receive goods
          </p>
        </div>
        <Button onClick={() => navigate("/purchase-orders/new")}>
          <Plus className="h-4 w-4 mr-2" /> New PO
        </Button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["all", "draft", "sent", "partial", "received"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 text-sm capitalize transition-colors ${
              filter === s ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {pos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No purchase orders</p>
          <p className="text-xs mt-1">Create your first PO to start receiving stock</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">PO #</th>
                <th className="text-left px-3 py-2 font-medium">Supplier</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-right px-3 py-2 font-medium">Items</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr key={po.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                  <td className="px-3 py-2.5 font-mono text-xs">{po.po_number}</td>
                  <td className="px-3 py-2.5">{po.supplier_name}</td>
                  <td className="px-3 py-2.5 text-xs">{po.order_date}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{po.item_count}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{po.total.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center"><POStatusBadge status={po.status} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
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

function POStatusBadge({ status }: { status: string }) {
  if (status === "received") return <Badge className="bg-green-600 hover:bg-green-600">Received</Badge>;
  if (status === "partial") return <Badge variant="outline" className="border-amber-500/50 text-amber-700">Partial</Badge>;
  if (status === "sent") return <Badge variant="outline" className="border-blue-500/50 text-blue-700">Sent</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

export function NewPurchaseOrderPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    listSuppliers().then(setSuppliers);
  }, []);

  useEffect(() => {
    if (productSearch.trim()) getProducts(productSearch).then(setProducts);
    else setProducts([]);
  }, [productSearch]);

  const addItem = (p: Product) => {
    if (items.some((i) => i.product_id === p.id)) {
      toast.error("Product already in PO");
      return;
    }
    setItems([...items, {
      product_id: p.id,
      product_name: p.name,
      quantity: 1,
      unit_cost: p.buying_price,
    }]);
    setProductSearch("");
    setProducts([]);
  };

  const updateItem = (idx: number, field: keyof CartItem, value: string | number) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: typeof value === "string" ? Number(value) || 0 : value };
    setItems(newItems);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const save = async (status: "draft" | "sent") => {
    if (!supplierId || items.length === 0) {
      toast.error("Select supplier and add at least one item");
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    try {
      const poId = await createPurchaseOrder({
        supplier_id: supplierId,
        user_id: userId,
        expected_date: expectedDate || undefined,
        notes: notes || undefined,
        items,
      });
      if (status === "sent") await updatePOStatus(poId, "sent");
      toast.success(`PO ${status === "sent" ? "sent" : "saved as draft"}`);
      navigate(`/purchase-orders/${poId}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">New Purchase Order</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="Supplier *">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Expected Delivery Date">
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-[88px] rounded-md border border-input bg-transparent p-2 text-sm"
            placeholder="Internal notes..."
          />
        </Field>
      </div>

      {/* Add product */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search products to add..."
            className="pl-9"
          />
        </div>
        {products.length > 0 && (
          <div className="border border-border rounded-md max-h-48 overflow-auto">
            {products.slice(0, 10).map((p) => (
              <button
                key={p.id}
                onClick={() => addItem(p)}
                className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b border-border last:border-0 text-sm"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  Cost: KES {p.buying_price.toFixed(2)} · Stock: {p.stock_qty}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      {items.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Product</th>
                <th className="text-right px-3 py-2 font-medium w-24">Qty</th>
                <th className="text-right px-3 py-2 font-medium w-28">Unit Cost</th>
                <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{item.product_name}</td>
                  <td className="px-3 py-2">
                    <Input type="number" value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className="text-right h-8 font-mono" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" value={item.unit_cost}
                      onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                      className="text-right h-8 font-mono" step="0.01" />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{(item.quantity * item.unit_cost).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeItem(idx)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/20 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-right">Total:</td>
                <td className="px-3 py-2 text-right font-mono">KES {total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No items yet. Search above to add products.</p>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => save("draft")} disabled={submitting || items.length === 0}>
          <Save className="h-4 w-4 mr-2" /> Save Draft
        </Button>
        <Button onClick={() => save("sent")} disabled={submitting || !supplierId || items.length === 0}>
          <Send className="h-4 w-4 mr-2" /> Send to Supplier
        </Button>
      </div>
    </div>
  );
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ po: PurchaseOrder; items: Awaited<ReturnType<typeof getPurchaseOrder>> extends infer R ? R extends { items: infer I } ? I : never : never } | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    if (!id) return;
    const result = await getPurchaseOrder(id);
    if (result) setData(result as typeof data);
  };

  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const { po, items } = data;
  const canReceive = po.status === "sent" || po.status === "partial";

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight font-mono">{po.po_number}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{po.supplier_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <POStatusBadge status={po.status} />
          {canReceive && (
            <Button onClick={() => setShowReceive(true)}>
              <PackageCheck className="h-4 w-4 mr-2" /> Receive Goods
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <InfoCard label="Order Date" value={po.order_date} />
        <InfoCard label="Expected" value={po.expected_date || "—"} />
        <InfoCard label="Total" value={`KES ${po.total.toFixed(2)}`} />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Items ({items.length})
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Product</th>
              <th className="text-right px-3 py-2 font-medium">Ordered</th>
              <th className="text-right px-3 py-2 font-medium">Received</th>
              <th className="text-right px-3 py-2 font-medium">Pending</th>
              <th className="text-right px-3 py-2 font-medium">Unit Cost</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const pending = item.quantity - item.received_quantity;
              return (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{item.product_name}</td>
                  <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">{item.received_quantity}</td>
                  <td className={`px-3 py-2 text-right font-mono ${pending > 0 ? "text-amber-700" : "text-muted-foreground"}`}>
                    {pending}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{item.unit_cost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{item.line_total.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {po.notes && (
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <p className="text-sm">{po.notes}</p>
        </div>
      )}

      {showReceive && (
        <ReceiveGoodsDialog
          po={po}
          items={items}
          onClose={() => setShowReceive(false)}
          onReceived={() => { setShowReceive(false); load(); }}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}

function ReceiveGoodsDialog({
  po, items, onClose, onReceived,
}: {
  po: PurchaseOrder;
  items: Array<{ id: string; product_id: string; product_name: string; quantity: number; received_quantity: number; unit_cost: number }>;
  onClose: () => void;
  onReceived: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receiveItems, setReceiveItems] = useState(items.map((it) => ({
    po_item_id: it.id,
    product_id: it.product_id,
    product_name: it.product_name,
    quantity: Math.max(0, it.quantity - it.received_quantity),
    unit_cost: it.unit_cost,
    batch_number: "",
    expiry_date: "",
  })));
  const [submitting, setSubmitting] = useState(false);

  const update = (idx: number, field: string, value: string | number) => {
    const newItems = [...receiveItems];
    newItems[idx] = { ...newItems[idx], [field]: typeof value === "string" ? value : value };
    if (field === "quantity") (newItems[idx] as { quantity: number }).quantity = Number(value);
    setReceiveItems(newItems);
  };

  const handleSubmit = async () => {
    if (!userId) return;
    const itemsToReceive = receiveItems.filter((i) => i.quantity > 0);
    if (itemsToReceive.length === 0) {
      toast.error("Set quantity > 0 for at least one item");
      return;
    }
    setSubmitting(true);
    try {
      await createGoodsReceipt({
        po_id: po.id,
        supplier_id: po.supplier_id,
        user_id: userId,
        invoice_number: invoiceNumber || undefined,
        items: itemsToReceive.map((i) => ({
          po_item_id: i.po_item_id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          batch_number: i.batch_number || undefined,
          expiry_date: i.expiry_date || undefined,
        })),
      });
      toast.success("Goods received successfully");
      onReceived();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Receive Goods — {po.po_number}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <Field label="Supplier Invoice #">
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-2 py-2 font-medium">Product</th>
                  <th className="text-right px-2 py-2 font-medium w-20">Receive</th>
                  <th className="text-left px-2 py-2 font-medium w-32">Batch #</th>
                  <th className="text-left px-2 py-2 font-medium w-36">Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {receiveItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">{item.product_name}</td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => update(idx, "quantity", Number(e.target.value))}
                        className="text-right h-8 font-mono"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={item.batch_number}
                        onChange={(e) => update(idx, "batch_number", e.target.value)}
                        className="h-8 font-mono"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => update(idx, "expiry_date", e.target.value)}
                        className="h-8"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> {submitting ? "Receiving..." : "Confirm Receipt"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
