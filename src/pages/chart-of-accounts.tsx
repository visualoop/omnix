import { useEffect, useState } from "react";
import { ListNumbers } from "@phosphor-icons/react";
import { listAccounts, type Account, type AccountType } from "@/services/gl";

import { BackButton } from "@/components/ui/back-button";
const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};
const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

export function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <BackButton fallback="/reports" />
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ListNumbers className="h-5 w-5 text-primary" /> Chart of accounts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The list of accounts you post to. Kenyan SME standard structure, ready to use.
          System accounts are locked; custom ones you add live alongside them.
        </p>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {TYPE_ORDER.map((type) => {
            const rows = accounts.filter((a) => a.type === type);
            if (rows.length === 0) return null;
            return (
              <div key={type}>
                <div className="bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {TYPE_LABEL[type]}
                </div>
                <table className="w-full text-[13px]">
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.code} className="border-b border-border/50 last:border-b-0">
                        <td className="px-3 py-1.5 font-mono text-[12px] w-20">{a.code}</td>
                        <td className="px-3 py-1.5">{a.name}</td>
                        <td className="px-3 py-1.5 text-right w-24">
                          {a.is_system ? (
                            <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">system</span>
                          ) : (
                            <span className="text-[10.5px] uppercase tracking-wider text-primary">custom</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
