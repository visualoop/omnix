import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResponsiveActions } from "@/components/responsive/responsive-actions";
import { ResponsivePage } from "@/components/responsive/responsive-page";

const buttonSelector = "[data-slot='button']";

afterEach(cleanup);

describe("ResponsivePage", () => {
  it.each([
    [undefined, "max-w-[1280px]"],
    ["content", "max-w-5xl"],
    ["full", "max-w-none"],
  ] as const)("applies the %s width contract", (width, expectedClass) => {
    render(
      <ResponsivePage width={width} data-testid="page">
        Page content
      </ResponsivePage>,
    );

    const page = screen.getByTestId("page");
    expect(page.className).toContain(expectedClass);
    expect(page.className).toContain("sm:px-6");
    expect(page.className).toContain("lg:px-0");
  });

  it("allows a caller to extend the layout without dropping safe-area spacing", () => {
    render(<ResponsivePage className="space-y-5" data-testid="page" />);

    const page = screen.getByTestId("page");
    expect(page.className).toContain("space-y-5");
    expect(page.className).toContain("env(safe-area-inset-left)");
    expect(page.className).toContain("env(safe-area-inset-bottom)");
  });
});

describe("ResponsiveActions", () => {
  it("stacks full-width phone actions and restores compact desktop actions", () => {
    render(
      <ResponsiveActions data-testid="actions">
        <button data-slot="button">Primary</button>
        <button data-slot="button">Secondary</button>
      </ResponsiveActions>,
    );

    const actions = screen.getByTestId("actions");
    expect(actions.className).toContain("flex-col");
    expect(actions.className).toContain("sm:flex-row");
    expect(actions.className).toContain("sm:w-auto");
    expect(actions.querySelectorAll(buttonSelector)).toHaveLength(2);
  });
});
