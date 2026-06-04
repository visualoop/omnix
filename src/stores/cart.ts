import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/services/sales";

interface CartProduct {
  id: string;
  name: string;
  selling_price: number;
  tax_rate: number;
}

interface CartPayload {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  discountType: "amount" | "percent";
  tip: number;
  tipEmployeeId: string | null;
  serviceChargeAmount: number;
  sourceType: "hospitality_order" | "prescription" | null;
  sourceId: string | null;
  sourceLabel: string | null;
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
    tip: s.tip,
    tipEmployeeId: s.tipEmployeeId,
    serviceChargeAmount: s.serviceChargeAmount,
    sourceType: s.sourceType,
    sourceId: s.sourceId,
    sourceLabel: s.sourceLabel,
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
  tip: number;
  tipEmployeeId: string | null;
  serviceChargeAmount: number;
  sourceType: "hospitality_order" | "prescription" | null;
  sourceId: string | null;
  sourceLabel: string | null;
  revision: number;
  addItem: (product: CartProduct) => void;
  addItemWithQuantity: (product: CartProduct, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setLineDiscount: (id: string, discount: number) => void;
  setDiscount: (amount: number, type?: "amount" | "percent") => void;
  setTip: (amount: number, employeeId?: string | null) => void;
  setServiceCharge: (amount: number) => void;
  setCustomer: (id: string | null) => void;
  setSource: (source: { type: "hospitality_order" | "prescription"; id: string; label: string } | null) => void;
  loadSnapshot: (
    items: CartItem[],
    discount: number,
    customerId: string | null,
    options?: {
      tip?: number;
      tipEmployeeId?: string | null;
      serviceChargeAmount?: number;
      source?: { type: "hospitality_order" | "prescription"; id: string; label: string } | null;
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
      tip: 0,
      tipEmployeeId: null,
      serviceChargeAmount: 0,
      sourceType: null,
      sourceId: null,
      sourceLabel: null,
      revision: 0,

      addItem: (product) => get().addItemWithQuantity(product, 1),

      addItemWithQuantity: (product, quantity) => {
        const qty = Math.max(1, quantity || 1);
        set((state) => {
          const existing = state.items.find((i) => i.product_id === product.id && i.unit_price === product.selling_price);
          if (existing) {
            return {
              items: state.items.map((i) => (i.id === existing.id ? withQuantity(i, i.quantity + qty) : i)),
              revision: nextRevision(state),
            };
          }

          const item: CartItem = {
            id: crypto.randomUUID(),
            product_id: product.id,
            name: product.name,
            quantity: qty,
            unit_price: product.selling_price,
            discount: 0,
            tax_rate: product.tax_rate,
            total: product.selling_price * qty,
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
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? withQuantity(i, qty) : i)),
          revision: nextRevision(state),
        }));
      },

      setLineDiscount: (id, discount) => set((state) => ({
        items: state.items.map((i) => {
          if (i.id !== id) return i;
          const cappedDiscount = Math.max(0, Math.min(i.unit_price * i.quantity, discount));
          return { ...i, discount: cappedDiscount, total: lineTotal({ ...i, discount: cappedDiscount }) };
        }),
        revision: nextRevision(state),
      })),

      setDiscount: (amount, type = "amount") => set((state) => ({ discount: amount, discountType: type, revision: nextRevision(state) })),
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
          tip: 0,
          tipEmployeeId: null,
          serviceChargeAmount: 0,
          sourceType: null,
          sourceId: null,
          sourceLabel: null,
          revision: nextRevision(state),
        }));
        broadcastNow();
      },

      subtotal: () => get().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
      taxTotal: () => get().items.reduce((s, i) => {
        const lineNet = i.unit_price * i.quantity - i.discount;
        return s + (lineNet * i.tax_rate / 100);
      }, 0),
      cartDiscountAmount: () => {
        const lineSubtotal = get().items.reduce((s, i) => s + (i.unit_price * i.quantity - i.discount), 0);
        if (get().discountType === "percent") return Math.min(lineSubtotal, lineSubtotal * (get().discount / 100));
        return Math.min(lineSubtotal, get().discount);
      },
      grandTotal: () => {
        const items = get().items;
        const lineSub = items.reduce((s, i) => s + (i.unit_price * i.quantity - i.discount), 0);
        const cartDisc = get().cartDiscountAmount();
        const taxableBase = lineSub - cartDisc;
        const tax = items.reduce((s, i) => {
          const lineNet = i.unit_price * i.quantity - i.discount;
          const lineShare = lineSub > 0 ? lineNet / lineSub : 0;
          const lineAfterCartDisc = lineNet - cartDisc * lineShare;
          return s + (lineAfterCartDisc * i.tax_rate / 100);
        }, 0);
        return taxableBase + tax + (get().tip || 0) + (get().serviceChargeAmount || 0);
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
        tip: incoming.tip || 0,
        tipEmployeeId: incoming.tipEmployeeId ?? null,
        serviceChargeAmount: incoming.serviceChargeAmount || 0,
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
