import { create } from "zustand";
import type { CartItem } from "@/services/sales";

interface CartState {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  addItem: (product: { id: string; name: string; selling_price: number; tax_rate: number }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setDiscount: (amount: number) => void;
  setCustomer: (id: string | null) => void;
  clear: () => void;
  subtotal: () => number;
  taxTotal: () => number;
  grandTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  discount: 0,

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

  setDiscount: (amount) => set({ discount: amount }),
  setCustomer: (id) => set({ customerId: id }),
  clear: () => set({ items: [], customerId: null, discount: 0 }),

  subtotal: () => get().items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  taxTotal: () => get().items.reduce((s, i) => s + (i.unit_price * i.quantity * i.tax_rate / 100), 0),
  grandTotal: () => {
    const st = get().subtotal();
    const tax = get().taxTotal();
    return st - get().discount + tax;
  },
}));
