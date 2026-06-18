import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { Plus, Search, Tag, X, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listPromotions, createPromotion, updatePromotion, togglePromotion, deletePromotion,
  type Promotion, type PromotionType, type PromotionTarget,
} from "@/services/promotions";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

export function PromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listPromotions(showExpired));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [showExpired]);

  const filtered = items.filter((p) =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Promotions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Time-limited discounts and offers — automatic or with promo codes
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Promotion
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or code..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} className="rounded" />
          Show expired
        </label>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Code</th>
              <th className="text-left px-3 py-2 font-medium">Period</th>
              <th className="text-right px-3 py-2 font-medium">Uses</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={7} rows={3} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-0">
                <EmptyState
                  icon={Tag}
                  title="No promotions yet"
                  description="Create time-limited discounts to drive traffic and clear stock."
                  cta={{ label: "Create Promotion", onClick: () => setCreating(true), icon: Plus }}
                />
              </td></tr>
            ) : (
              filtered.map((p) => {
                const expired = new Date(p.ends_at) < new Date();
                const upcoming = new Date(p.starts_at) > new Date();
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setEditing(p)}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{p.description}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary" className="text-xs">
                        {p.type === "percent_off" ? `${p.value}% off` :
                         p.type === "amount_off" ? `KES ${p.value} off` :
                         `Buy X Get Y`}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {p.code ? <Badge variant="outline" className="font-mono">{p.code}</Badge> : <span className="text-muted-foreground">Auto</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.starts_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })} →
                        {" "}{new Date(p.ends_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {p.uses_count}{p.max_uses ? ` / ${p.max_uses}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {!p.active ? <Badge variant="secondary" className="text-xs">Paused</Badge> :
                       expired ? <Badge variant="destructive" className="text-xs">Expired</Badge> :
                       upcoming ? <Badge className="bg-blue-500 hover:bg-blue-500 text-xs">Upcoming</Badge> :
                       <Badge className="bg-green-600 hover:bg-green-600 text-xs">Active</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePromotion(p.id, p.active ? 0 : 1).then(load);
                        }}
                      >
                        {p.active ? "Pause" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <PromotionDialog
          promotion={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PromotionDialog({ promotion, onClose, onSaved }: {
  promotion: Promotion | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Promotion>>(promotion || {
    type: "percent_off",
    target_type: "cart",
    value: 10,
    starts_at: new Date().toISOString().slice(0, 10),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    active: 1,
    min_purchase: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!form.name) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (promotion) {
        await updatePromotion(promotion.id, form);
      } else {
        await createPromotion({
          name: form.name,
          description: form.description || null,
          type: form.type as PromotionType,
          value: form.value || 0,
          target_type: form.target_type as PromotionTarget,
          target_id: form.target_id || null,
          starts_at: form.starts_at || new Date().toISOString(),
          ends_at: form.ends_at || new Date().toISOString(),
          min_purchase: form.min_purchase || 0,
          max_uses: form.max_uses || null,
          code: form.code?.toUpperCase() || null,
          active: form.active ?? 1,
        });
      }
      toast.success(promotion ? "Updated" : "Created");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!promotion || !(await confirm({ title: `Delete promotion "${promotion.name}"? This cannot be undone.` }))) return;
    await deletePromotion(promotion.id);
    toast.success("Deleted");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">{promotion ? "Edit" : "New"} Promotion</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Name *">
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Black Friday 20% Off" autoFocus />
          </Field>

          <Field label="Description">
            <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Visible to customers" />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PromotionType })}
                className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="percent_off">Percent off</option>
                <option value="amount_off">Amount off</option>
                <option value="buy_x_get_y">Buy X Get Y</option>
              </select>
            </Field>
            <Field label={form.type === "percent_off" ? "Percent (%)" : "Amount (KES)"}>
              <Input
                type="number"
                value={form.value || 0}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <Field label="Applies to">
            <select
              value={form.target_type}
              onChange={(e) => setForm({ ...form, target_type: e.target.value as PromotionTarget })}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="cart">Whole cart</option>
              <option value="product">Specific product</option>
              <option value="category">Category</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Starts">
              <Input
                type="date"
                value={form.starts_at?.slice(0, 10) || ""}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </Field>
            <Field label="Ends">
              <Input
                type="date"
                value={form.ends_at?.slice(0, 10) || ""}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Min purchase (KES)">
              <Input
                type="number"
                value={form.min_purchase || 0}
                onChange={(e) => setForm({ ...form, min_purchase: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Max uses (blank = ∞)">
              <Input
                type="number"
                value={form.max_uses || ""}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value ? parseInt(e.target.value) : null })}
              />
            </Field>
          </div>

          <Field label="Promo code (optional, uppercase)">
            <Input
              value={form.code || ""}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g., NEWYEAR20"
              className="uppercase font-mono"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm pt-1">
            <input
              type="checkbox"
              checked={form.active === 1}
              onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
              className="rounded"
            />
            Active
          </label>

          <div className="flex gap-2 pt-3">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={save} className="flex-1" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {promotion ? "Save" : "Create"}
            </Button>
          </div>
          {promotion && (
            <Button variant="ghost" onClick={handleDelete} className="w-full text-red-600">Delete</Button>
          )}
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
