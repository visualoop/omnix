import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartSummaryBar } from "@/components/pos/CartSummaryBar";
import { MobileProductBrowser } from "@/components/pos/MobileProductBrowser";
import { MobileSearchHeader } from "@/components/pos/MobileSearchHeader";

afterEach(() => cleanup());

describe("mobile POS search and scan", () => {
  it("changes, clears, and requests scan from touch-sized controls", () => {
    const onChange = vi.fn();
    const onScanRequest = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<MobileSearchHeader value="milk" inputRef={inputRef} onChange={onChange} onScanRequest={onScanRequest} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "tea" } });
    expect(onChange).toHaveBeenCalledWith("tea");
    fireEvent.click(screen.getByRole("button", { name: "Clear product search" }));
    expect(onChange).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByRole("button", { name: "Scan a product barcode" }));
    expect(onScanRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Scan a product barcode" }).className).toContain("size-12");
  });
});

describe("mobile POS product browser", () => {
  it("switches categories and only adds in-stock products", () => {
    const onSelectCategory = vi.fn();
    const onAddProduct = vi.fn();
    render(
      <MobileProductBrowser
        formFactor="phone"
        search=""
        activeCategoryId={null}
        categories={[{ id: "food", name: "Food", product_count: 2 }]}
        products={[
          { id: "tea", name: "Kenyan tea", selling_price: 120, stock_qty: 8, category_name: "Food" },
          { id: "milk", name: "Fresh milk", selling_price: 80, stock_qty: 0, category_name: "Food" },
        ]}
        onSelectCategory={onSelectCategory}
        onAddProduct={onAddProduct}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Food, 2 products" }));
    expect(onSelectCategory).toHaveBeenCalledWith("food");
    fireEvent.click(screen.getByRole("button", { name: /Kenyan tea/ }));
    expect(onAddProduct).toHaveBeenCalledWith(expect.objectContaining({ id: "tea" }));
    expect(screen.getByRole("button", { name: /Fresh milk/ }).hasAttribute("disabled")).toBe(true);
  });
});

describe("mobile POS cart summary", () => {
  it("announces units and total and opens the cart", () => {
    const onOpen = vi.fn();
    const buttonRef = createRef<HTMLButtonElement>();
    render(<CartSummaryBar buttonRef={buttonRef} itemCount={2} unitCount={3} total={450} onOpen={onOpen} />);

    const trigger = screen.getByRole("button", { name: /Open cart, 3 units/ });
    expect(trigger.className).toContain("min-h-14");
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
