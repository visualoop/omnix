/**
 * VariantsDrawer — full-screen variants editor in a vaul Drawer.
 *
 * Used from two surfaces:
 *   1. The product list row in inventory — small "variants" icon next to
 *      the edit pencil. Clicking it opens this drawer for that product.
 *   2. Inside the product creation/edit Sheet — the Variants tab renders
 *      a compact summary + "Open variants editor" button that triggers
 *      this same drawer. Both surfaces share one VariantsManager
 *      component, so the editing UX is identical no matter where you
 *      came from.
 *
 * Visual treatment (frontend-design + emil-design-eng):
 *   - Drawer slides up from the bottom, fills 96vh — full-screen feel
 *     without taking over the URL or losing the underlying context.
 *   - Header sets the product name in display serif (Fraunces) at 22px.
 *   - Body renders the existing VariantsManager unchanged — that
 *     component already has the search-when-many + add/edit/delete UI.
 *   - Footer: a single "Done" close button. No "Save" button —
 *     VariantsManager autosaves on each row.
 */
import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { listVariants, type ProductVariant } from "@/services/retail";
import { useEffect } from "react";

interface VariantsDrawerProps {
  productId: string;
  productName: string;
  /** Optional trigger element. If omitted, parent controls open state via the
   *  `open` + `onOpenChange` props. */
  trigger?: React.ReactNode;
  /** Optional controlled open state (for cases where parent controls it). */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

/**
 * Inner component — actually mounts the VariantsManager. Lazy-loads the
 * heavy variants list so the drawer trigger doesn't carry the cost
 * until opened.
 */
function VariantsBody({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  useEffect(() => {
    listVariants(productId, true).then(setVariants);
  }, [productId]);

  // We import VariantsManager dynamically to avoid the circular dep
  // between product-panel.tsx (which exports it) and this file.
  const [Manager, setManager] = useState<React.ComponentType<{
    productId: string;
    variants: ProductVariant[];
    onChange: () => void;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/components/inventory/product-panel").then((m) => {
      if (!cancelled && m.VariantsManager) setManager(() => m.VariantsManager);
    });
    return () => { cancelled = true; };
  }, []);

  if (!Manager) {
    return (
      <div className="px-6 py-12 text-[12px] uppercase tracking-[0.18em] font-mono text-muted-foreground">
        Loading variants editor…
      </div>
    );
  }
  return (
    <Manager
      productId={productId}
      variants={variants}
      onChange={() => listVariants(productId, true).then(setVariants)}
    />
  );
}

export function VariantsDrawer({
  productId,
  productName,
  trigger,
  open,
  onOpenChange,
}: VariantsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent>
        <DrawerHeader className="px-8">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Variants
            </span>
            <DrawerTitle
              style={{ fontFamily: "var(--font-display, serif)" }}
              className="text-[28px] font-medium leading-[1.05] tracking-[-0.01em]"
            >
              {productName}
            </DrawerTitle>
            <DrawerDescription className="mt-1">
              Track stock per colour, size, shade, or any axis. Add variants
              for things customers would ask for by name — &ldquo;the red 50 mL&rdquo;,
              &ldquo;a size 10 dress&rdquo;.
            </DrawerDescription>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-auto px-8 py-6">
          <VariantsBody productId={productId} />
        </div>

        <DrawerFooter className="px-8">
          <DrawerClose asChild>
            <Button variant="outline" size="sm">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
