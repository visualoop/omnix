import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/services/sales";

// Cart sync via Tauri events — keeps customer-display window in sync with POS window.
// Falls back gracefully when not running in Tauri.
let emitCartUpdate: ((state: any) => void) | null = null;
if (typeof window !== "undefined") {
  import("@tauri-apps/api/event").then((mod) => {
    emitCartUpdate = (state) => {
      mod.emit("cart:updated", state).catch(() => {});
    };

    // Other windows subscribe to receive updates
    mod.listen<any>("cart:updated", (event) => {
      const incoming = event.payload;
      if (!incoming) return;
      // Update without re-emitting
      const current = useCartStore.getState();
      if (
        current.items !== incoming.items ||
        current.discount !== incoming.discount ||
        current.tip !== incoming.tip ||
        current.customerId !== incoming.customerId
      ) {
        useCartStore.setState({
          items: incoming.items || [],
          customerId: incoming.customerId ?? null,
          discount: incoming.discount || 0,
          discountType: incoming.discountType || "amount",
          tip: incoming.tip || 0,
          tipEmployeeId: incoming.tipEmployeeId ?? null,
        });
      }
    }).catch(() => {});
  }).catch(() => {});
}

function broadcast() {
  if (!emitCartUpdate) return;
  const s = useCartStore.getState();
  emitCartUpdate({
    items: s.items,
    customerId: s.customerId,
    discount: s.discount,
    discountType: s.discountType,
    tip: s.tip,
    tipEmployeeId: s.tipEmployeeId,
  });
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  discountType: "amount" | "percent";
  tip: number;
  tipEmployeeId: string | null;
  addItem: (product: { id: string; name: string; selling_price: number; tax_rate: number }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setLineDiscount: (id: string, discount: number) => void;
  setDiscount: (amount: number, type?: "amount" | "percent") => void;
  setTip: (amount: number, employeeId?: string | null) => void;
  setCustomer: (id: string | null) => void;
  loadSnapshot: (items: CartItem[], discount: number, customerId: string | null) => void;
  clear: () => void;
  subtotal: () => number;
  taxTotal: () => number;
  cartDiscountAmount: () => number;
  grandTotal: () => number;
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

  addItem: (product) => {
    const items = get().items;
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      set({
        items: items.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price }
            : i
        ),
      });
    } else {
      set({
        items: [...items, {
          id: crypto.randomUUID(),
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: product.selling_price,
          discount: 0,
          tax_rate: product.tax_rate,
          total: product.selling_price,
        }],
      });
    }
  },

  removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

  updateQty: (id, qty) => {
    if (qty <= 0) { get().removeItem(id); return; }
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, quantity: qty, total: qty * i.unit_price } : i
      ),
    });
  },

  setLineDiscount: (id, discount) => {
    set({
      items: get().items.map((i) => {
        if (i.id !== id) return i;
        const lineSubtotal = i.unit_price * i.quantity;
        const cappedDiscount = Math.max(0, Math.min(lineSubtotal, discount));
        return { ...i, discount: cappedDiscount, total: lineSubtotal - cappedDiscount };
      }),
    });
  },

  setDiscount: (amount, type = "amount") => set({ discount: amount, discountType: type }),
  setTip: (amount, employeeId) => set({ tip: amount, tipEmployeeId: employeeId ?? null }),
  setCustomer: (id) => set({ customerId: id }),
  loadSnapshot: (items, discount, customerId) => set({ items, discount, customerId }),
  clear: () => set({ items: [], customerId: null, discount: 0, discountType: "amount", tip: 0, tipEmployeeId: null }),

  subtotal: () => get().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  taxTotal: () => {
    return get().items.reduce((s, i) => {
      const lineNet = (i.unit_price * i.quantity) - i.discount;
      return s + (lineNet * i.tax_rate / 100);
    }, 0);
  },
  cartDiscountAmount: () => {
    const lineSubtotal = get().items.reduce((s, i) => s + (i.unit_price * i.quantity - i.discount), 0);
    if (get().discountType === "percent") {
      return Math.min(lineSubtotal, lineSubtotal * (get().discount / 100));
    }
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
    return taxableBase + tax + (get().tip || 0);
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
      }),
    }
  )
);


// Subscribe to all cart changes and broadcast to other windows.
// Debounced so we don't fire on every key press during the same render frame.
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
useCartStore.subscribe(() => {
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(broadcast, 50);
});
