import { useState, useEffect } from "react";
import {
  Minus as Minus,
  TrendDown as TrendingDown,
  TrendUp as TrendingUp,
} from "@phosphor-icons/react";
import { getSalesComparison } from "@/services/reports";

interface Props {
  currentDays: number;
}

export function ComparisonPanel({ currentDays }: Props) {
  const [data, setData] = useState<{
    current: { revenue: number; transactions: number; profit: number };
    previous: { revenue: number; transactions: number; profit: number };
  } | null>(null);

  useEffect(() => {
    const today = new Date();
    const currentEnd = today.toISOString().slice(0, 10);
    const currentStart = new Date(today.getTime() - currentDays * 86400000).toISOString().slice(0, 10);
    const previousEnd = new Date(today.getTime() - currentDays * 86400000 - 86400000).toISOString().slice(0, 10);
    const previousStart = new Date(today.getTime() - currentDays * 2 * 86400000).toISOString().slice(0, 10);
    getSalesComparison(currentStart, currentEnd, previousStart, previousEnd).then(setData);
  }, [currentDays]);

  if (!data) return null;

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Period Comparison</h2>
        <span className="text-xs text-muted-foreground">
          Last {currentDays}d vs Previous {currentDays}d
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <ComparisonMetric
          label="Revenue"
          current={data.current.revenue}
          previous={data.previous.revenue}
          prefix="KES"
        />
        <ComparisonMetric
          label="Transactions"
          current={data.current.transactions}
          previous={data.previous.transactions}
        />
        <ComparisonMetric
          label="Profit"
          current={data.current.profit}
          previous={data.previous.profit}
          prefix="KES"
        />
      </div>
    </div>
  );
}

function ComparisonMetric({
  label,
  current,
  previous,
  prefix,
}: {
  label: string;
  current: number;
  previous: number;
  prefix?: string;
}) {
  const delta = current - previous;
  const pct = previous !== 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold font-mono">
        {prefix && <span className="text-xs text-muted-foreground mr-1">{prefix}</span>}
        {current.toFixed(0)}
      </p>
      <div className="flex items-center gap-1.5 text-xs">
        {trend === "up" && <TrendingUp className="h-3 w-3 text-green-600" />}
        {trend === "down" && <TrendingDown className="h-3 w-3 text-red-600" />}
        {trend === "flat" && <Minus className="h-3 w-3 text-muted-foreground" />}
        <span
          className={
            trend === "up"
              ? "text-green-600"
              : trend === "down"
              ? "text-red-600"
              : "text-muted-foreground"
          }
        >
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">
          (was {previous.toFixed(0)})
        </span>
      </div>
    </div>
  );
}
