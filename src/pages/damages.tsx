/**
 * Damages register — separate ledger from shrinkage. Records product loss
 * discovered on receipt, in-store, or in-transit. Batch quantity is
 * automatically decremented when a batch is specified.
 *
 * Route: /inventory/damages
 */
import { useCallback, useEffect, useState } from "react";
import {
  Warning as AlertTriangle,
  Package,
  Plus,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { listDamages, recordDamage, type DamageEntry } from "@/services/inventory-quality";
import { getProducts } from "@/services/inventory";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { pageBounds } from "@/lib/list-types";
import { PaginationBar } from "@/components/pagination-bar";
import { useMemo } from "react";

const STAGE_LABELS: Record<DamageEntry["discovered_at_stage"], string> = {
  on_receipt: "On receipt",
  in_store: "In store",
  in_transit: "In transit",
};

const STAGE_BADGE: Record<DamageEntry["discovered_at_stage"], string> = {
  on_receipt: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40",
  in_store: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40",
  in_transit: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/40",
};

export function DamagesPage() {
  const [rows, setRows] = useState<DamageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [stageFilter, setStageFilter] = useState<"all" | DamageEntry["discovered_at_stage"]>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const load = useCallback(() => {
    setLoading(true);
    listDamages(180)
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = stageFilter === "all" ? rows : rows.filter((r) => r.discovered_at_stage === stageFilter);
  const totalQty = filtered.reduce((s, r) => s + r.quantity, 0);
  const paged = useMemo(() => {
    const { offset, limit } = pageBounds({ page, pageSize });
    return filtered.slice(offset, offset + limit);
  }, [filtered, page]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/inventory" }}
        eyebrow="Inventory"
        title="Damages register"
        description="Product loss discovered on receipt, in-store, or in-transit. Batch qty deducted automatically."
        actions={
          <Button onClick={() => setRecording(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Record damage
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total units lost" value={totalQty} icon={AlertTriangle} tone="warning" />
        <StatCard label="Entries (last 180d)" value={rows.length} icon={Package} />
        <StatCard label="Filtered" value={filtered.length} icon={Package} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          ["all", "All"],
          ["on_receipt", "On receipt"],
          ["in_store", "In store"],
          ["in_transit", "In transit"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setStageFilter(k); setPage(1); }}
            className={`px-3 py-2 text-sm transition-colors ${
              stageFilter === k ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reported by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={3} />
            ) : paged.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Trash2}
                  title="No damages recorded"
                  description="Damaged product on receipt, in-store breakage, or in-transit loss is logged here."
                  cta={{ label: "Record first damage", onClick: () => setRecording(true), icon: Plus }}
                />
              </td></tr>
            ) : (
              paged.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-accent/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                    {new Date(r.occurred_at).toLocaleDateString(intlLocale(), { dateStyle: "medium" })}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.product_name}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-rose-600">−{r.quantity}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${STAGE_BADGE[r.discovered_at_stage]}`}>
                      {STAGE_LABELS[r.discovered_at_stage]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[220px]">{r.reason || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.reported_by || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        list={{
          page,
          pageSize,
          pageCount,
          total: filtered.length,
          hasMore: page < pageCount,
          setPage,
          rows: paged,
          loading: false,
        } as any}
      />

      <RecordDamageDialog
        open={recording}
        onClose={() => setRecording(false)}
        onSaved={() => { setRecording(false); load(); }}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning";
}) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`h-3.5 w-3.5 ${tone === "warning" ? "text-amber-600" : "text-muted-foreground"}`} />
      </div>
      <p className="text-xl font-semibold font-mono mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function RecordDamageDialog({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const userName = useAuthStore((s) => s.user?.full_name ?? s.user?.username ?? null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [stage, setStage] = useState<DamageEntry["discovered_at_stage"]>("in_store");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setProductId(""); setQuantity("1"); setStage("in_store"); setReason("");
    }
  }, [open]);

  const submit = async () => {
    if (!productId) { toast.error("Pick a product"); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error("Quantity must be > 0"); return; }
    setSaving(true);
    try {
      await recordDamage({
        product_id: productId,
        quantity: qty,
        discovered_at_stage: stage,
        reason: reason || undefined,
        reported_by: userName ?? undefined,
      });
      toast.success("Damage recorded");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Record damage</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Product *</label>
            <ProductPicker value={productId} onChange={setProductId} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Quantity *</label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Stage *</label>
              <Select value={stage} onValueChange={(v) => setStage(v as DamageEntry["discovered_at_stage"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_receipt">On receipt</SelectItem>
                  <SelectItem value="in_store">In store</SelectItem>
                  <SelectItem value="in_transit">In transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Broken bottle, waterlogged, dropped, contamination..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    getProducts().then((rows) => setOptions(rows.map((r) => ({ id: r.id, name: r.name })).slice(0, 500)));
  }, []);

  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger><SelectValue placeholder="Pick a product…" /></SelectTrigger>
      <SelectContent className="max-h-[300px] overflow-y-auto">
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
