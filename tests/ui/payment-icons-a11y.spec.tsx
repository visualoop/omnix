/**
 * Accessibility assertions for the payment-brand icons.
 *
 * Every brand icon must expose an accessible name (aria-label) + role
 * so screen readers announce "M-Pesa" / "Paystack" etc. at the till.
 * Uses vitest-axe (axe-core) — the engine installed for the v1 a11y gate.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import {
  MpesaIcon, PaystackIcon, VisaIcon, MastercardIcon,
  CashIcon, CardIcon, BankIcon, InsuranceIcon, CreditIcon,
} from "@/components/icons/payment-brands";

expect.extend(matchers);

const ICONS = [
  ["MpesaIcon", MpesaIcon, "M-Pesa"],
  ["PaystackIcon", PaystackIcon, "Paystack"],
  ["VisaIcon", VisaIcon, "Visa"],
  ["MastercardIcon", MastercardIcon, "Mastercard"],
  ["CashIcon", CashIcon, "Cash"],
  ["CardIcon", CardIcon, "Card"],
  ["BankIcon", BankIcon, "Bank"],
  ["InsuranceIcon", InsuranceIcon, "Insurance"],
  ["CreditIcon", CreditIcon, "Credit account"],
] as const;

describe("payment brand icon accessibility", () => {
  for (const [name, Icon, label] of ICONS) {
    it(`${name} exposes the accessible name "${label}"`, () => {
      const { getByLabelText } = render(<Icon />);
      expect(getByLabelText(label)).toBeTruthy();
    });

    it(`${name} has no axe violations`, async () => {
      const { container } = render(<Icon />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
