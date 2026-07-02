import { useEffect, useState } from "react";
import {
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Pencil as Edit3,
  Plus,
  Tag,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  listBrands, upsertBrand, deactivateBrand,
  type Brand, type BrandWithStats,
} from "@/services/retail";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
export function BrandsPage() {
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try { setBrands(await listBrands(false)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = brands.filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/retail" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Brands
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cosmetics, electronics, FMCG brands. Track country of origin and product counts.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Brand
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands..." className="pl-8" />
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-md bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Tag}
              title="No brands yet"
              description="Add brands to organize your products and report on brand performance."
              cta={{ label: "Add Brand", onClick: () => setCreating(true), icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((b) => (
            <Card
              key={b.id}
              className="hover:bg-accent/30 cursor-pointer"
              onClick={() => setEditing(b)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{b.name}</div>
                    {b.country_of_origin && (
                      <div className="text-[10px] text-muted-foreground">{b.country_of_origin}</div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); setEditing(b); }}>
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {b.product_count} product{b.product_count !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BrandForm
        open={creating || !!editing}
        brand={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function BrandForm({ open, brand, onClose, onSaved }: {
  open: boolean;
  brand: Brand | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Brand>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm(brand || { name: "", active: 1 });
  }, [brand, open]);

  const save = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    setSubmitting(true);
    try {
      await upsertBrand({ ...form, name: form.name });
      toast.success(brand ? "Updated" : "Created");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    if (!brand) return;
    if (!(await confirm({
      title: `Deactivate "${brand.name}"?`,
      description: "Products linked to this brand will keep their reference but the brand won't appear in dropdowns.",
      variant: "destructive",
    }))) return;
    await deactivateBrand(brand.id);
    toast.success("Deactivated");
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{brand ? brand.name : "New Brand"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <Field label="Brand Name *">
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Country of Origin">
            <Input value={form.country_of_origin || ""} onChange={(e) => setForm({ ...form, country_of_origin: e.target.value })} placeholder='e.g., "Kenya", "USA", "France"' />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          {brand && (
            <Button variant="ghost" className="w-full text-red-600" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Deactivate Brand
            </Button>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
