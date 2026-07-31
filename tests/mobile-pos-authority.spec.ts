import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("mobile POS sale authority boundary", () => {
  it("delegates completion to PaymentModal without duplicating completeSale", () => {
    const adaptiveFiles = [
      "src/components/pos/MobilePosShell.tsx",
      "src/components/pos/MobilePaymentFlow.tsx",
      "src/components/pos/CartSheet.tsx",
      "src/components/pos/MobileProductBrowser.tsx",
      "src/pages/pos-sale.tsx",
    ];

    for (const file of adaptiveFiles) {
      expect(read(file), `${file} must not become a sale authority`).not.toMatch(/completeSale\s*\(/);
      expect(read(file), `${file} must not construct final tenders`).not.toMatch(/buildFinalTenders|PaymentEntry\[|method_id\s*:/);
    }

    const authoritativeModal = read("src/components/pos/payment-modal.tsx");
    expect(authoritativeModal.match(/completeSale\s*\(/g)).toHaveLength(1);
    expect(authoritativeModal.match(/buildFinalTenders\s*\(/g)).toHaveLength(1);
    expect(read("src/components/pos/MobilePaymentFlow.tsx")).toContain("onContinueToAuthoritativePayment");
  });
});
