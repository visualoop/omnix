import { useEffect, useMemo, useState } from "react";
import { Package } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listVariants, type ProductVariant } from "@/services/retail";
import { useActiveModule } from "@/stores/active-module";
import type { Product } from "@/services/inventory";

interface Props {
  product: Product | null;
  onClose: () => void;
  onPick: (product: Product, variant: ProductVariant | null) => void;
}

/**
 * Pick-variant dialog.
 *
 * Includes the MOTHER PRODUCT as a first option (cashier may want to sell
 * the parent SKU directly), then every active variant. Cards mirror the
 * main POS product card visually: image-first with a themed accent
 * fallback when no image is uploaded. Dialog body scrolls when the list
 * is long.
 */
export function VariantPickerDialog({ product, onClose, onPick }: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const activeModule = useActiveModule((s) => s.active);
  // Module-accent for the themed icon fallback so the picker feels native
  // to the trade variant (Dawa teal, Retail amber, Hardware orange,
  // Hospitality rose, Pro/core neutral).
  const accent = useMemo(() => moduleAccent(activeModule), [activeModule]);

  useEffect(() => {
    if (!product) return;
    setLoading(true);
    listVariants(product.id, false).then((vs) => {
      setVariants(vs);
      setLoading(false);
      // No variants → just add product directly and close
      if (vs.length === 0) {
        onPick(product, null);
      }
    }).catch(() => {
      onPick(product, null);
    });
  }, [product?.id]);

  if (!product) return null;
  if (loading || variants.length === 0) return null;

  const motherStock =
    (product as { stock_qty?: number }).stock_qty ??
    0;
  const motherImage =
    (product as { image_path?: string | null }).image_path ?? null;
  const motherCategory =
    (product as { category_name?: string }).category_name;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-visible max-h-none">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <DialogTitle>Pick variant — {product.name}</DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Tap the standard SKU to sell the parent directly, or pick a variant.
          </p>
        </DialogHeader>

        <div className="px-5 py-4 max-h-[min(72vh,640px)] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* MOTHER PRODUCT — first card. Synthesises a SKU when the
                product has none so the card reads like a real line item
                rather than literal "Parent SKU" placeholder copy. */}
            <VariantCard
              key="__mother__"
              title={product.name}
              subtitle={parentSku(product)}
              meta={motherCategory ?? null}
              price={product.selling_price}
              stock={motherStock}
              imagePath={motherImage}
              accent={accent}
              onClick={() => { onPick(product, null); onClose(); }}
            />

            {/* VARIANTS */}
            {variants.map((v) => {
              const price = v.selling_price ?? product.selling_price;
              const subtitle = [v.color, v.size, v.shade].filter(Boolean).join(" · ");
              return (
                <VariantCard
                  key={v.id}
                  title={v.variant_name}
                  subtitle={subtitle || v.variant_sku}
                  meta={v.variant_sku && subtitle ? v.variant_sku : null}
                  price={price}
                  stock={v.stock_qty}
                  imagePath={v.image_path}
                  accent={accent}
                  onClick={() => { onPick(product, v); onClose(); }}
                />
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Per-module accent palette so the picker feels like part of the active
 *    trade module. Mirrors useModuleAccent() in pos-sale.tsx — kept inline
 *    here to avoid pulling a circular dep.
 */
type ModuleId = "core" | "dawa" | "retail" | "hardware" | "hospitality";
interface Accent { hex: string }
function moduleAccent(m: ModuleId): Accent {
  switch (m) {
    case "dawa": return { hex: "#0F766E" };
    case "retail": return { hex: "#B45309" };
    case "hardware": return { hex: "#C2410C" };
    case "hospitality": return { hex: "#BE185D" };
    default: return { hex: "#92400E" };
  }
}

interface CardProps {
  title: string;
  subtitle: string | null;
  meta: string | null;
  price: number;
  stock: number;
  imagePath?: string | null;
  accent: Accent;
  onClick: () => void;
}

/**
 * Derive a SKU-shaped identifier for the parent option. Prefers the
 * product's own SKU; falls back to NAME-XXXX where XXXX is a stable
 * 4-char hash slice of the product id so the same parent always shows
 * the same synthetic SKU. Reads like any other variant SKU on the card.
 */
function parentSku(p: { sku?: string | null; name: string; id: string }): string {
  if (p.sku && p.sku.trim()) return p.sku;
  // Stable 4-char tail derived from the product id (deterministic, no
  // randomness so it doesn't churn on re-renders).
  const tail = p.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  const base = p.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase())
    .filter(Boolean)
    .join("-");
  return base ? `${base}-${tail}` : `SKU-${tail}`;
}

function VariantCard({ title, subtitle, meta, price, stock, imagePath, accent, onClick }: CardProps) {
  const oos = stock <= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={oos}
      style={{
        background: `linear-gradient(180deg, color-mix(in oklab, ${accent.hex} 6%, var(--background) 94%), var(--background))`,
        borderColor: `color-mix(in oklab, ${accent.hex} 22%, transparent)`,
      }}
      className={
        "group relative flex flex-col text-left overflow-hidden rounded-xl border " +
        "transition-all duration-150 " +
        (oos
          ? "opacity-50 cursor-not-allowed"
          : "hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.99] cursor-pointer")
      }
    >
      {/* Image / icon block */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        {imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePath}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : null}
        {/* Themed placeholder underneath the image — shows through when no
            image or when the image fails. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 grid place-items-center"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${accent.hex} 12%, transparent), color-mix(in oklab, ${accent.hex} 4%, transparent))`,
          }}
        >
          <Package className="size-10 opacity-30" strokeWidth={1.25} style={{ color: accent.hex }} />
        </div>
        {/* Stock chip */}
        <span
          className={
            "absolute top-1.5 right-1.5 font-mono text-[9px] uppercase tracking-[0.14em] rounded px-1.5 py-0.5 " +
            (oos
              ? "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30"
              : "bg-foreground/[0.10] text-foreground/80")
          }
        >
          {oos ? "Out" : `${stock} left`}
        </span>
      </div>

      {/* Type stack */}
      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        <div className="text-[13px] font-medium leading-tight truncate" title={title}>{title}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground leading-tight truncate" title={subtitle}>
            {subtitle}
          </div>
        )}
        {meta && (
          <div className="text-[10px] font-mono text-muted-foreground/80 leading-tight truncate">{meta}</div>
        )}
        <div className="mt-1 font-mono tabular-nums text-[13px] font-semibold" style={{ color: accent.hex }}>
          KES {price.toFixed(0)}
        </div>
      </div>
    </button>
  );
}
