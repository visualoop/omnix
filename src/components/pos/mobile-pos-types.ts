import type { CartItem } from "@/services/sales";

export interface MobilePosProduct {
  id: string;
  name: string;
  selling_price: number;
  stock_qty?: number;
  reorder_level?: number;
  category_name?: string | null;
  image_path?: string | null;
}

export interface MobilePosCategory {
  id: string;
  name: string;
  product_count?: number;
}

export interface MobilePosAccent {
  pay: string;
  accentText: string;
  accentBg: string;
  accentRing: string;
  isPharmacy: boolean;
}

export type MobileCartItem = CartItem;
