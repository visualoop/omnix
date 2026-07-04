/**
 * Variant-specific placeholder strings + sample-data hints.
 *
 * Centralised here so every form that asks for product / customer /
 * category names speaks the right trade vocabulary. Pro stays generic
 * (since Pro can be any trade); Dawa / Retail / Hospitality / Hardware
 * each use their trade's typical naming.
 *
 * Add a new variant or enrich an existing one in ONE place.
 */
import { VARIANT, type Variant } from "./variant";

export interface VariantPlaceholders {
  productName: string;
  productSku: string;
  productCategory: string;
  productDescription: string;
  customerName: string;
  customerEmail: string;
  inventorySearch: string;
  promotionName: string;
  supplierName: string;
}

export const VARIANT_PLACEHOLDERS: Record<Variant, VariantPlaceholders> = {
  pro: {
    productName: "e.g. Coca Cola 500ml",
    productSku: "e.g. SKU-1001",
    productCategory: "e.g. Beverages",
    productDescription: "Optional product details, e.g. ingredients, brand…",
    customerName: "e.g. Jane Mwangi",
    customerEmail: "jane@example.co.ke",
    inventorySearch: "Search products, SKU, barcode…",
    promotionName: "e.g. Festive 10% off",
    supplierName: "e.g. Bidco Africa Ltd",
  },
  dawa: {
    productName: "e.g. Panadol Extra 500mg, Cetrizine 10mg, Amoxiclav 625mg",
    productSku: "e.g. PMD-PARA-500",
    productCategory: "e.g. Analgesics, Antibiotics, Antihistamines",
    productDescription: "Dose, indication, side-effects (printed on label)…",
    customerName: "e.g. Mwangi Wanjiru (patient)",
    customerEmail: "patient@example.co.ke",
    inventorySearch: "Search drugs, batch, barcode, manufacturer…",
    promotionName: "e.g. SHA member discount",
    supplierName: "e.g. Pyramid Pharma, Surgipharm, Laborex",
  },
  retail: {
    productName: "e.g. Lifebuoy Soap 175g, Bic Pen Blue, Maize Flour 2kg",
    productSku: "e.g. RET-SOAP-LIFE-175",
    productCategory: "e.g. Personal care, Stationery, Groceries",
    productDescription: "Brand, size, country of origin, packaging…",
    customerName: "e.g. Mama Wanjiru",
    customerEmail: "wanjiru@example.co.ke",
    inventorySearch: "Search products, brand, barcode…",
    promotionName: "e.g. Buy 2 get 1 free",
    supplierName: "e.g. Bidco, Unilever, Brookside",
  },
  hospitality: {
    productName: "e.g. Maize Flour 2kg, Sukuma bunch, Tomatoes, Tusker Lager 500ml, Cooking Oil 5L",
    productSku: "e.g. ING-UNGA-2KG",
    productCategory: "e.g. Grains, Vegetables, Meat, Beverages, Cleaning",
    productDescription: "Supplier, storage temperature, shelf life, allergens…",
    customerName: "e.g. Walk-in / Suite 204 / Mr Otieno",
    customerEmail: "guest@example.co.ke",
    inventorySearch: "Search ingredients, brand, barcode…",
    promotionName: "e.g. Happy Hour, Lunch Combo",
    supplierName: "e.g. KCB Wines & Spirits, Zucchini Greengrocers",
  },
  hardware: {
    productName: "e.g. Bag of Cement Bamburi 50kg, Steel Bar Y12, 2-inch Nails",
    productSku: "e.g. HW-CEM-BAMB-50",
    productCategory: "e.g. Cement, Steel & rebar, Plumbing, Electrical",
    productDescription: "Specs, grade, dimensions, country of origin…",
    customerName: "e.g. Acme Construction Ltd / Fundi Mwangi",
    customerEmail: "buyer@example.co.ke",
    inventorySearch: "Search parts, spec, contractor account…",
    promotionName: "e.g. Bulk discount 100+ bags",
    supplierName: "e.g. Bamburi Cement, Mabati Rolling Mills",
  },
};

/** Convenience accessor — placeholders for the build-time variant. */
export const PLACEHOLDERS: VariantPlaceholders = VARIANT_PLACEHOLDERS[VARIANT];
