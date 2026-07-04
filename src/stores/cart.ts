import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/services/sales";

interface CartProduct {
  id: string;
  name: string;
  selling_price: number;
  tax_rate: number;
  /** Variant id when this product line came from a product_variants row.
   *  When set, the cart treats `id` as the parent product id and `variant_id`
   *  as the discriminator. Stock check and deduction route through
   *  product_variants instead of batches in completeSale. */
  variant_id?: string;
  /**
   * Live stock count. Used by addItemWithQuantity to refuse over-stock
   * additions, and by the POS UI to show "Only N in stock" inline.
   * Pass `Infinity` (or undefined) for non-physical items (services,
   * hospitality menu items consumed via recipe).
   */
  stock_qty?: number;
  /** Variant label (e.g., "Red / Large") — surfaced as a chip on the cart card. */
  variant_label?: string;
  /** Category id — drives the per-line accent strip + lettermark colour. */
  category_id?: string | null;
}

interface CartPayload {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  discountType: "amount" | "percent";
  /** Optional applied promo metadata — surfaces on customer display + receipt. */
  promoId: string | null;
  promoLabel: string | null;
  tip: number;
  tipEmployeeId: string | null;
  serviceChargeAmount: number;
  /** Tax mode — propagates across windows so the customer display shows
   *  the correct totals when the cashier flips inclusive / exclusive / off. */
  taxMode: "off" | "inclusive" | "exclusive";
  sourceType: "hospitality_order" | "prescription" | "layby" | "special_order" | "folio" | "hardware_quote" | null;
  sourceId: string | null;
  sourceLabel: string | null;
  quoteMode: boolean;
  revision: number;
}

let emitCartUpdate: ((state: CartPayload) => void) | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;

function serializeCart(): CartPayload {
  const s = useCartStore.getState();
  return {
    items: s.items,
    customerId: s.customerId,
    discount: s.discount,
    discountType: s.discountType,
    promoId: s.promoId,
    promoLabel: s.promoLabel,
    tip: s.tip,
    tipEmployeeId: s.tipEmployeeId,
    serviceChargeAmount: s.serviceChargeAmount,
    taxMode: s.taxMode,
    sourceType: s.sourceType,
    sourceId: s.sourceId,
    sourceLabel: s.sourceLabel,
    quoteMode: s.quoteMode,
    revision: s.revision,
  };
}

function broadcastNow() {
  if (broadcastTimer) {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
  }
  if (emitCartUpdate) emitCartUpdate(serializeCart());
}

function scheduleBroadcast() {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(broadcastNow, 50);
}

function lineTotal(item: Pick<CartItem, "unit_price" | "quantity" | "discount">): number {
  return Math.max(0, item.unit_price * item.quantity - item.discount);
}

function withQuantity(item: CartItem, quantity: number): CartItem {
  const cappedDiscount = Math.max(0, Math.min(item.unit_price * quantity, item.discount));
  return { ...item, quantity, discount: cappedDiscount, total: lineTotal({ ...item, quantity, discount: cappedDiscount }) };
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  discountType: "amount" | "percent";
  /** Optional applied promo metadata — surfaces on customer display + receipt. */
  promoId: string | null;
  promoLabel: string | null;
  tip: number;
  tipEmployeeId: string | null;
  serviceChargeAmount: number;
  sourceType: "hospitality_order" | "prescription" | "layby" | "special_order" | "folio" | "hardware_quote" | null;
  sourceId: string | null;
  sourceLabel: string | null;
  /** Quote mode — POS defers the sale, stashes the cart as a hardware quotation on Save. */
  quoteMode: boolean;
  setQuoteMode: (b: boolean) => void;
  revision: number;
  addItem: (product: CartProduct) => void;
  addItemWithQuantity: (product: CartProduct, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setLineDiscount: (id: string, discount: number) => void;
  setDiscount: (amount: number, type?: "amount" | "percent", promo?: { id: string; label: string } | null) => void;
  setTip: (amount: number, employeeId?: string | null) => void;
  setServiceCharge: (amount: number) => void;
  setCustomer: (id: string | null) => void;
  /** Re-price a single cart line (used by customer price-list resolution). */
  setLinePrice: (id: string, unitPrice: number) => void;
  setSource: (source: { type: "hospitality_order" | "prescription" | "layby" | "special_order" | "folio" | "hardware_quote"; id: string; label: string } | null) => void;
  /** Tax mode for live cart math. POS pushes from settings on mount. */
  taxMode: "off" | "inclusive" | "exclusive";
  setTaxMode: (mode: "off" | "inclusive" | "exclusive") => void;
  loadSnapshot: (
    items: CartItem[],
    discount: number,
    customerId: string | null,
    options?: {
      tip?: number;
      tipEmployeeId?: string | null;
      serviceChargeAmount?: number;
      source?: { type: "hospitality_order" | "prescription" | "layby" | "special_order" | "folio" | "hardware_quote"; id: string; label: string } | null;
    },
  ) => void;
  clear: () => void;
  subtotal: () => number;
  taxTotal: () => number;
  cartDiscountAmount: () => number;
  grandTotal: () => number;
}

function nextRevision(state: CartState): number {
  return (state.revision || 0) + 1;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customerId: null,
      discount: 0,
      discountType: "amount",
      promoId: null,
      promoLabel: null,
      tip: 0,
      tipEmployeeId: null,
      serviceChargeAmount: 0,
      sourceType: null,
      sourceId: null,
      sourceLabel: null,
      quoteMode: false,
      revision: 0,
      taxMode: "exclusive",
      setTaxMode: (mode) => set({ taxMode: mode }),
      setQuoteMode: (b) => set({ quoteMode: b }),

      addItem: (product) => get().addItemWithQuantity(product, 1),

      addItemWithQuantity: (product, quantity) => {
        const qty = Math.max(1, quantity || 1);
        set((state) => {
          const existing = state.items.find((i) => i.product_id === product.id && i.unit_price === product.selling_price);
          // Stock cap: a finite stock_qty caps the total cart line.
          // Hospitality menu items / services have no stock — pass undefined.
          const stockCap = Number.isFinite(product.stock_qty) ? (product.stock_qty as number) : Infinity;

          // Stock-correctness rule:
          //   if the add would push the line past stockCap, REFUSE the add
          //   in full and emit the blocked event. NO silent partial-add.
          //   Prior behaviour (Math.min) added what it could and ALSO
          //   toasted "out of stock" — confusing. Either we add what the
          //   user asked for or we don't add at all.
          if (existing) {
            const requested = existing.quantity + qty;
            if (requested > stockCap) {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("omnix:cart-stock-blocked", {
                    detail: { productId: product.id, name: product.name, stockQty: stockCap, currentQty: existing.quantity, requested: qty },
                  }),
                );
              }
              return state;
            }
            return {
              items: state.items.map((i) =>
                i.id === existing.id
                  ? { ...withQuantity(i, requested), stock_qty: stockCap === Infinity ? undefined : stockCap }
                  : i,
              ),
              revision: nextRevision(state),
            };
          }

          if (qty > stockCap) {
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("omnix:cart-stock-blocked", {
                  detail: { productId: product.id, name: product.name, stockQty: stockCap, currentQty: 0, requested: qty },
                }),
              );
            }
            return state;
          }
          const item: CartItem = {
            id: crypto.randomUUID(),
            product_id: product.id,
            variant_id: product.variant_id ?? null,
            name: product.name,
            quantity: qty,
            unit_price: product.selling_price,
            discount: 0,
            tax_rate: product.tax_rate,
            total: product.selling_price * qty,
            stock_qty: stockCap === Infinity ? undefined : stockCap,
            variant_label: product.variant_label,
            category_id: product.category_id ?? null,
          };
          return { items: [...state.items, item], revision: nextRevision(state) };
        });
      },

      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        revision: nextRevision(state),
      })),

      updateQty: (id, qty) => {
        if (qty <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => {
          const line = state.items.find((i) => i.id === id);
          if (!line) return state;
          const stockCap = Number.isFinite(line.stock_qty) ? (line.stock_qty as number) : Infinity;
          if (qty > stockCap) {
            // Refuse to push the line past available stock. Surface a
            // blocked event so the UI can toast / shake the row.
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("omnix:cart-stock-blocked", {
                  detail: {
                    productId: line.product_id,
                    name: line.name,
                    stockQty: stockCap,
                    currentQty: line.quantity,
                    requested: qty,
                  },
                }),
              );
            }
            return state;
          }
          return {
            items: state.items.map((i) => (i.id === id ? withQuantity(i, qty) : i)),
            revision: nextRevision(state),
          };
        });
      },

      setLineDiscount: (id, discount) => set((state) => ({
        items: state.items.map((i) => {
          if (i.id !== id) return i;
          const cappedDiscount = Math.max(0, Math.min(i.unit_price * i.quantity, discount));
          return { ...i, discount: cappedDiscount, total: lineTotal({ ...i, discount: cappedDiscount }) };
        }),
        revision: nextRevision(state),
      })),

      setLinePrice: (id, unitPrice) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id
            ? { ...i, unit_price: Math.max(0, unitPrice), total: lineTotal({ ...i, unit_price: Math.max(0, unitPrice) }) }
            : i,
        ),
        revision: nextRevision(state),
      })),

      setDiscount: (amount, type = "amount", promo) => set((state) => ({
        discount: amount,
        discountType: type,
        promoId: promo?.id ?? null,
        promoLabel: promo?.label ?? null,
        revision: nextRevision(state),
      })),
      setTip: (amount, employeeId) => set((state) => ({ tip: amount, tipEmployeeId: employeeId ?? null, revision: nextRevision(state) })),
      setServiceCharge: (amount) => set((state) => ({ serviceChargeAmount: Math.max(0, amount), revision: nextRevision(state) })),
      setCustomer: (id) => set((state) => ({ customerId: id, revision: nextRevision(state) })),
      setSource: (source) => set((state) => ({
        sourceType: source?.type ?? null,
        sourceId: source?.id ?? null,
        sourceLabel: source?.label ?? null,
        revision: nextRevision(state),
      })),
      loadSnapshot: (items, discount, customerId, options) => set((state) => ({
        items,
        discount,
        customerId,
        promoId: null,
        promoLabel: null,
        tip: options?.tip ?? 0,
        tipEmployeeId: options?.tipEmployeeId ?? null,
        serviceChargeAmount: options?.serviceChargeAmount ?? 0,
        sourceType: options?.source?.type ?? null,
        sourceId: options?.source?.id ?? null,
        sourceLabel: options?.source?.label ?? null,
        revision: nextRevision(state),
      })),
      clear: () => {
        set((state) => ({
          items: [],
          customerId: null,
          discount: 0,
          discountType: "amount",
          promoId: null,
          promoLabel: null,
          tip: 0,
          tipEmployeeId: null,
          serviceChargeAmount: 0,
          sourceType: null,
          sourceId: null,
          sourceLabel: null,
          quoteMode: false,
          revision: nextRevision(state),
        }));
        broadcastNow();
      },

      subtotal: () => {
        const items = get().items;
        const mode = get().taxMode;
        if (mode === "inclusive") {
          // Subtotal in inclusive mode = pre-tax base (line gross minus extracted tax)
          return items.reduce((s, i) => {
            const lineNet = Math.max(0, i.unit_price * i.quantity - i.discount);
            const r = i.tax_rate;
            const tax = r > 0 ? lineNet * (r / (100 + r)) : 0;
            return s + (lineNet - tax);
          }, 0);
        }
        return items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      },
      taxTotal: () => {
        const mode = get().taxMode;
        if (mode === "off") return 0;
        return get().items.reduce((s, i) => {
          const lineNet = Math.max(0, i.unit_price * i.quantity - i.discount);
          const r = i.tax_rate;
          if (r <= 0) return s;
          if (mode === "inclusive") return s + lineNet * (r / (100 + r));
          // exclusive
          return s + lineNet * (r / 100);
        }, 0);
      },
      cartDiscountAmount: () => {
        const lineSubtotal = get().items.reduce((s, i) => s + (i.unit_price * i.quantity - i.discount), 0);
        if (get().discountType === "percent") return Math.min(lineSubtotal, lineSubtotal * (get().discount / 100));
        return Math.min(lineSubtotal, get().discount);
      },
      grandTotal: () => {
        const items = get().items;
        const mode = get().taxMode;
        const lineSub = items.reduce((s, i) => s + (i.unit_price * i.quantity - i.discount), 0);
        const cartDisc = get().cartDiscountAmount();
        const tip = get().tip || 0;
        const serviceCharge = get().serviceChargeAmount || 0;

        if (mode === "off") {
          return Math.max(0, lineSub - cartDisc + tip + serviceCharge);
        }
        if (mode === "inclusive") {
          // Tax already inside lineSub. Cart-level discount + tip + service charge are tax-free additions.
          return Math.max(0, lineSub - cartDisc + tip + serviceCharge);
        }
        // exclusive — add tax on top
        const tax = items.reduce((s, i) => {
          const lineNet = Math.max(0, i.unit_price * i.quantity - i.discount);
          const lineShare = lineSub > 0 ? lineNet / lineSub : 0;
          const lineAfterCartDisc = Math.max(0, lineNet - cartDisc * lineShare);
          return s + (lineAfterCartDisc * i.tax_rate / 100);
        }, 0);
        return Math.max(0, lineSub - cartDisc + tax + tip + serviceCharge);
      },
    }),
    {
      name: "omnix-cart",
      partialize: (s) => ({
        items: s.items,
        customerId: s.customerId,
        discount: s.discount,
        discountType: s.discountType,
        tip: s.tip,
        tipEmployeeId: s.tipEmployeeId,
        serviceChargeAmount: s.serviceChargeAmount,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        sourceLabel: s.sourceLabel,
        revision: s.revision,
      }),
    },
  ),
);

if (typeof window !== "undefined") {
  import("@tauri-apps/api/event").then((mod) => {
    emitCartUpdate = (state) => { mod.emit("cart:updated", state).catch(() => {}); };

    mod.listen<CartPayload>("cart:updated", (event) => {
      const incoming = event.payload;
      if (!incoming) return;
      const current = useCartStore.getState();
      if ((incoming.revision || 0) <= (current.revision || 0)) return;
      applyingRemote = true;
      useCartStore.setState({
        items: incoming.items || [],
        customerId: incoming.customerId ?? null,
        discount: incoming.discount || 0,
        discountType: incoming.discountType || "amount",
        promoId: incoming.promoId ?? null,
        promoLabel: incoming.promoLabel ?? null,
        tip: incoming.tip || 0,
        tipEmployeeId: incoming.tipEmployeeId ?? null,
        serviceChargeAmount: incoming.serviceChargeAmount || 0,
        taxMode: incoming.taxMode ?? "exclusive",
        sourceType: incoming.sourceType ?? null,
        sourceId: incoming.sourceId ?? null,
        sourceLabel: incoming.sourceLabel ?? null,
        revision: incoming.revision || 0,
      });
      applyingRemote = false;
    }).catch(() => {});
  }).catch(() => {});
}

useCartStore.subscribe(() => {
  if (applyingRemote) return;
  scheduleBroadcast();
});
