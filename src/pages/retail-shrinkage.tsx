import { useEffect, useState, useCallback } from "react";
import {
  FileText as FileBarChart,
  Plus,
  Warning as AlertTriangle,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  recordShrinkage, getShrinkageSummary,
  type ShrinkageWithDetails, type ShrinkageReason,
} from "@/services/retail";
import { pageShrinkage } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { getProducts, type Product } from "@/services/inventory";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";


import { BackButton } from "@/components/ui/back-button";
const REASON_LABELS: Record<ShrinkageReason, string> = {
  damaged: "Damaged",
  expired: "Expired",
  theft: "Theft / Loss",
  spillage: "Spillage / Spoilage",
  count_correction: "Count Correction",
  sample: "Sample / Promo",
  other: "Other",
};

const REASON_COLORS: Record<ShrinkageReason, string> = {
  damaged: "bg-amber-500",
  expired: "bg-orange-500",
  theft: "bg-red-600",
  spillage: "bg-blue-500",
  count_correction: "bg-gray-500",
  sample: "bg-purple-500",
  other: "bg-slate-500",
};

export function ShrinkagePage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getShrinkageSummary>>>([]);
  const [tab, setTab] = useState<"records" | "summary">("records");
  const [recording, setRecording] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<ShrinkageReason | "">("");
  const [period, setPeriod] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  const fetcher = useCallback(
    (q: { search?: string; page?: number; pageSize?: number }) =>
      pageShrinkage({ ...q, from: period.start, to: period.end }),
    [period],
  );
  const list = useListData(fetcher, { pageSize: 50 });
  const records = list.rows as unknown as ShrinkageWithDetails[];
  const loading = list.loading;

  const load = useCallback(async () => {
    list.refresh();
    const sum = await getShrinkageSummary({ startDate: period.start, endDate: period.end });
    setSummary(sum);
  }, [period, list]);

  useEffect(() => {
    getShrinkageSummary({ startDate: period.start, endDate: period.end }).then(setSummary);
  }, [period]);

  const totalCost = summary.reduce((s, r) => s + r.total_cost, 0);
  const totalQty = summary.reduce((s, r) => s + r.total_qty, 0);
  const totalIncidents = summary.reduce((s, r) => s + r.incident_count, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/retail" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> Shrinkage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track damaged, expired, stolen, or spilled stock. Analyse cost impact by reason over time.
          </p>
        </div>
        <Button onClick={() => setRecording(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Record Shrinkage
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Lost (qty)" value={totalQty.toFixed(0)} />
        <Stat label="Cost Impact" value={KES(totalCost)} color="text-red-600" />
        <Stat label="Incidents" value={String(totalIncidents)} />
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground">Period:</span>
        <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} className="h-7 w-36" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} className="h-7 w-36" />
        <Select value={reasonFilter} onValueChange={(v) => setReasonFilter(String(v) as ShrinkageReason | "")}><SelectTrigger><SelectValue placeholder="All reasons" /></SelectTrigger><SelectContent>
          
          {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent></Select>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search product or reason..."
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="summary">By Reason</TabsTrigger>
        </TabsList>

        <TabsPanel value="records" className="mt-3">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Cost</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={7} rows={4} />
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="p-0">
                    <EmptyState
                      icon={AlertTriangle}
                      title="No shrinkage records"
                      description="Record damaged, expired, or lost stock to track inventory loss."
                      cta={{ label: "Record Shrinkage", onClick: () => setRecording(true), icon: Plus }}
                    />
                  </td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(r.incident_date).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-medium">{r.product_name}</div>
                        {r.variant_name && <div className="text-[10px] text-muted-foreground">{r.variant_name}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">{r.quantity}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`${REASON_COLORS[r.reason]} text-white hover:${REASON_COLORS[r.reason]} text-[9px]`}>
                          {REASON_LABELS[r.reason]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-red-600">
                        {r.cost_value > 0 ? KES(r.cost_value) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{r.notes || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.user_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsPanel>

        <TabsPanel value="summary" className="mt-3">
          <Card>
            <CardContent className="p-4">
              {summary.length === 0 ? (
                <EmptyState
                  icon={FileBarChart}
                  title="No data in this period"
                  description="Try a wider date range."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
                      <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Incidents</th>
                      <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity</th>
                      <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Cost Impact</th>
                      <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.reason} className="border-b border-border/60">
                        <td className="px-2 py-2">
                          <Badge className={`${REASON_COLORS[row.reason]} text-white hover:${REASON_COLORS[row.reason]} text-[9px]`}>
                            {REASON_LABELS[row.reason]}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right text-xs tabular-nums">{row.incident_count}</td>
                        <td className="px-2 py-2 text-right text-xs font-mono tabular-nums">{row.total_qty}</td>
                        <td className="px-2 py-2 text-right text-xs font-mono tabular-nums text-red-600">{KES(row.total_cost)}</td>
                        <td className="px-2 py-2 text-right text-xs tabular-nums">
                          {totalCost > 0 ? `${((row.total_cost / totalCost) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-2 py-2 text-xs">Total</td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums">{totalIncidents}</td>
                      <td className="px-2 py-2 text-right text-xs font-mono tabular-nums">{totalQty}</td>
                      <td className="px-2 py-2 text-right text-xs font-mono tabular-nums text-red-700">{KES(totalCost)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsPanel>
      </Tabs>

      <RecordShrinkageDialog
        open={recording}
        onClose={() => setRecording(false)}
        onSaved={() => { setRecording(false); load(); }}
      />

      <PaginationBar list={list} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold font-mono mt-1 ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RecordShrinkageDialog({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [form, setForm] = useState({
    product_id: "",
    quantity: 1,
    reason: "damaged" as ShrinkageReason,
    cost_value: 0,
    notes: "",
    incident_date: new Date().toISOString().slice(0, 10),
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (productSearch) getProducts(productSearch).then(setProducts);
    else setProducts([]);
  }, [productSearch]);

  useEffect(() => {
    if (open) {
      setForm({
        product_id: "",
        quantity: 1,
        reason: "damaged",
        cost_value: 0,
        notes: "",
        incident_date: new Date().toISOString().slice(0, 10),
      });
      setSelectedProduct(null);
      setProductSearch("");
    }
  }, [open]);

  const save = async () => {
    if (!userId) return;
    if (!form.product_id) { toast.error("Pick a product"); return; }
    if (form.quantity <= 0) { toast.error("Quantity must be > 0"); return; }
    setSubmitting(true);
    try {
      await recordShrinkage({
        product_id: form.product_id,
        quantity: form.quantity,
        reason: form.reason,
        cost_value: form.cost_value,
        notes: form.notes || undefined,
        incident_date: form.incident_date,
        user_id: userId,
      });
      toast.success("Recorded");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>Record Shrinkage</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Product *</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between p-2 border border-border rounded-md bg-muted/20">
                <div>
                  <div className="text-sm font-medium">{selectedProduct.name}</div>
                  <div className="text-[10px] text-muted-foreground">Stock: {selectedProduct.stock_qty}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(null); setForm({ ...form, product_id: "" }); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product..."
                  autoFocus
                />
                {productSearch && products.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md">
                    {products.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          setForm({ ...form, product_id: p.id, cost_value: p.buying_price });
                          setProductSearch("");
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-muted-foreground tabular-nums">{p.stock_qty}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Quantity</label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Date</label>
              <Input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Reason *</label>
            <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: String(v) as ShrinkageReason })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent></Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Cost Value (KES)</label>
            <Input
              type="number"
              value={form.cost_value}
              onChange={(e) => setForm({ ...form, cost_value: parseFloat(e.target.value) || 0 })}
              placeholder="Auto-filled from buying price"
            />
            {selectedProduct && (
              <p className="text-[10px] text-muted-foreground">
                Total loss: {KES(form.cost_value * form.quantity)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Describe what happened, who reported, etc."
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <span className="h-3.5 w-3.5 mr-1.5 animate-spin border-2 border-white border-t-transparent rounded-full" />}
            Record
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
