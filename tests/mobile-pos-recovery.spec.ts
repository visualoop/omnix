import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReceiptShareText, shareReceipt } from "@/components/pos/receipt-share";
import { selectPersistedCartState, useCartStore } from "@/stores/cart";
import type { ReceiptData } from "@/services/receipt";

const receipt: ReceiptData = {
  business: { name: "Westlands Pharmacy" },
  sale: { sale_number: 42, created_at: "2026-07-31T10:00:00.000Z", cashier_name: "Amina" },
  items: [{ name: "Paracetamol", quantity: 2, unit_price: 50, total: 100 }],
  subtotal: 100,
  discount: 0,
  tax: 0,
  total: 100,
  payments: [{ method_name: "Cash", amount: 100 }],
  customer: { name: "Jane" },
  kra: { pin: "P000000000A", invoice_no: "KRA-42", internal_control_no: "CU-42" },
  footer: "Thank you",
};

afterEach(() => {
  vi.restoreAllMocks();
  useCartStore.getState().clear();
  useCartStore.setState({ taxMode: "exclusive", quoteMode: false });
});

describe("mobile POS background recovery", () => {
  it("persists every sale-critical field across Android process recreation", () => {
    useCartStore.setState({
      items: [{
        id: "line-1",
        product_id: "product-1",
        name: "Serialized drill · SN DR-100",
        quantity: 1,
        unit_price: 12_000,
        discount: 500,
        tax_rate: 16,
        total: 11_500,
        variant_id: "variant-1",
        equipment_unit_id: "unit-1",
        serial: "DR-100",
      }],
      customerId: "customer-1",
      discount: 10,
      discountType: "percent",
      promoId: "promo-1",
      promoLabel: "Member week",
      tip: 100,
      tipEmployeeId: "employee-1",
      serviceChargeAmount: 250,
      taxMode: "inclusive",
      sourceType: "prescription",
      sourceId: "rx-1",
      sourceLabel: "RX-0001",
      quoteMode: true,
      revision: 8,
    });

    const persisted = selectPersistedCartState(useCartStore.getState());
    expect(persisted).toMatchObject({
      customerId: "customer-1",
      promoId: "promo-1",
      promoLabel: "Member week",
      taxMode: "inclusive",
      sourceType: "prescription",
      sourceId: "rx-1",
      quoteMode: true,
      tip: 100,
      serviceChargeAmount: 250,
    });
    expect(persisted.items[0]).toMatchObject({ variant_id: "variant-1", equipment_unit_id: "unit-1", serial: "DR-100" });
  });
});

describe("mobile POS receipt sharing", () => {
  it("formats a concise receipt with customer and KRA references", () => {
    expect(buildReceiptShareText(receipt)).toContain("Westlands Pharmacy\nReceipt #42");
    expect(buildReceiptShareText(receipt)).toContain("Customer: Jane");
    expect(buildReceiptShareText(receipt)).toContain("KRA invoice: KRA-42");
  });

  it("uses Android Web Share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    await expect(shareReceipt(receipt)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("#42") }));
  });

  it("copies the receipt offline when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await expect(shareReceipt(receipt)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Receipt #42"));
  });
});
