import { useState, useCallback } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Calendar,
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Plus,
  Tag,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createPromotion, updatePromotion, togglePromotion, deletePromotion,
  type Promotion, type PromotionType, type PromotionTarget,
} from "@/services/promotions";
import { pagePromotions } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import { OperationalContext } from "@/components/shared/operational-context";
import { intlLocale } from "@/lib/intl";
import { money, currencySymbol } from "@/lib/money";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/lib/permissions";

export function PromotionsPage() {
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, "promotions.manage");
  const [showExpired, setShowExpired] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);

  const fetcher = useCallback(
    (q: { search?: string; page?: number; pageSize?: number }) =>
      pagePromotions({ ...q, active: showExpired ? undefined : true }),
    [showExpired],
  );
  const list = useListData(fetcher, { pageSize: 50 });

  const load = list.refresh;
  const search = list.search;
  const setSearch = list.setSearch;
  const loading = list.loading;
  const filtered = list.rows as unknown as Promotion[];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/" }}
        eyebrow="Commerce"
        title="Promotions"
        description="Time-limited discounts and offers — automatic or with promo codes."
        actions={canManage ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> New promotion
          </Button>
        ) : null}
      />

      <OperationalContext compact />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or code..."
            className="h-11 pl-9 lg:h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showExpired} onCheckedChange={(v) => setShowExpired(Boolean(v))} />
          Show expired
        </label>
      </div>

      <div className="space-y-2 lg:hidden" aria-label="Promotion records">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading promotions…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Tag} title="No promotions yet" description="Create time-limited discounts to drive traffic and clear stock." cta={canManage ? { label: "Create Promotion", onClick: () => setCreating(true), icon: Plus } : undefined} />
        ) : filtered.map((promotion) => {
          const expired = new Date(promotion.ends_at) < new Date();
          const upcoming = new Date(promotion.starts_at) > new Date();
          return (
            <article key={promotion.id} className="rounded-md border border-border p-4">
              <button type="button" disabled={!canManage} onClick={() => setEditing(promotion)} className="min-h-11 w-full text-left disabled:cursor-default">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium truncate">{promotion.name}</p><p className="mt-1 text-xs text-muted-foreground">{promotion.code || "Automatic offer"}</p></div>{!promotion.active ? <Badge variant="secondary">Paused</Badge> : expired ? <Badge variant="destructive">Expired</Badge> : upcoming ? <Badge variant="outline">Upcoming</Badge> : <Badge>Active</Badge>}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><span className="text-muted-foreground">Offer</span><p className="mt-1 font-medium">{promotion.type === "percent_off" ? `${promotion.value}% off` : promotion.type === "amount_off" ? `${money(promotion.value)} off` : "Buy X get Y"}</p></div><div className="text-right"><span className="text-muted-foreground">Uses</span><p className="mt-1 font-mono">{promotion.uses_count}{promotion.max_uses ? ` / ${promotion.max_uses}` : ""}</p></div></div>
                <p className="mt-3 text-xs text-muted-foreground">{new Date(promotion.starts_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })} – {new Date(promotion.ends_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })}</p>
              </button>
              {canManage && <Button variant="outline" onClick={() => togglePromotion(promotion.id, promotion.active ? 0 : 1).then(load)} className="mt-3 h-11 w-full">{promotion.active ? "Pause" : "Activate"}</Button>}
            </article>
          );
        })}
      </div>

      <div className="hidden border border-border rounded-lg overflow-hidden lg:block">
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
                  cta={canManage ? { label: "Create Promotion", onClick: () => setCreating(true), icon: Plus } : undefined}
                />
              </td></tr>
            ) : (
              filtered.map((p) => {
                const expired = new Date(p.ends_at) < new Date();
                const upcoming = new Date(p.starts_at) > new Date();
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => canManage && setEditing(p)}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{p.description}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary" className="text-xs">
                        {p.type === "percent_off" ? `${p.value}% off` :
                         p.type === "amount_off" ? `${money(p.value)} off` :
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
                      {canManage && (
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
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {canManage && (creating || editing) && (
        <PromotionDialog
          promotion={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      <PaginationBar list={list} />
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-2">
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: String(v) as PromotionType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="percent_off">Percent off</SelectItem>
                <SelectItem value="amount_off">Amount off</SelectItem>
                <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
              </SelectContent></Select>
            </Field>
            <Field label={form.type === "percent_off" ? "Percent (%)" : `Amount (${currencySymbol()})`}>
              <Input
                type="number"
                value={form.value || 0}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <Field label="Applies to">
            <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: String(v) as PromotionTarget })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="cart">Whole cart</SelectItem>
              <SelectItem value="product">Specific product</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent></Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-2">
            <Field label={`Min purchase (${currencySymbol()})`}>
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
            <Checkbox checked={form.active === 1} onCheckedChange={(v) => setForm({ ...form, active: Boolean(v) ? 1 : 0 })} />
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
