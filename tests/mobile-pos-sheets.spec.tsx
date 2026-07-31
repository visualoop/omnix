import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscountDialog } from "@/components/pos/discount-dialog";
import { TipDialog } from "@/components/pos/tip-dialog";
import { useCartStore } from "@/stores/cart";

vi.mock("@/components/ui/dialog", () => {
  const Root = ({ open, children }: { open?: boolean; children?: ReactNode }) => open ? <>{children}</> : null;
  const Content = ({ children, className }: { children?: ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>;
  const Wrapper = ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>;
  return { Dialog: Root, DialogContent: Content, DialogFooter: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper };
});

vi.mock("@/components/ui/touch-keypad", () => ({ TouchKeypad: () => null }));
vi.mock("@/stores/density", () => ({ useIsTouch: () => false }));
vi.mock("@/lib/db", () => ({ query: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/employees", () => ({ listEmployees: vi.fn().mockResolvedValue([]) }));

afterEach(() => {
  cleanup();
  useCartStore.getState().clear();
});

function seedCart() {
  useCartStore.getState().addItemWithQuantity({
    id: "tea",
    name: "Kenyan tea",
    selling_price: 100,
    tax_rate: 0,
    stock_qty: 10,
  });
}

describe("mobile POS adjustment sheets", () => {
  it("caps a mobile amount discount at the cart subtotal", () => {
    seedCart();
    render(<DiscountDialog open onClose={vi.fn()} formFactor="phone" />);

    expect(screen.getByTestId("dialog-content").className).toContain("h-[100dvh]");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Discount amount" }), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply discount" }));

    expect(useCartStore.getState().discount).toBe(100);
    expect(useCartStore.getState().discountType).toBe("amount");
  });

  it("renders tip presets and full-height touch actions on mobile", async () => {
    seedCart();
    render(<TipDialog open onClose={vi.fn()} formFactor="phone" />);

    expect(screen.getByTestId("dialog-content").className).toContain("h-[100dvh]");
    const apply = screen.getByRole("button", { name: "Apply tip" });
    expect(apply.className).toContain("h-12");
    fireEvent.click(screen.getByRole("button", { name: /10%/ }));
    fireEvent.click(apply);
    expect(useCartStore.getState().tip).toBe(10);
  });
});
