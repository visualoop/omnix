import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobilePaymentFlow } from "@/components/pos/MobilePaymentFlow";
import { MobileQuantitySheet } from "@/components/pos/MobileQuantitySheet";
import type { MobileCartItem } from "@/components/pos/mobile-pos-types";

vi.mock("@/components/ui/sheet", () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Sheet: Wrapper,
    SheetContent: Wrapper,
    SheetDescription: Wrapper,
    SheetHeader: Wrapper,
    SheetTitle: Wrapper,
  };
});

vi.mock("@/components/pos/MobileCustomerPicker", () => ({
  MobileCustomerPicker: () => <button type="button">Walk-in customer</button>,
}));

afterEach(() => cleanup());

describe("mobile POS payment authority", () => {
  it("reviews the sale before delegating to the authoritative payment modal", () => {
    const continueToPayment = vi.fn();
    render(
      <MobilePaymentFlow
        open
        itemCount={2}
        unitCount={3}
        total={450}
        branchName="Westlands"
        syncLabel="Branch sync online"
        shiftOpen
        onOpenChange={vi.fn()}
        onContinueToAuthoritativePayment={continueToPayment}
      />,
    );

    expect(screen.getByText("Westlands controls this sale")).toBeTruthy();
    expect(screen.getByText("Branch sync online")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(continueToPayment).not.toHaveBeenCalled();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("M-Pesa")).toBeTruthy();
    expect(screen.getByText("Split payment")).toBeTruthy();
    expect(screen.getByText("Customer credit")).toBeTruthy();
    expect(screen.getByText("Insurance")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    expect(continueToPayment).toHaveBeenCalledOnce();
  });

  it("does not delegate payment while the cash shift is closed", () => {
    render(
      <MobilePaymentFlow
        open
        itemCount={1}
        unitCount={1}
        total={120}
        branchName="Local branch"
        syncLabel="Local sales ready"
        shiftOpen={false}
        onOpenChange={vi.fn()}
        onContinueToAuthoritativePayment={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Continue to payment" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("mobile POS quantity delegation", () => {
  it("caps typed quantity at stock and returns the confirmed value", () => {
    const item: MobileCartItem = {
      id: "line-1",
      product_id: "product-1",
      name: "Kenyan tea",
      quantity: 1,
      unit_price: 120,
      discount: 0,
      tax_rate: 16,
      total: 120,
      stock_qty: 3,
    };
    const onConfirm = vi.fn();

    render(
      <MobileQuantitySheet
        open
        item={item}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Update quantity" }));
    expect(onConfirm).toHaveBeenCalledWith(3);
  });
});
