import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RouteContextBar } from "@/components/shared/mobile-route-context";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const ownedPageFiles = [
  "dashboard", "hub-sales", "sales-history", "sale-detail", "returns",
  "customers", "customer-detail", "hub-inventory", "inventory", "product-detail", "stock",
  "stock-take", "stock-transfers", "stock-transfer-new", "stock-transfer-detail",
  "suppliers", "supplier-detail", "purchase-orders", "goods-receipts",
  "invoicing", "invoice-new", "invoice-detail", "recurring-invoices",
  "expenses", "petty-cash", "hub-banking", "banking", "banking-detail",
  "bank-reconciliation", "cash-register", "approvals", "hub-people", "employees",
  "employee-detail", "attendance", "leave", "audit", "hub-analytics", "reports-index",
  "reports", "inventory-reports", "zreport", "daily-operations", "pnl", "vat-report",
  "chart-of-accounts", "trial-balance", "balance-sheet", "cash-flow-statement",
  "period-close", "fixed-assets", "debit-notes",
] as const;

const ownedPages = ownedPageFiles.map((name) => source(`src/pages/${name}.tsx`));
const mobileContext = source("src/components/shared/mobile-route-context.tsx");
const manifest = source("docs/MOBILE_ROUTE_OWNERSHIP.md");

afterEach(() => cleanup());

describe("mobile core route context", () => {
  it("shows active branch and explicit offline local-mode text", () => {
    const { container } = render(<RouteContextBar branchName="Westlands" online={false} />);
    expect(screen.getByText("Westlands")).toBeDefined();
    expect(screen.getByText("Offline · local mode")).toBeDefined();
    expect(container.firstElementChild?.className).toContain("min-h-11");
    expect(container.firstElementChild?.className).toContain("lg:hidden");
  });

  it("uses text, not colour alone, for online state", () => {
    render(<RouteContextBar branchName="Main Branch" online />);
    expect(screen.getByText("Online")).toBeDefined();
  });
});

describe("full task-17 Android ownership", () => {
  it("mounts the shared Android operational context on every owned page", () => {
    for (const [index, page] of ownedPages.entries()) {
      expect(page, ownedPageFiles[index]).toContain("<MobileRouteContext />");
    }
  });

  it("provides labelled cards, bounded search/pagination, touch, keyboard, and safe-area behavior", () => {
    expect(mobileContext).toContain("const MOBILE_TABLE_PAGE_SIZE = 25");
    expect(mobileContext).toContain("data-mobile-label");
    expect(mobileContext).toContain("Search records…");
    expect(mobileContext).toContain("No matching records. Clear the search");
    expect(mobileContext).toContain("min-height: 44px");
    expect(mobileContext).toContain("font-size: 16px");
    expect(mobileContext).toContain("env(safe-area-inset-bottom)");
    expect(mobileContext).toContain("max-width: 1023px");
  });

  it("retains purpose-built paged card/table pairs for primary high-volume lists", () => {
    const cases = [
      [source("src/pages/sales-history.tsx"), "sales"],
      [source("src/pages/customers.tsx"), "customers"],
      [source("src/pages/inventory.tsx"), "inventory"],
      [source("src/pages/suppliers.tsx"), "suppliers"],
    ] as const;
    for (const [page, marker] of cases) {
      expect(page).toContain(`data-mobile-list="${marker}"`);
      expect(page).toContain(`data-desktop-table="${marker}"`);
      expect(page).toContain("<PaginationBar list=");
    }
  });

  it("uses searchable controls for owned growth lists", () => {
    for (const file of ["stock", "leave", "employees", "expenses", "inventory", "product-detail"]) {
      expect(source(`src/pages/${file}.tsx`), file).toContain("<Combobox");
    }
    expect(source("src/pages/purchase-orders.tsx")).toContain("<EntityCombobox");
  });

  it("keeps domain permission gates and local-first share behavior", () => {
    const dashboard = source("src/pages/dashboard.tsx");
    const customers = source("src/pages/customers.tsx");
    const inventory = source("src/pages/inventory.tsx");
    const suppliers = source("src/pages/suppliers.tsx");
    expect(dashboard).toContain('hasPermission(user, "reports.view")');
    expect(customers).toContain('hasPermission(user, "customers.payment")');
    expect(inventory).toContain('hasPermission(user, "inventory.bulk_edit")');
    expect(inventory).toContain('hasPermission(user, "purchase_orders.create")');
    expect(suppliers).toContain('hasPermission(user, "suppliers.payment")');
    const share = source("src/components/share-doc-menu.tsx");
    expect(share).toContain("navigator.onLine");
    expect(share).toContain("Download or print the PDF now");
  });

  it("uses active-country money, account currency, phone, and tax labels", () => {
    expect(source("src/pages/banking.tsx")).toContain("currencyCode(countryCode)");
    expect(source("src/pages/customers.tsx")).toContain("phonePlaceholder(countryCode)");
    expect(source("src/pages/suppliers.tsx")).toContain("phonePlaceholder(countryCode)");
    const vat = source("src/pages/vat-report.tsx");
    expect(vat).toContain("taxLabel(countryCode)");
    expect(vat).toContain("countryProfile?.defaultTaxRate");
    expect(vat).toContain('countryCode === "KE"');
  });

  it("documents the exact routes and prohibited boundaries", () => {
    for (const route of [
      "/sales/:id", "/returns/new", "/customers/:id", "/inventory/products/:id",
      "/stock-take/:id", "/stock-transfers/:id", "/suppliers/:id", "/purchase-orders/:id",
      "/invoicing/quotation/:id", "/banking/:id/reconcile", "/hr/employees/:id",
      "/reports/daily-operations", "/accounting/balance-sheet",
    ]) expect(manifest).toContain(`\`${route}\``);
    expect(manifest).toContain("No files under `src/components/layout`, `src/App.tsx`");
    expect(manifest).toContain("POS routes, business Settings pages");
    expect(manifest).toContain("vertical routes are not implemented");
    expect(manifest).not.toContain("exactly six core routes");
  });
});
