import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProduct, updateProduct, getProduct, getCategories, type Category } from "@/services/inventory";
import { getPharmacyProduct, upsertPharmacyProduct } from "@/services/pharmacy";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  onSaved: () => void;
}

export function ProductPanel({ open, onClose, productId, onSaved }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", category_id: "",
    unit: "pcs", buying_price: "", selling_price: "",
    reorder_level: "10", initial_stock: "",
  });
  const [pharma, setPharma] = useState({
    generic_name: "", brand_name: "", dosage_form: "", strength: "",
    manufacturer: "", requires_prescription: false, is_controlled: false,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!productId;

  useEffect(() => {
    if (open) {
      getCategories().then(setCategories);
      if (productId) {
        getProduct(productId).then((p) => {
          if (p) setForm({
            name: p.name, sku: p.sku || "", barcode: p.barcode || "",
            category_id: p.category_id || "", unit: p.unit,
            buying_price: String(p.buying_price), selling_price: String(p.selling_price),
            reorder_level: String(p.reorder_level), initial_stock: "",
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
        setForm({ name: "", sku: "", barcode: "", category_id: "", unit: "pcs", buying_price: "", selling_price: "", reorder_level: "10", initial_stock: "" });
        setPharma({ generic_name: "", brand_name: "", dosage_form: "", strength: "", manufacturer: "", requires_prescription: false, is_controlled: false });
      }
    }
  }, [open, productId]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name || !form.selling_price) {
      toast.error("Name and selling price are required");
      return;
    }
    setSaving(true);
    try {
      let savedId = productId;
      if (isEdit) {
        await updateProduct(productId!, {
          name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
          category_id: form.category_id || undefined, unit: form.unit,
          reorder_level: parseInt(form.reorder_level),
          buying_price: parseFloat(form.buying_price) || 0,
          selling_price: parseFloat(form.selling_price),
        });
      } else {
        savedId = await createProduct({
          name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
          category_id: form.category_id || undefined, unit: form.unit,
          reorder_level: parseInt(form.reorder_level),
          buying_price: parseFloat(form.buying_price) || 0,
          selling_price: parseFloat(form.selling_price),
          initial_stock: parseFloat(form.initial_stock) || 0,
        });
      }
      // Save pharmacy attributes if any are set
      if (savedId && (pharma.generic_name || pharma.brand_name || pharma.requires_prescription || pharma.is_controlled)) {
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
      toast.success(isEdit ? "Product updated" : "Product created");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Product" : "New Product"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <Field label="Product name *">
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Paracetamol 500mg" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Barcode">
              <Input value={form.barcode} onChange={(e) => update("barcode", e.target.value)} placeholder="Scan or type" />
            </Field>
          </div>
          <Field label="Category">
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.category_id}
              onChange={(e) => update("category_id", e.target.value)}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <Input value={form.unit} onChange={(e) => update("unit", e.target.value)} />
            </Field>
            <Field label="Reorder level">
              <Input type="number" value={form.reorder_level} onChange={(e) => update("reorder_level", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
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

          {/* Pharmacy fields */}
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pharmacy Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Generic name">
                <Input value={pharma.generic_name} onChange={(e) => setPharma({ ...pharma, generic_name: e.target.value })} placeholder="e.g. Paracetamol" />
              </Field>
              <Field label="Brand name">
                <Input value={pharma.brand_name} onChange={(e) => setPharma({ ...pharma, brand_name: e.target.value })} placeholder="e.g. Panadol" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dosage form">
                <Input value={pharma.dosage_form} onChange={(e) => setPharma({ ...pharma, dosage_form: e.target.value })} placeholder="Tablet, Syrup, etc." />
              </Field>
              <Field label="Strength">
                <Input value={pharma.strength} onChange={(e) => setPharma({ ...pharma, strength: e.target.value })} placeholder="500mg" />
              </Field>
            </div>
            <Field label="Manufacturer">
              <Input value={pharma.manufacturer} onChange={(e) => setPharma({ ...pharma, manufacturer: e.target.value })} />
            </Field>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pharma.requires_prescription}
                  onChange={(e) => setPharma({ ...pharma, requires_prescription: e.target.checked })}
                  className="rounded border-input"
                />
                Requires prescription
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pharma.is_controlled}
                  onChange={(e) => setPharma({ ...pharma, is_controlled: e.target.checked })}
                  className="rounded border-input"
                />
                Controlled substance
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
