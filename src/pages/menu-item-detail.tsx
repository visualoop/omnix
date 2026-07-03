/**
 * MenuItemDetailPage — full drill-in surface for a single menu item.
 *
 * Hospitality is not a shelf module: a menu item is a composition, not
 * a SKU on a shelf. So this page never shows "Stock qty" — it shows
 * "Available today: N servings — bottleneck: <ingredient>".
 *
 * Layout (top-down):
 *   1. Header row — hero image, name, category, station, prices,
 *      prep, allergens, active toggle, 86 toggle, Duplicate.
 *   2. Availability strip — live max servings + bottleneck ingredient.
 *   3. Recipe section — chip UI placeholder (canvas builder in v0.43.3).
 *   4. Sales trend  (v0.43.5).
 *   5. Modifiers    (v0.43.4).
 *   6. Cost history (v0.43.5).
 *
 * Every inline-editable field batches its change into a single
 * `updateMenuItem` call fired from the sticky Save bar at the bottom.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ForkKnife, Copy, Warning, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getMenuItem,
  updateMenuItem,
  setMenuItemActive,
  listStations,
  menuAvailability,
  get86s,
  set86,
  clear86,
  eightySixPresets,
  type MenuItemFull,
  type KitchenStation,
  type MenuAvailability,
  type MenuItem86,
} from "@/services/hospitality";
import { RecipeCanvas } from "@/components/hospitality/recipe-canvas";
import { money as KES } from "@/lib/money";
import { cn } from "@/lib/utils";

export function MenuItemDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<MenuItemFull | null>(null);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [availability, setAvailability] = useState<MenuAvailability | null>(null);
  const [my86, setMy86] = useState<MenuItem86 | null>(null);
  const [dirty, setDirty] = useState<Partial<Record<string, string | number | null>>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    getMenuItem(id).then(setItem);
    listStations().then(setStations);
    menuAvailability().then((m) => setAvailability(m.get(id) ?? null));
    get86s().then((rows) => setMy86(rows.find((r) => r.menu_item_id === id) ?? null));
  };

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  if (!item) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-sm text-muted-foreground">
        Loading menu item…
      </div>
    );
  }

  const patch = (field: string, value: string | number | null) => {
    setDirty((prev) => ({ ...prev, [field]: value }));
  };

  const currentVal = <K extends keyof MenuItemFull>(field: K, formField: string): MenuItemFull[K] | string | number | null => {
    if (formField in dirty) return dirty[formField] as never;
    return item[field];
  };

  const save = async () => {
    if (Object.keys(dirty).length === 0) return;
    setSaving(true);
    try {
      await updateMenuItem(id, dirty);
      toast.success("Saved");
      setDirty({});
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    try {
      await setMenuItemActive(id, !item.active);
      toast.success(item.active ? "Menu item hidden" : "Menu item restored");
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleImagePick = (file: File) => {
    if (file.size > 1_000_000) {
      toast.error("Image must be under 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch("imagePath", String(reader.result));
    reader.readAsDataURL(file);
  };

  const nameVal = String(currentVal("menu_name", "name") ?? "");
  const categoryVal = String(currentVal("category", "category") ?? "");
  const stationVal = String(currentVal("station_id", "stationId") ?? "");
  const dineInVal = Number(currentVal("dine_in_price", "dineInPrice") ?? 0);
  const takeawayVal = Number(currentVal("takeaway_price", "takeawayPrice") ?? 0);
  const prepVal = Number(currentVal("prep_minutes", "prepMinutes") ?? 0);
  const allergensVal = String(currentVal("allergens", "allergens") ?? "");
  const imagePathVal = String(currentVal("image_path", "imagePath") ?? "");

  const maxServings = availability?.max_servings;
  const bottleneck = availability?.bottleneck_product_name;

  return (
    <div className="max-w-5xl mx-auto p-6 pb-24 space-y-6">
      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/hospitality")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to menu
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              item.active
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "border-border text-muted-foreground hover:bg-accent/40",
            )}
            title={item.active ? "Retire this item (hide from menus forever)" : "Restore this item"}
          >
            <Check className="h-3.5 w-3.5" />
            {item.active ? "Active" : "Retired"}
          </button>
          <Eighty6Toggle
            my86={my86}
            onSet={async (until) => { await set86(id, { until }); load(); }}
            onClear={async () => { await clear86(id); load(); }}
          />
          <Button size="sm" variant="outline" className="cursor-pointer">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicate
          </Button>
        </div>
      </div>

      {/* ─── Header (image + inline edits) ────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 p-5">
          {/* Photo */}
          <div className="space-y-2">
            {imagePathVal ? (
              <img
                src={imagePathVal}
                alt=""
                className="w-40 h-40 object-cover rounded-lg border border-border"
              />
            ) : (
              <div className="w-40 h-40 rounded-lg border border-dashed border-border grid place-items-center text-muted-foreground bg-muted/40">
                <ForkKnife className="h-8 w-8 opacity-40" />
              </div>
            )}
            <label className="block">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImagePick(f);
                }}
                className="text-[11px] w-full"
              />
            </label>
            {imagePathVal ? (
              <button
                onClick={() => patch("imagePath", null)}
                className="text-[11px] text-rose-600 hover:underline"
              >
                Remove photo
              </button>
            ) : null}
          </div>

          {/* Inline-editable fields */}
          <div className="space-y-3 min-w-0">
            <Input
              value={nameVal}
              onChange={(e) => patch("name", e.target.value)}
              className="text-xl font-semibold h-11 border-transparent hover:border-border focus:border-border bg-transparent hover:bg-muted/30 focus:bg-muted/30 transition-colors px-2"
              placeholder="Menu item name"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category">
                <Input
                  value={categoryVal}
                  onChange={(e) => patch("category", e.target.value || null)}
                  placeholder="e.g. Mains"
                />
              </Field>
              <Field label="Station">
                <select
                  value={stationVal}
                  onChange={(e) => patch("stationId", e.target.value || null)}
                  className="h-9 px-2 rounded-md border border-input bg-transparent text-sm w-full"
                >
                  <option value="">— No station —</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dine-in price">
                <Input
                  type="number"
                  step="0.01"
                  value={dineInVal || ""}
                  onChange={(e) => patch("dineInPrice", Number(e.target.value) || null)}
                  className="font-mono"
                  placeholder="0.00"
                />
              </Field>
              <Field label="Takeaway price">
                <Input
                  type="number"
                  step="0.01"
                  value={takeawayVal || ""}
                  onChange={(e) => patch("takeawayPrice", Number(e.target.value) || null)}
                  className="font-mono"
                  placeholder="0.00"
                />
              </Field>
              <Field label="Prep (minutes)">
                <Input
                  type="number"
                  value={prepVal || ""}
                  onChange={(e) => patch("prepMinutes", Number(e.target.value) || null)}
                  className="font-mono"
                  placeholder="0"
                />
              </Field>
              <Field label="Allergens">
                <Input
                  value={allergensVal}
                  onChange={(e) => patch("allergens", e.target.value || null)}
                  placeholder="dairy, gluten…"
                />
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Availability strip ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div className="size-10 rounded-lg bg-emerald-500/15 grid place-items-center">
          <ForkKnife className="h-5 w-5 text-emerald-600 dark:text-emerald-400" weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Available today
          </div>
          <div className="text-lg font-semibold">
            {maxServings === undefined
              ? "Add a recipe to see availability"
              : maxServings === Infinity
              ? "Unlimited (no recipe attached)"
              : `${maxServings} serving${maxServings === 1 ? "" : "s"}`}
          </div>
          {bottleneck ? (
            <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
              <Warning className="h-3 w-3 text-amber-600" />
              Bottleneck: <span className="font-medium text-foreground/85">{bottleneck}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Recipe section ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Recipe
          </div>
          <h2 className="text-lg font-semibold mt-0.5">Ingredients &amp; cost</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            What comes out of stock when this item is served. Selling
            this menu item deducts these ingredients from your
            raw inventory (FEFO), not the menu item itself.
          </p>
        </div>
        <RecipeCanvas
          menuItemId={id}
          menuItemName={nameVal || item.menu_name}
          menuItemImage={imagePathVal || null}
          sellingPrice={dineInVal}
        />
      </div>

      {/* ─── Sticky Save bar ────────────────────────────────────── */}
      {Object.keys(dirty).length > 0 ? (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-40 rounded-full bg-foreground text-background shadow-lg px-4 py-2 flex items-center gap-3 text-sm">
          <Badge className="bg-background text-foreground">
            {Object.keys(dirty).length} unsaved
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDirty({})}
            className="text-background/80 hover:text-background hover:bg-transparent"
            disabled={saving}
          >
            Discard
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Convenience price formatter — currently unused, kept for future
 *  "typical price / typical cost" chips. */
export function _priceChip(v: number | null | undefined): string {
  if (v == null) return "—";
  return KES(v);
}

function Eighty6Toggle({
  my86,
  onSet,
  onClear,
}: {
  my86: MenuItem86 | null;
  onSet: (until: string | null) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const presets = eightySixPresets();
  const until = my86?.until ? new Date(my86.until) : null;
  return (
    <div className="relative">
      <button
        onClick={() => (my86 ? onClear() : setOpen(!open))}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          my86
            ? "border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
            : "border-border text-muted-foreground hover:bg-accent/40",
        )}
        title={my86 ? "Restore — kitchen has it again" : "86 — kitchen has run out"}
      >
        <Warning className="h-3.5 w-3.5" />
        {my86
          ? until
            ? `86 until ${until.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
            : "86 (indefinite)"
          : "86"}
      </button>
      {open && !my86 ? (
        <div className="absolute right-0 mt-1 z-30 min-w-[220px] rounded-md border border-border bg-popover shadow-md text-sm">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={async () => { await onSet(p.until); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors first:rounded-t-md last:rounded-b-md"
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
