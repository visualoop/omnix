import { Package, Sparkle as Sparkles } from "@phosphor-icons/react";
import { money as KES } from "@/lib/money";
import type { MobilePosCategory, MobilePosProduct } from "@/components/pos/mobile-pos-types";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

interface MobileProductBrowserProps {
  formFactor: Exclude<PosFormFactor, "desktop">;
  products: MobilePosProduct[];
  categories: MobilePosCategory[];
  activeCategoryId: string | null;
  search: string;
  onSelectCategory: (id: string | null) => void;
  onAddProduct: (product: MobilePosProduct) => void;
}

export function MobileProductBrowser({
  formFactor,
  products,
  categories,
  activeCategoryId,
  search,
  onSelectCategory,
  onAddProduct,
}: MobileProductBrowserProps) {
  const activeCategory = categories.find((category) => category.id === activeCategoryId)?.name;
  const context = search
    ? `${products.length} match${products.length === 1 ? "" : "es"}`
    : activeCategory ?? "Popular products";
  const visibleProducts = products.slice(0, 100);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background" aria-label="Product browser">
      <div
        className="flex shrink-0 gap-2 overflow-x-auto border-y border-border/60 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Product categories"
      >
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          aria-pressed={activeCategoryId === null}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold active:scale-[0.97] motion-reduce:transform-none ${
            activeCategoryId === null ? "bg-foreground text-background" : "bg-muted text-foreground"
          }`}
        >
          <Sparkles className="size-4" aria-hidden />
          Popular
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            aria-pressed={activeCategoryId === category.id}
            aria-label={`${category.name}${category.product_count !== undefined ? `, ${category.product_count} products` : ""}`}
            className={`min-h-11 shrink-0 rounded-md px-4 text-sm font-semibold active:scale-[0.97] motion-reduce:transform-none ${
              activeCategoryId === category.id ? "bg-foreground text-background" : "bg-muted text-foreground"
            }`}
          >
            {category.name}
            {category.product_count !== undefined ? (
              <span className="ml-2 font-mono text-[11px] opacity-70">{category.product_count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{context}</span>
        <span aria-live="polite">
          {products.length > visibleProducts.length ? `First ${visibleProducts.length} of ${products.length} shown · refine search` : `${products.length} shown`}
        </span>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1 [scrollbar-gutter:stable] ${formFactor === "phone" ? "pb-32" : "pb-4"}`}>
        {products.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center text-sm text-muted-foreground">
            <div>
              <Package className="mx-auto mb-3 size-8 opacity-40" aria-hidden />
              <p className="font-medium text-foreground">No products found</p>
              <p className="mt-1">Try another name, SKU, barcode, or category.</p>
            </div>
          </div>
        ) : (
          <div className={`grid gap-2 ${formFactor === "tablet" ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-2"}`}>
            {visibleProducts.map((product) => {
              const stock = product.stock_qty ?? 0;
              const outOfStock = stock <= 0;
              const lowStock = !outOfStock && stock <= (product.reorder_level ?? 0);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onAddProduct(product)}
                  disabled={outOfStock}
                  className="group flex min-h-36 flex-col overflow-hidden rounded-md border border-border bg-card text-left active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
                >
                  <div className="relative grid h-20 w-full place-items-center overflow-hidden bg-muted/60">
                    {product.image_path ? (
                      <img
                        src={product.image_path}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <Package className="size-8 text-muted-foreground/50" aria-hidden />
                    )}
                    <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      outOfStock
                        ? "bg-destructive text-destructive-foreground"
                        : lowStock
                          ? "bg-amber-600 text-white"
                          : "bg-background/90 text-foreground"
                    }`}>
                      {outOfStock ? "OUT" : lowStock ? `${stock} LOW` : `${stock}`}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                    <div>
                      <p className="line-clamp-2 text-sm font-semibold leading-tight">{product.name}</p>
                      <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                        {product.category_name ?? "Uncategorised"}
                      </p>
                    </div>
                    <span className="font-mono text-base font-bold tabular-nums">{KES(product.selling_price)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
