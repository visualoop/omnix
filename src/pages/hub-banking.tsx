/**
 * Banking hub — /banking-hub
 *
 * Bank accounts, petty cash, expenses. Direct routes still work.
 */
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { Wallet, Coins, Receipt } from "lucide-react";
import { HubLayout } from "@/components/layout/hub-layout";
import { BankingPage } from "@/pages/banking";
import { PettyCashPage } from "@/pages/petty-cash";
import { ExpensesPage } from "@/pages/expenses";

export function BankingHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Finance"
      title="Banking"
      description="Money in, money out — accounts, petty cash, and expenses."
      tabs={[
        { id: "accounts", label: "Accounts", icon: Wallet, component: BankingPage, permission: "banking.view" },
        { id: "petty-cash", label: "Petty cash", icon: Coins, component: PettyCashPage, permission: "petty_cash.use" },
        { id: "expenses", label: "Expenses", icon: Receipt, component: ExpensesPage, permission: "expenses.view" },
      ]}
      hasPermission={has}
    />
  );
}
