/**
 * Menu item form — single shadcn dialog covering name, category, prices,
 * description, prep time, allergens, available toggle. Replaces the old
 * prompt(name) → prompt(price) chain.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  CircleNotch as Loader2,
  ForkKnife as UtensilsCrossed,
} from "@phosphor-icons/react";
import { toast } from "sonner";

export interface MenuItemFormValues {
  name: string;
  category: string;
  dineInPrice: number;
  takeawayPrice?: number;
  description?: string;
  prepTimeMin?: number;
  allergens?: string;
  imagePath?: string;
  active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: MenuItemFormValues) => Promise<void> | void;
  initial?: Partial<MenuItemFormValues>;
  /** Existing categories for the autocomplete pick. */
  categories?: string[];
}

export function MenuItemDialog({ open, onClose, onSubmit, initial, categories = [] }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [dineInPrice, setDineInPrice] = useState("0");
  const [takeawayPrice, setTakeawayPrice] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [allergens, setAllergens] = useState("");
  const [imagePath, setImagePath] = useState<string>("");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCategory(initial?.category ?? "");
      setDineInPrice(initial?.dineInPrice != null ? String(initial.dineInPrice) : "0");
      setTakeawayPrice(initial?.takeawayPrice != null ? String(initial.takeawayPrice) : "");
      setDescription(initial?.description ?? "");
      setPrepTime(initial?.prepTimeMin != null ? String(initial.prepTimeMin) : "");
      setAllergens(initial?.allergens ?? "");
      setImagePath(initial?.imagePath ?? "");
      setActive(initial?.active ?? true);
    }
  }, [open, initial]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Item name is required.");
      return;
    }
    const dine = parseFloat(dineInPrice);
    if (Number.isNaN(dine) || dine < 0) {
      toast.error("Enter a valid dine-in price.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmed,
        category: category.trim(),
        dineInPrice: dine,
        takeawayPrice: takeawayPrice.trim() === "" ? undefined : parseFloat(takeawayPrice) || 0,
        description: description.trim() || undefined,
        prepTimeMin: prepTime.trim() === "" ? undefined : parseInt(prepTime, 10) || 0,
        allergens: allergens.trim() || undefined,
        imagePath: imagePath || undefined,
        active,
      });
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-primary" />
            {initial?.name ? "Edit menu item" : "New menu item"}
          </DialogTitle>
          <DialogDescription>
            One screen — fill what you know. You can edit any of these later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Name *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ugali Sukuma"
              autoFocus
            />
          </Field>

          <Field label="Category">
            <Combobox
              value={category}
              onChange={setCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
              placeholder="Pick or type a new category…"
              emptyText="No matching category"
              onCreate={async (label) => ({ value: label, label })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Dine-in price (KES) *">
              <Input
                type="number"
                inputMode="decimal"
                value={dineInPrice}
                onChange={(e) => setDineInPrice(e.target.value)}
                className="font-mono"
                min={0}
                step="0.01"
              />
            </Field>
            <Field label="Takeaway price">
              <Input
                type="number"
                inputMode="decimal"
                value={takeawayPrice}
                onChange={(e) => setTakeawayPrice(e.target.value)}
                placeholder="Same as dine-in"
                className="font-mono"
                min={0}
                step="0.01"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prep time (min)">
              <Input
                type="number"
                inputMode="numeric"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="—"
                className="font-mono"
                min={0}
              />
            </Field>
            <Field label="Allergens">
              <Input
                value={allergens}
                onChange={(e) => setAllergens(e.target.value)}
                placeholder="dairy, gluten…"
              />
            </Field>
          </div>

          <Field label="Photo">
            <div className="flex items-center gap-2">
              {imagePath ? (
                <img
                  src={imagePath}
                  alt="menu item"
                  className="h-14 w-14 object-cover rounded-md border border-border"
                />
              ) : (
                <div className="h-14 w-14 rounded-md border border-dashed border-border grid place-items-center text-[10px] text-muted-foreground">
                  none
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1_000_000) {
                    toast.error("Image must be under 1MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setImagePath(String(reader.result));
                  reader.readAsDataURL(file);
                }}
                className="text-[11px]"
              />
              {imagePath && (
                <button
                  type="button"
                  onClick={() => setImagePath("")}
                  className="text-[11px] text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — shown on customer display + receipts"
              className="w-full h-16 rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 outline-none resize-none"
            />
          </Field>

          <label className="flex items-center justify-between rounded-xl glass-thin px-3 py-2.5">
            <span className="text-[13px] font-medium">Available now</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 -mb-1">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting || !name.trim()} className="rounded-lg cursor-pointer shadow-native">
            {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</> : "Save item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
