import { PLACEHOLDERS } from "@/lib/variant-placeholders";
import { useState, useEffect } from "react";
import { Trash2, Plus, Loader2, Layers, Package } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { AiButton } from "@/components/ai/AiButton";
import { ai } from "@/services/ai";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  createProduct, updateProduct, getProduct, getCategories, type Category,
} from "@/services/inventory";
import { getPharmacyProduct, upsertPharmacyProduct } from "@/services/pharmacy";
import {
  listBrands, listVariants, upsertVariant, deleteVariant,
  listProductUoms, upsertProductUom, deleteProductUom,
  listPriceLists, setPriceListItem,
  type BrandWithStats, type ProductVariant, type ProductUom, type PriceList,
} from "@/services/retail";
import { useActiveModule } from "@/stores/active-module";
import { execute } from "@/lib/db";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  onSaved: () => void;
}

export function ProductPanel({ open, onClose, productId, onSaved }: Props) {
  const activeModule = useActiveModule((s) => s.active);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [tab, setTab] = useState("general");
  // effectiveProductId tracks the panel's true mode: prop on initial mount,
  // then bumped to the new id after Create so the panel switches into edit
  // mode in-place without forcing the user to reopen.
  const [effectiveProductId, setEffectiveProductId] = useState<string | null>(productId);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", category_id: "",
    unit: "pcs", buying_price: "", selling_price: "",
    reorder_level: "10", initial_stock: "",
    // retail extras
    brand_id: "" as string | null, sku_short: "",
    unit_of_sale: "piece", sold_by_weight: false, price_per_unit: "",
  });
  const [pharma, setPharma] = useState({
    generic_name: "", brand_name: "", dosage_form: "", strength: "",
    manufacturer: "", requires_prescription: false, is_controlled: false,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!effectiveProductId;

  // Sync prop → state when the panel is opened with a different product
  // (or as null for a fresh "create").
  useEffect(() => { setEffectiveProductId(productId); }, [productId]);

  // Whenever the effective product changes (initial open, post-create
  // bump, prop-change), reload its retail variants list.
  useEffect(() => {
    if (effectiveProductId && activeModule === "retail") {
      listVariants(effectiveProductId, true).then(setVariants);
    } else {
      setVariants([]);
    }
  }, [effectiveProductId, activeModule]);

  useEffect(() => {
    if (open) {
      getCategories().then(setCategories);
      if (activeModule === "retail") listBrands(false).then(setBrands);
      if (productId) {
        getProduct(productId).then((p) => {
          if (p) setForm({
            name: p.name, sku: p.sku || "", barcode: p.barcode || "",
            category_id: p.category_id || "", unit: p.unit,
            buying_price: String(p.buying_price), selling_price: String(p.selling_price),
            reorder_level: String(p.reorder_level), initial_stock: "",
            brand_id: (p as any).brand_id || "",
            sku_short: (p as any).sku_short || "",
            unit_of_sale: (p as any).unit_of_sale || "piece",
            sold_by_weight: (p as any).sold_by_weight === 1,
            price_per_unit: (p as any).price_per_unit ? String((p as any).price_per_unit) : "",
          });
        });
        getPharmacyProduct(productId).then((pp) => {
          if (pp) setPharma({
            generic_name: pp.generic_name || "",
            brand_name: pp.brand_name || "",
            dosage_form: pp.dosage_form || "",
            strength: pp.strength || "",
            manufacturer: pp.manufacturer || "",
            requires_prescription: pp.requires_prescription === 1,
            is_controlled: pp.is_controlled === 1,
          });
        });
      } else {
        setForm({
          name: "", sku: "", barcode: "", category_id: "", unit: "pcs",
          buying_price: "", selling_price: "", reorder_level: "10", initial_stock: "",
          brand_id: "", sku_short: "", unit_of_sale: "piece",
          sold_by_weight: false, price_per_unit: "",
        });
        setPharma({ generic_name: "", brand_name: "", dosage_form: "", strength: "", manufacturer: "", requires_prescription: false, is_controlled: false });
        setVariants([]);
      }
      setTab("general");
    }
  }, [open, productId, activeModule]);

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name || !form.selling_price) {
      toast.error("Name and selling price are required");
      return;
    }
    setSaving(true);
    try {
      let savedId = productId;
      const baseInput = {
        name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
        category_id: form.category_id || undefined, unit: form.unit,
        reorder_level: parseInt(form.reorder_level) || 0,
        buying_price: parseFloat(form.buying_price) || 0,
        selling_price: parseFloat(form.selling_price),
      };
      if (isEdit) {
        await updateProduct(productId!, baseInput);
      } else {
        savedId = await createProduct({
          ...baseInput,
          initial_stock: parseFloat(form.initial_stock) || 0,
        });
      }

      // Save retail-specific fields if applicable
      if (savedId && activeModule === "retail") {
        await execute(
          `UPDATE products SET brand_id = ?2, sku_short = ?3, unit_of_sale = ?4, sold_by_weight = ?5, price_per_unit = ?6 WHERE id = ?1`,
          [savedId, form.brand_id || null, form.sku_short || null, form.unit_of_sale,
            form.sold_by_weight ? 1 : 0, form.price_per_unit ? parseFloat(form.price_per_unit) : null],
        );
      }

      // Pharmacy attributes
      if (savedId && activeModule === "dawa" && (pharma.generic_name || pharma.brand_name || pharma.requires_prescription || pharma.is_controlled)) {
        await upsertPharmacyProduct({
          product_id: savedId,
          generic_name: pharma.generic_name || null,
          brand_name: pharma.brand_name || null,
          dosage_form: pharma.dosage_form || null,
          strength: pharma.strength || null,
          manufacturer: pharma.manufacturer || null,
          requires_prescription: pharma.requires_prescription ? 1 : 0,
          is_controlled: pharma.is_controlled ? 1 : 0,
          schedule_class: null,
          storage_conditions: null,
          cold_chain: 0,
        });
      }
      const wasCreate = !isEdit;
      onSaved();
      if (wasCreate && activeModule === "retail" && savedId) {
        // Switch into edit mode in-place so the user can immediately add
        // variants / packs without reopening the panel.
        setEffectiveProductId(savedId);
        setTab("variants");
        toast.success("Product created — add sizes, shades, or pack barcodes now.", {
          action: { label: "Done", onClick: onClose },
        });
      } else {
        toast.success(isEdit ? "Product updated" : "Product created");
        onClose();
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:w-[640px] md:w-[720px] lg:w-[800px] sm:max-w-[800px]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Product" : "New Product"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto flex flex-col">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              {activeModule === "dawa" && <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>}
              {activeModule === "retail" && <TabsTrigger value="retail">Retail</TabsTrigger>}
              {activeModule === "retail" && (
                <TabsTrigger value="variants">Variants {isEdit && variants.length > 0 ? `(${variants.length})` : ""}</TabsTrigger>
              )}
              {activeModule === "retail" && (
                <TabsTrigger value="uoms">Cartons / Packs</TabsTrigger>
              )}
            </TabsList>

            <TabsPanel value="general" className="mt-3 space-y-3">
              <Field label="Product name *">
                <div className="flex gap-2">
                  <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={PLACEHOLDERS.productName} autoFocus className="flex-1" />
                  <AiButton
                    label="Enrich"
                    hint="Auto-fill category, unit and tax rate from the product name"
                    disabled={!form.name.trim()}
                    onRun={async () => {
                      const result = await ai.enrichProduct(form.name);
                      const updates: Partial<typeof form> = {};
                      if (result.name && result.name !== form.name) updates.name = result.name;
                      if (result.unit && !form.unit) updates.unit = result.unit;
                      // Apply updates
                      setForm((p) => ({ ...p, ...updates }));
                      toast.success(`Enriched (${result.confidence} confidence)`, {
                        description: result.notes ?? "Review the suggested values before saving.",
                      });
                    }}
                  />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="SKU">
                  <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Barcode">
                  <Input
                    value={form.barcode}
                    onChange={(e) => update("barcode", e.target.value)}
                    placeholder="Scan or type"
                    autoFocus={!isEdit}
                  />
                </Field>
              </div>
              <Field label="Category">
                <Combobox
                  value={form.category_id}
                  onChange={(id) => update("category_id", id)}
                  options={[
                    { value: "", label: "No category" },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  placeholder="Pick a category"
                  searchPlaceholder="Search categories…"
                  emptyText="No categories match. Type a name + Enter to create."
                  onCreate={async (label) => {
                    const { createCategory } = await import("@/services/inventory");
                    const id = await createCategory(label);
                    const newCat: Category = { id, name: label, parent_id: null } as Category;
                    setCategories([...categories, newCat]);
                    return { value: id, label };
                  }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Unit">
                  <Input value={form.unit} onChange={(e) => update("unit", e.target.value)} />
                </Field>
                <Field label="Reorder level">
                  <Input type="number" value={form.reorder_level} onChange={(e) => update("reorder_level", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Buying price">
                  <Input type="number" value={form.buying_price} onChange={(e) => update("buying_price", e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Selling price *">
                  <Input type="number" value={form.selling_price} onChange={(e) => update("selling_price", e.target.value)} placeholder="0.00" />
                </Field>
              </div>
              {!isEdit && (
                <Field label="Initial stock">
                  <Input type="number" value={form.initial_stock} onChange={(e) => update("initial_stock", e.target.value)} placeholder="0" />
                </Field>
              )}

              {/* Tier prices — Default / Wholesale / VIP / etc. */}
              {activeModule === "retail" && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tier prices</span>
                    {!isEdit && (
                      <span className="text-[10px] text-muted-foreground italic">Save product first to add tiers</span>
                    )}
                  </div>
                  {isEdit && effectiveProductId && (
                    <TierPricesEditor productId={effectiveProductId} />
                  )}
                </div>
              )}
            </TabsPanel>

            {activeModule === "dawa" && (
              <TabsPanel value="pharmacy" className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Generic name">
                    <Input value={pharma.generic_name} onChange={(e) => setPharma({ ...pharma, generic_name: e.target.value })} placeholder="Paracetamol" />
                  </Field>
                  <Field label="Brand name">
                    <Input value={pharma.brand_name} onChange={(e) => setPharma({ ...pharma, brand_name: e.target.value })} placeholder="Panadol" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Dosage form">
                    <Input value={pharma.dosage_form} onChange={(e) => setPharma({ ...pharma, dosage_form: e.target.value })} placeholder="Tablet" />
                  </Field>
                  <Field label="Strength">
                    <Input value={pharma.strength} onChange={(e) => setPharma({ ...pharma, strength: e.target.value })} placeholder="500mg" />
                  </Field>
                </div>
                <Field label="Manufacturer">
                  <Input value={pharma.manufacturer} onChange={(e) => setPharma({ ...pharma, manufacturer: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={pharma.requires_prescription} onCheckedChange={(c: boolean) => setPharma({ ...pharma, requires_prescription: c })} />
                  Requires prescription
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={pharma.is_controlled} onCheckedChange={(c: boolean) => setPharma({ ...pharma, is_controlled: c })} />
                  Controlled substance
                </label>
              </TabsPanel>
            )}

            {activeModule === "retail" && (
              <TabsPanel value="retail" className="mt-3 space-y-3">
                <Field label="Brand">
                  <select
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                    value={form.brand_id || ""}
                    onChange={(e) => update("brand_id", e.target.value)}
                  >
                    <option value="">No brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Short SKU (for keyboard entry)">
                  <Input value={form.sku_short} onChange={(e) => update("sku_short", e.target.value)} placeholder="e.g., 042 for cashier shortcut" className="font-mono" />
                </Field>
                <Field label="Unit of sale">
                  <select
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                    value={form.unit_of_sale}
                    onChange={(e) => update("unit_of_sale", e.target.value)}
                  >
                    <option value="piece">Piece</option>
                    <option value="pack">Pack</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="l">Litre (L)</option>
                    <option value="ml">Millilitre (ml)</option>
                    <option value="m">Metre (m)</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={form.sold_by_weight} onCheckedChange={(c: boolean) => update("sold_by_weight", c)} />
                  <div>
                    <div>Sold by weight (requires scale)</div>
                    <div className="text-[10px] text-muted-foreground">For butcheries, deli counters, hardware</div>
                  </div>
                </label>
                {form.sold_by_weight && (
                  <Field label={`Price per ${form.unit_of_sale}`}>
                    <Input
                      type="number"
                      value={form.price_per_unit}
                      onChange={(e) => update("price_per_unit", e.target.value)}
                      placeholder="e.g., 600 (KES per kg)"
                    />
                  </Field>
                )}
              </TabsPanel>
            )}

            {activeModule === "retail" && (
              <TabsPanel value="variants" className="mt-3">
                {isEdit && effectiveProductId ? (
                  <VariantsManager
                    productId={effectiveProductId}
                    variants={variants}
                    onChange={() => listVariants(effectiveProductId, true).then(setVariants)}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                    <Layers className="h-6 w-6 mx-auto text-muted-foreground" />
                    <h4 className="mt-3 text-sm font-medium">Save the product first</h4>
                    <p className="mt-1.5 text-[12px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      Variants (sizes, shades, colours) are stored per product. Fill in the Basics tab and click <strong>Create</strong> — the variants editor opens automatically.
                    </p>
                  </div>
                )}
              </TabsPanel>
            )}

            {activeModule === "retail" && (
              <TabsPanel value="uoms" className="mt-3">
                {isEdit && effectiveProductId ? (
                  <UomsManager productId={effectiveProductId} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                    <Package className="h-6 w-6 mx-auto text-muted-foreground" />
                    <h4 className="mt-3 text-sm font-medium">Save the product first</h4>
                    <p className="mt-1.5 text-[12px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      Pack / carton barcodes, weights, and per-pack pricing are stored per product. Click <strong>Create</strong> first — then come back to add packs.
                    </p>
                  </div>
                )}
              </TabsPanel>
            )}
          </Tabs>
        </div>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {isEdit ? "Update" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Variants Manager ────────────────────────────────────────────────
function VariantsManager({ productId, variants, onChange }: {
  productId: string;
  variants: ProductVariant[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProductVariant>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [variantSearch, setVariantSearch] = useState("");

  const filteredVariants = variantSearch.trim()
    ? variants.filter((v) => {
        const q = variantSearch.toLowerCase();
        return (
          v.variant_sku?.toLowerCase().includes(q) ||
          v.variant_name?.toLowerCase().includes(q) ||
          v.color?.toLowerCase().includes(q) ||
          v.size?.toLowerCase().includes(q) ||
          v.shade?.toLowerCase().includes(q)
        );
      })
    : variants;

  const startAdd = () => {
    setEditingId(null);
    setEditForm({
      product_id: productId,
      variant_sku: "",
      variant_name: "",
      barcode: "",
      color: "",
      size: "",
      shade: "",
      stock_qty: 0,
      reorder_level: 0,
      active: 1,
    });
    setAdding(true);
  };

  const startEdit = (v: ProductVariant) => {
    setEditingId(v.id);
    setEditForm(v);
    setAdding(true);
  };

  const cancel = () => {
    setAdding(false);
    setEditingId(null);
    setEditForm({});
  };

  const save = async () => {
    if (!editForm.variant_sku || !editForm.variant_name) {
      toast.error("SKU and name required");
      return;
    }
    try {
      await upsertVariant({
        ...editForm,
        product_id: productId,
        variant_sku: editForm.variant_sku!,
        variant_name: editForm.variant_name!,
      });
      toast.success(editingId ? "Variant updated" : "Variant added");
      cancel();
      onChange();
    } catch (e) { toast.error(String(e)); }
  };

  const remove = async (id: string, name: string) => {
    if (!(await confirm({
      title: `Delete variant "${name}"?`,
      description: "This is permanent. Use deactivate if you only want to hide it.",
      variant: "destructive",
    }))) return;
    await deleteVariant(id);
    toast.success("Deleted");
    onChange();
  };

  if (adding) {
    return (
      <div className="space-y-3 border border-border rounded-md p-3 bg-muted/10">
        <h3 className="text-xs font-semibold">{editingId ? "Edit" : "New"} Variant</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="SKU *">
            <Input
              value={editForm.variant_sku || ""}
              onChange={(e) => setEditForm({ ...editForm, variant_sku: e.target.value })}
              className="font-mono"
              placeholder="e.g., LIPSTICK-RED-S"
            />
          </Field>
          <Field label="Variant Name *">
            <Input
              value={editForm.variant_name || ""}
              onChange={(e) => setEditForm({ ...editForm, variant_name: e.target.value })}
              placeholder='e.g., "Ruby Red / Small"'
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Color">
            <Input value={editForm.color || ""} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} placeholder="Red" />
          </Field>
          <Field label="Size">
            <Input value={editForm.size || ""} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} placeholder="S/M/L" />
          </Field>
          <Field label="Shade">
            <Input value={editForm.shade || ""} onChange={(e) => setEditForm({ ...editForm, shade: e.target.value })} placeholder="Matte" />
          </Field>
        </div>
        <Field label="Barcode">
          <Input value={editForm.barcode || ""} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })} className="font-mono" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Buying price (override)">
            <Input
              type="number"
              value={editForm.buying_price ?? ""}
              onChange={(e) => setEditForm({ ...editForm, buying_price: e.target.value === "" ? null : parseFloat(e.target.value) })}
              placeholder="Inherit"
            />
          </Field>
          <Field label="Selling price (override)">
            <Input
              type="number"
              value={editForm.selling_price ?? ""}
              onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value === "" ? null : parseFloat(e.target.value) })}
              placeholder="Inherit"
            />
          </Field>
          <Field label="Stock qty">
            <Input
              type="number"
              value={editForm.stock_qty ?? 0}
              onChange={(e) => setEditForm({ ...editForm, stock_qty: parseFloat(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox
            checked={(editForm.active ?? 1) === 1}
            onCheckedChange={(c: boolean) => setEditForm({ ...editForm, active: c ? 1 : 0 })}
          />
          Active
        </label>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={cancel} className="flex-1">Cancel</Button>
          <Button size="sm" onClick={save} className="flex-1">Save Variant</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {variants.length === 0
            ? "No variants. Add color, size, shade combinations to track stock per option."
            : `${variants.length} variant${variants.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={startAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Variant
        </Button>
      </div>

      {variants.length > 5 && (
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <Input
            value={variantSearch}
            onChange={(e) => setVariantSearch(e.target.value)}
            placeholder="Search variants by SKU, name, color, size, shade…"
            className="pl-9 h-8 text-[12px]"
          />
        </div>
      )}

      {filteredVariants.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">SKU</th>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Attrs</th>
                <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Stock</th>
                <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Price</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((v) => (
                <tr key={v.id} className={`border-b border-border/60 ${v.active === 0 ? "opacity-50" : ""}`}>
                  <td className="px-2 py-1.5 font-mono">{v.variant_sku}</td>
                  <td className="px-2 py-1.5">{v.variant_name}</td>
                  <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    {[v.color, v.size, v.shade].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{v.stock_qty}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {v.selling_price !== null ? v.selling_price.toFixed(2) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-0.5 justify-end">
                      <Button variant="ghost" size="icon-xs" onClick={() => startEdit(v)} title="Edit">
                        <span className="text-[10px]">✎</span>
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => remove(v.id, v.variant_name)} title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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


// ─── UOMs Manager (carton/pack conversions) ────────────────────────────
function UomsManager({ productId }: { productId: string }) {
  const [uoms, setUoms] = useState<ProductUom[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProductUom | null>(null);
  const [form, setForm] = useState<Partial<ProductUom>>({});

  const load = () => listProductUoms(productId).then(setUoms);
  useEffect(() => { load(); }, [productId]);

  const startAdd = () => {
    setEditing(null);
    setForm({ product_id: productId, name: "", quantity_per: 1 });
    setAdding(true);
  };

  const startEdit = (u: ProductUom) => {
    setEditing(u);
    setForm(u);
    setAdding(true);
  };

  const cancel = () => { setAdding(false); setEditing(null); setForm({}); };

  const save = async () => {
    if (!form.name || !form.quantity_per || form.quantity_per <= 0) {
      toast.error("Name and quantity required");
      return;
    }
    try {
      await upsertProductUom({
        ...form,
        product_id: productId,
        name: form.name,
        quantity_per: form.quantity_per,
      });
      toast.success(editing ? "Updated" : "Added");
      cancel();
      load();
    } catch (e) { toast.error(String(e)); }
  };

  const remove = async (u: ProductUom) => {
    if (!(await confirm({ title: `Delete "${u.name}"?`, variant: "destructive" }))) return;
    await deleteProductUom(u.id);
    toast.success("Deleted");
    load();
  };

  if (adding) {
    return (
      <div className="space-y-3 border border-border rounded-md p-3 bg-muted/10">
        <h3 className="text-xs font-semibold">{editing ? "Edit" : "New"} Pack / Carton</h3>
        <Field label="Pack Name *">
          <Input
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder='e.g., "Carton of 24", "Box of 12"'
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Units per pack *">
            <Input
              type="number"
              min={1}
              value={form.quantity_per ?? 1}
              onChange={(e) => setForm({ ...form, quantity_per: parseFloat(e.target.value) || 0 })}
              placeholder="24"
            />
          </Field>
          <Field label="Pack barcode">
            <Input
              value={form.barcode || ""}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="font-mono"
              placeholder="Scan or type"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pack selling price (override)">
            <Input
              type="number"
              value={form.selling_price ?? ""}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value === "" ? null : parseFloat(e.target.value) })}
              placeholder="Auto from base × qty"
            />
          </Field>
          <Field label="Pack buying price">
            <Input
              type="number"
              value={form.buying_price ?? ""}
              onChange={(e) => setForm({ ...form, buying_price: e.target.value === "" ? null : parseFloat(e.target.value) })}
              placeholder="Optional"
            />
          </Field>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-border">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.is_default_purchase}
              onChange={(e) => setForm({ ...form, is_default_purchase: e.target.checked ? 1 : 0 })}
            />
            Default purchase pack (orders use this size by default)
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.is_default_sale}
              onChange={(e) => setForm({ ...form, is_default_sale: e.target.checked ? 1 : 0 })}
            />
            Default sale pack (POS sells this size by default)
          </label>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={cancel} className="flex-1">Cancel</Button>
          <Button size="sm" onClick={save} className="flex-1">Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {uoms.length === 0
            ? "No carton/pack sizes defined. Add to scan a carton barcode and have POS know it equals N units."
            : `${uoms.length} pack size${uoms.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={startAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Pack
        </Button>
      </div>

      {uoms.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Pack</th>
                <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Units</th>
                <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Barcode</th>
                <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Sell Price</th>
                <th className="text-center px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Default</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {uoms.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="px-2 py-1.5 font-medium">{u.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono">×{u.quantity_per}</td>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{u.barcode || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono">
                    {u.selling_price !== null ? u.selling_price.toFixed(2) : <span className="text-muted-foreground">auto</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[10px]">
                    {u.is_default_sale ? <span className="text-emerald-600">Sale</span> :
                     u.is_default_purchase ? <span className="text-blue-600">Buy</span> : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-0.5 justify-end">
                      <Button variant="ghost" size="icon-xs" onClick={() => startEdit(u)}>
                        <span className="text-[10px]">✎</span>
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => remove(u)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed">
        <b>How it works:</b> When a cashier scans a carton barcode in POS, the system recognizes the pack
        and adds the right quantity (e.g., scan a "Carton of 24" → 24 units added at carton price if set).
      </div>
    </div>
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


/**
 * TierPricesEditor — inline grid showing each price list × selling price
 * for the current product. Owner edits inline + saves on blur. New
 * tier rows pre-populate the product's default selling price for fast
 * fill-in.
 */
function TierPricesEditor({ productId }: { productId: string }) {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [pls, prods] = await Promise.all([
        listPriceLists(false),
        import("@/services/retail").then((m) => m.listPricesForProduct(productId)),
      ]);
      setLists(pls);
      const map = new Map<string, number>();
      for (const p of prods) map.set(p.price_list_id, p.price);
      setPrices(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [productId]);

  const handleBlur = async (priceListId: string, value: string) => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0) return;
    setSaving(priceListId);
    try {
      if (num === 0) {
        const m = await import("@/services/retail");
        await m.removeProductPriceTier(priceListId, productId);
      } else {
        await setPriceListItem({ price_list_id: priceListId, product_id: productId, price: num });
      }
      await reload();
      toast.success("Tier price saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="text-[11px] text-muted-foreground italic">Loading tier prices…</div>;
  }
  if (lists.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
        No price lists yet. Create one in <strong>Settings → Price Lists</strong>, then assign tier prices here.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="bg-muted/30 border-b border-border">
          <tr>
            <th className="text-left px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Price list</th>
            <th className="text-right px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Selling price</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((pl) => {
            const current = prices.get(pl.id);
            return (
              <tr key={pl.id} className="border-b border-border/60 last:border-0">
                <td className="px-2.5 py-1.5">
                  <span className="font-medium">{pl.name}</span>
                  {pl.is_default ? (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Default
                    </span>
                  ) : null}
                </td>
                <td className="px-2.5 py-1 text-right">
                  <Input
                    type="number"
                    defaultValue={current ?? ""}
                    placeholder="—"
                    className="h-7 w-24 text-right text-[12px] tabular-nums ml-auto"
                    onBlur={(e) => handleBlur(pl.id, e.target.value)}
                    disabled={saving === pl.id}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
