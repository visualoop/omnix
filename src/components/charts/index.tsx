/**
 * Recharts wrappers — every chart in the app routes through these so we
 * have a single place to enforce theming. Charts read colours from CSS
 * custom properties defined in `src/index.css` (and inverted by `.dark`),
 * so light + dark mode both render legible series without component-side
 * branching.
 *
 * Token model:
 *   --chart-1 … --chart-8        categorical palette for series
 *   --chart-positive / -warning / -destructive   semantic colours
 *   --chart-axis                 axis tick labels
 *   --chart-grid                 gridlines (more muted than --border)
 *   --chart-tooltip-bg/-fg/-border  tooltip surface
 *
 * Why we don't read these via `getComputedStyle()`:
 *   - Recharts accepts string colour values (hex / rgb / `var(--x)`).
 *     The browser resolves `var(--chart-1)` at paint time — no JS work
 *     needed.
 *   - `getComputedStyle` would force a re-render on theme change, which
 *     a CSS variable handles for free.
 *
 * Previous bug (fixed here):
 *   The old version called `hsl(var(--primary))` but the app stores
 *   colours as `oklch(...)`, so `hsl(oklch(...))` returned an INVALID
 *   colour. Recharts SVG fell back to `currentColor` — black on dark
 *   mode, hence the "bars blend into the background" report.
 */
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/** Ordered categorical palette. Recharts comparison charts cycle through
 *  this for series without an explicit colour. Series count > 8 wraps. */
export const CHART_SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/** Semantic colour helpers — for "this is good / bad / warn" signals. */
export const CHART_SEMANTIC = {
  primary: "var(--chart-1)",
  positive: "var(--chart-positive)",
  warning: "var(--chart-warning)",
  destructive: "var(--chart-destructive)",
  axis: "var(--chart-axis)",
  grid: "var(--chart-grid)",
} as const;

/** Tooltip surface — passed to recharts `<Tooltip contentStyle/>`. The
 *  values resolve at render so flipping `.dark` re-themes without React. */
const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--chart-tooltip-bg)",
  color: "var(--chart-tooltip-fg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "12px",
  // Recharts default uses inline `stroke` on the cursor line — set it to
  // grid colour so it doesn't render bright white on dark mode.
};
const tooltipItemStyle: React.CSSProperties = { color: "var(--chart-tooltip-fg)" };
const tooltipLabelStyle: React.CSSProperties = { color: "var(--chart-tooltip-fg)", fontWeight: 500 };
const tooltipCursorProps = { fill: "var(--chart-grid)", fillOpacity: 0.3 } as const;

/* ==================== LINE CHART ==================== */
interface LineChartProps {
  data: Array<Record<string, unknown>> | unknown[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
}

export function LineChart({ data, xKey, yKey, color = CHART_SEMANTIC.primary, height = 240 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} />
        <XAxis dataKey={xKey} stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
        <YAxis stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ stroke: CHART_SEMANTIC.grid }}
        />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, stroke: color }} activeDot={{ r: 4, fill: color, stroke: color }} />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

/* ==================== AREA CHART ==================== */
export function AreaChart({ data, xKey, yKey, color = CHART_SEMANTIC.primary, height = 240 }: LineChartProps) {
  // Gradient id derives from yKey so multiple AreaCharts on the same page
  // don't collide on a global <defs> id.
  const gradientId = `omnix-area-${yKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} />
        <XAxis dataKey={xKey} stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
        <YAxis stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ stroke: CHART_SEMANTIC.grid }}
        />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}

/* ==================== BAR CHART ==================== */
interface BarChartProps {
  data: Array<Record<string, unknown>> | unknown[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  horizontal?: boolean;
}

export function BarChart({ data, xKey, yKey, color = CHART_SEMANTIC.primary, height = 240, horizontal = false }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 10, right: 10, left: horizontal ? 60 : 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} />
        {horizontal ? (
          <>
            <XAxis type="number" stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
            <YAxis type="category" dataKey={xKey} stroke={CHART_SEMANTIC.axis} fontSize={11} width={60} tick={{ fill: CHART_SEMANTIC.axis }} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
            <YAxis stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={tooltipCursorProps}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

/* ==================== PIE / DONUT CHART ==================== */
interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  donut?: boolean;
}

export function PieChart({ data, height = 240, donut = true }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={donut ? 50 : 0}
          outerRadius={80}
          dataKey="value"
          paddingAngle={2}
          stroke="var(--chart-tooltip-bg)"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_SERIES[i % CHART_SERIES.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
        />
        <Legend wrapperStyle={{ fontSize: "11px", color: "var(--chart-axis)" }} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

/* ==================== COMPARISON BAR (TWO+ SERIES) ==================== */
interface ComparisonProps {
  data: Array<Record<string, unknown>> | unknown[];
  xKey: string;
  series: Array<{ key: string; name: string; color?: string }>;
  height?: number;
}

export function ComparisonBar({ data, xKey, series, height = 240 }: ComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_SEMANTIC.grid} />
        <XAxis dataKey={xKey} stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
        <YAxis stroke={CHART_SEMANTIC.axis} fontSize={11} tick={{ fill: CHART_SEMANTIC.axis }} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={tooltipCursorProps}
        />
        <Legend wrapperStyle={{ fontSize: "11px", color: "var(--chart-axis)" }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color || CHART_SERIES[i % CHART_SERIES.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
